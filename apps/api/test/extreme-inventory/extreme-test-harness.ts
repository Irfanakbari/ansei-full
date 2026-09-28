/* By Irfan Akbari Vuteq Indonesia - 2026-09-24 */
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';
import { SsoAuthService } from '../../src/auth/sso-auth.service';
import { OutboxDispatcher } from '../../src/common/outbox/outbox.dispatcher';
import { OutboxProcessor } from '../../src/common/outbox/outbox.processor';
import { PrismaService } from '../../src/prisma/prisma.service';

export const FULL_PERMISSIONS = [
  'IPCS.MASTER_READ',
  'IPCS.MASTER_CREATE',
  'IPCS.MASTER_UPDATE',
  'IPCS.BOM_REVISION_READ',
  'IPCS.BOM_REVISION_CREATE',
  'IPCS.BOM_REVISION_UPDATE',
  'IPCS.BOM_REVISION_SUBMIT',
  'IPCS.BOM_REVISION_APPROVE',
  'IPCS.INCOMING_READ',
  'IPCS.INCOMING_CREATE',
  'IPCS.INCOMING_UPDATE',
  'IPCS.TRANSFER_CREATE',
  'IPCS.FORECAST_READ',
  'IPCS.FORECAST_CREATE',
  'IPCS.FORECAST_UPDATE',
  'IPCS.PRODUCTION_RELEASE_READ',
  'IPCS.PRODUCTION_RELEASE_CREATE',
  'IPCS.PRODUCTION_RELEASE_UPDATE',
  'IPCS.SHOPPING_READ',
  'IPCS.SHOPPING_CREATE',
  'IPCS.ASSEMBLY_READ',
  'IPCS.ASSEMBLY_CREATE',
  'IPCS.ASSEMBLY_CANCEL',
  'IPCS.POKAYOKE_READ',
  'IPCS.POKAYOKE_CREATE',
  'IPCS.DELIVERY_READ',
  'IPCS.DELIVERY_CREATE',
  'IPCS.MATERIAL_NG_READ',
  'IPCS.MATERIAL_NG_CREATE',
  'IPCS.MATERIAL_NG_ISSUE',
  'IPCS.MATERIAL_NG_CLOSE',
  'IPCS.INVENTORY_COUNTING_CREATE',
  'IPCS.INVENTORY_COUNTING_UPDATE',
  'IPCS.INVENTORY_COUNTING_APPROVE',
] as const;

type TestIdentity = {
  id: string;
  permissions: readonly string[];
};

const identities: Record<string, TestIdentity> = {
  'extreme-admin': { id: 'extreme-admin', permissions: FULL_PERMISSIONS },
  'extreme-maker': { id: 'extreme-maker', permissions: FULL_PERMISSIONS },
  'extreme-checker': { id: 'extreme-checker', permissions: FULL_PERMISSIONS },
  'extreme-denied': { id: 'extreme-denied', permissions: [] },
};

function validateDatabaseUrl(): URL {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Extreme E2E requires NODE_ENV=test.');
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('Extreme E2E requires DATABASE_URL.');
  const parsed = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('Extreme E2E requires PostgreSQL.');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error('Extreme E2E only accepts a localhost database.');
  }
  const database = decodeURIComponent(parsed.pathname.slice(1));
  if (!/(_test|_e2e)$/i.test(database)) {
    throw new Error('Extreme E2E database name must end with _test or _e2e.');
  }
  if (parsed.searchParams.get('schema')?.toLowerCase() !== 'public') {
    const schema = parsed.searchParams.get('schema');
    if (schema) throw new Error('Extreme E2E requires the public schema.');
  }
  return parsed;
}

async function assertConnectedDatabase(prisma: PrismaService, url: URL) {
  const rows = await prisma.$queryRaw<
    Array<{ database_name: string; schema_name: string }>
  >`SELECT current_database()::text AS database_name, current_schema()::text AS schema_name`;
  const connected = rows[0];
  const expected = decodeURIComponent(url.pathname.slice(1));
  if (
    !connected ||
    connected.database_name !== expected ||
    connected.schema_name !== 'public' ||
    !/(_test|_e2e)$/i.test(connected.database_name)
  ) {
    throw new Error('Connected database failed the disposable database guard.');
  }
}

export async function truncateApplicationTables(prisma: PrismaService) {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;
  if (tables.length === 0) {
    throw new Error('No migrated application tables were found in public.');
  }
  const names = tables
    .map(({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`)
    .join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`,
  );
}

export async function createExtremeTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const databaseUrl = validateDatabaseUrl();
  jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
  const sso = {
    authenticate: jest.fn((authorization: string) => {
      const token = authorization.replace(/^Bearer\s+/i, '');
      const identity = identities[token];
      if (!identity) throw new Error('Unknown test bearer token');
      return {
        grantId: `grant-${identity.id}`,
        user: {
          id: identity.id,
          username: identity.id,
          name: identity.id,
          email: `${identity.id}@example.invalid`,
          roles: ['EXTREME_TEST'],
          permissions: [...identity.permissions],
          globalRoles: [],
          attributes: {},
        },
      };
    }),
  };
  const inertQueue = {
    add: jest.fn(),
    close: jest.fn(),
    getJob: jest.fn(),
    getJobs: jest.fn().mockResolvedValue([]),
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SsoAuthService)
    .useValue(sso)
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .overrideProvider(OutboxDispatcher)
    .useValue({
      onModuleInit: () => undefined,
      onModuleDestroy: () => undefined,
    })
    .overrideProvider(OutboxProcessor)
    .useValue({})
    .overrideProvider(getQueueToken('outbox_queue'))
    .useValue(inertQueue)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  await app.init();
  // Keep one bound server alive for the entire suite. Letting Supertest bind an
  // unbound server per request races server.close() under concurrent waves.
  await app.listen(0, '127.0.0.1');
  const prisma = app.get(PrismaService);
  await assertConnectedDatabase(prisma, databaseUrl);
  return { app, prisma };
}

export async function assertInventoryIntegrity(prisma: PrismaService) {
  const ledgers = await prisma.inventoryLedger.findMany();
  for (const row of ledgers) {
    expect(row.QtyIn).toBeGreaterThanOrEqual(0);
    expect(row.QtyOut).toBeGreaterThanOrEqual(0);
    expect(row.BalanceAfter).toBeGreaterThanOrEqual(0);
    expect(row.BalanceAfter).toBe(row.BalanceBefore + row.QtyIn - row.QtyOut);
  }

  const groups = new Map<string, typeof ledgers>();
  for (const row of ledgers) {
    const item = row.MaterialId ?? row.FinishGoodId;
    const key = `${row.ItemCategory}:${item}:${row.Location}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const [key, entries] of groups) {
    const remaining = [...entries];
    let balance = 0;
    while (remaining.length > 0) {
      const next = remaining.findIndex((row) => row.BalanceBefore === balance);
      if (next < 0) {
        throw new Error(
          `Ledger ${key} cannot be linearized from balance ${balance}.`,
        );
      }
      balance = remaining[next].BalanceAfter;
      remaining.splice(next, 1);
    }
  }

  const materials = await prisma.material.findMany({
    select: { PartNumber: true, QtyWarehouse: true, QtyRack: true },
  });
  for (const material of materials) {
    const rows = ledgers.filter(
      (row) => row.MaterialId === material.PartNumber,
    );
    const at = (location: 'WAREHOUSE' | 'RACK') =>
      rows
        .filter((row) => row.Location === location)
        .reduce((sum, row) => sum + row.QtyIn - row.QtyOut, 0);
    expect(material.QtyWarehouse).toBe(at('WAREHOUSE'));
    expect(material.QtyRack).toBe(at('RACK'));
  }

  const finishGoods = await prisma.finishGood.findMany({
    select: { PartNumber: true, Qty: true },
  });
  for (const finishGood of finishGoods) {
    const balance = ledgers
      .filter(
        (row) =>
          row.FinishGoodId === finishGood.PartNumber &&
          row.Location === 'FINISH_GOOD_AREA',
      )
      .reduce((sum, row) => sum + row.QtyIn - row.QtyOut, 0);
    expect(finishGood.Qty).toBe(balance);
  }
}

export function responseData<T>(body: unknown): T {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new Error('Expected the standard API success envelope.');
  }
  return (body as { data: T }).data;
}
