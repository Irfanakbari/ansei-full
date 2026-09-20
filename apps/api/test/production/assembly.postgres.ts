/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
// Run from apps/api: pnpm exec tsx test/production/assembly.postgres.ts
// All writes are confined to a newly created, disposable schema. No public data is modified.
import 'reflect-metadata';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { AssemblyService } from '../../src/production/assembly/assembly.service';
import { LogProcessService } from '../../src/common/log-process/log-process.service';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { assertLabelReady } from '../../src/common/helpers/production-flow.helper';

async function main() {
  const connectionString =
    process.env.ASSEMBLY_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error('Set ASSEMBLY_TEST_DATABASE_URL or DATABASE_URL.');
  const schema = `assembly_test_${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^assembly_test_[a-f0-9]{32}$/);
  const admin = new Pool({ connectionString });
  const pool = new Pool({
    connectionString,
    options: `-c search_path=${schema}`,
  });
  const client = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
  const temp = mkdtempSync(join(tmpdir(), 'ansei-assembly-'));
  try {
    // Operational read only: enforce maintenance prerequisite before any rollout.
    const active = await admin.query(
      'SELECT count(*)::int AS count FROM public."ProductionRelease" WHERE "Status" = $1',
      ['RELEASED'],
    );
    console.log(
      `Rollout prerequisite: ${active.rows[0].count} active RELEASED production releases.`,
    );
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const beforeSchema = readFileSync('prisma/schema.prisma', 'utf8')
      .replace(/enum AssemblyStatus \{[\s\S]*?\n\}/, '')
      .replace(/model AssemblySession \{[\s\S]*?\n\}/, '')
      .split('\n')
      .filter(
        (line) => !/IsPassthrough|RequiresAssembly|AssemblySessions/.test(line),
      )
      .join('\n')
      .replaceAll('ShoppingCompletion', 'ShoppingProductionResult');
    const schemaFile = join(temp, 'before.prisma');
    writeFileSync(schemaFile, beforeSchema);
    const baseline = execFileSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema',
        schemaFile,
        '--script',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    await pool.query(
      baseline.replace('CREATE SCHEMA IF NOT EXISTS "public";', ''),
    );
    const migration = readFileSync(
      'prisma/migrations/20260918170000_label_assembly/migration.sql',
      'utf8',
    );
    await pool.query(
      `INSERT INTO "ProductionRelease" ("Id", "ReleaseNumber", "PlanDate", "Status", "CreatedBy", "UpdatedAt") VALUES ('guard', 'guard', NOW(), 'RELEASED', 'TEST', NOW())`,
    );
    const guardConnection = await pool.connect();
    try {
      await assert.rejects(
        guardConnection.query(migration),
        /Finish all RELEASED/,
      );
      await guardConnection.query('ROLLBACK');
    } finally {
      guardConnection.release();
    }
    await pool.query('DELETE FROM "ProductionRelease" WHERE "Id" = $1', [
      'guard',
    ]);
    await pool.query(
      `INSERT INTO "FinishGood" ("PartNumber", "PartName", "CreatedBy", "UpdatedAt") VALUES ('LEGACY', 'Legacy', 'TEST', NOW())`,
    );
    await pool.query(
      `INSERT INTO "Forecast" ("PoId", "Date", "VendorCode", "VendorName", "ReceivingArea", "DeliveryDate", "DeliveryPeriod", "Classification", "PoNumber", "Item", "Qty", "FinishGoodId") VALUES ('LEGACY', NOW(), 'T', 'T', 'T', NOW(), 1, 'T', 'T', 1, 1, 'LEGACY')`,
    );
    await pool.query(
      `INSERT INTO "LabelData" ("LabelNumber", "FinishGoodId", "ForecastId", "QtyThisBox") VALUES ('LEGACY', 'LEGACY', 'LEGACY', 1)`,
    );
    await pool.query(
      `INSERT INTO "ShoppingProductionResult" ("ForecastId", "ShoppingId", "CreatedBy") VALUES ('LEGACY', 'LEGACY-SHOP', 'TEST')`,
    );
    await pool.query(migration);
    assert.equal(
      (
        await client.shoppingCompletion.findUniqueOrThrow({
          where: { ForecastId: 'LEGACY' },
        })
      ).ShoppingId,
      'LEGACY-SHOP',
    );
    assert.equal(
      (
        await client.labelData.findUniqueOrThrow({
          where: { LabelNumber: 'LEGACY' },
        })
      ).RequiresAssembly,
      null,
    );
    assert.equal(await client.assemblySession.count(), 0);
    console.log(
      'PASS: migration applies atomically and refuses active releases.',
    );
    const prisma = client as unknown as PrismaService;
    const service = new AssemblyService(prisma, new LogProcessService(prisma));
    const now = new Date();
    const fg = await client.finishGood.create({
      data: {
        PartNumber: 'TEST-FG',
        PartName: 'Test FG',
        CreatedBy: 'TEST',
        UpdatedBy: 'TEST',
      },
    });
    const material = await client.material.create({
      data: {
        PartNumber: 'TEST-MAT',
        PartName: 'Test material',
        CreatedBy: 'TEST',
        UpdatedBy: 'TEST',
      },
    });
    await client.billOfMaterials.create({
      data: { FinishGoodId: fg.Id, MaterialId: material.Id, Qty: 1 },
    });
    const release = await client.productionRelease.create({
      data: {
        ReleaseNumber: 'TEST-REL',
        PlanDate: now,
        CreatedBy: 'TEST',
        Status: 'RELEASED',
      },
    });
    await client.forecast.create({
      data: {
        PoId: 'TEST-PO',
        Date: now,
        VendorCode: 'TEST',
        VendorName: 'TEST',
        ReceivingArea: 'TEST',
        DeliveryDate: now,
        DeliveryPeriod: 1,
        Classification: 'TEST',
        PoNumber: 'TEST',
        Item: 1,
        Qty: 12,
        FinishGoodId: fg.PartNumber,
        ProductionReleaseId: release.Id,
      },
    });
    const labels = await Promise.all(
      ['BOX-A', 'BOX-B'].map((LabelNumber) =>
        client.labelData.create({
          data: {
            LabelNumber,
            FinishGoodId: fg.PartNumber,
            ForecastId: 'TEST-PO',
            ProductionReleaseId: release.Id,
            QtyThisBox: 6,
            RequiresAssembly: true,
          },
        }),
      ),
    );
    const operators = await Promise.all(
      ['OP-A', 'OP-B'].map((Nik) =>
        client.manPower.create({
          data: {
            Nik,
            Name: Nik,
            CreatedBy: 'TEST',
            UpdatedBy: 'TEST',
          },
        }),
      ),
    );
    const start = (
      labelNumber: string,
      manPowerNik = 'OP-A',
      requestId = randomUUID(),
    ) =>
      service.start(
        { labelNumber, manPowerNik, requestId },
        'DISPLAY',
        'DISPLAY',
      );
    await assert.rejects(start('BOX-A'), /Shopping/);
    await client.shopping.create({
      data: {
        Id: 'TEST-SHOP',
        MaterialId: material.PartNumber,
        ForecastId: 'TEST-PO',
        QtyPick: 12,
        Type: 'REGULER',
        CreatedBy: 'TEST',
      },
    });
    await client.shoppingCompletion.create({
      data: {
        ForecastId: 'TEST-PO',
        ShoppingId: 'TEST-SHOP',
        CreatedBy: 'TEST',
      },
    });
    await assert.rejects(
      assertLabelReady(prisma, labels[0].Id, false),
      /Assembly must/,
    );
    await client.finishGood.update({
      where: { Id: fg.Id },
      data: { IsPassthrough: true },
    });
    await assert.rejects(
      assertLabelReady(prisma, labels[0].Id, false),
      /Assembly must/,
    );
    const starts = await Promise.allSettled([
      start('BOX-A'),
      start('BOX-A', 'OP-B'),
    ]);
    assert.equal(starts.filter((r) => r.status === 'fulfilled').length, 1);
    const session = starts.find((r) => r.status === 'fulfilled');
    assert(session?.status === 'fulfilled');
    const nik = operators.find((o) => o.Uid === session.value.ManPowerUid)!.Nik;
    await assert.rejects(start('BOX-B', nik), /active assembly/);
    // Direct writes prove partial uniqueness independently of service locks.
    await assert.rejects(
      client.assemblySession.create({
        data: {
          LabelDataId: labels[1].Id,
          ManPowerUid: session.value.ManPowerUid,
          ManPowerName: 'TEST',
          StartRequestId: randomUUID(),
          CreatedBy: 'TEST',
          Channel: 'INTERNAL',
        },
      }),
    );
    await assert.rejects(
      client.assemblySession.create({
        data: {
          LabelDataId: labels[0].Id,
          ManPowerUid: operators.find((o) => o.Nik !== nik)!.Uid,
          ManPowerName: 'TEST',
          StartRequestId: randomUUID(),
          CreatedBy: 'TEST',
          Channel: 'INTERNAL',
        },
      }),
    );
    const complete = () =>
      service.complete(
        session.value.Id,
        { manPowerNik: nik, requestId: randomUUID() },
        'DISPLAY',
      );
    const completed = await Promise.all([complete(), complete()]);
    assert.equal(completed[0].Id, completed[1].Id);
    assert.equal(
      await client.inventoryLedger.count({
        where: { ReferenceDoc: `ASSY-${session.value.Id}` },
      }),
      1,
    );
    assert.equal(
      (await client.finishGood.findUniqueOrThrow({ where: { Id: fg.Id } })).Qty,
      6,
    );
    await assertLabelReady(prisma, labels[0].Id, false);
    await assert.rejects(
      assertLabelReady(prisma, labels[1].Id, false),
      /Assembly must/,
    );
    await assert.rejects(
      service.cancel(session.value.Id, 'too late', 'LEADER'),
      /active/,
    );
    const pending = await start('BOX-B', nik);
    await service.cancel(pending.Id, 'Wrong box', 'LEADER');
    const restarted = await start('BOX-B', nik);
    assert.notEqual(restarted.Id, pending.Id);
    // Force failure after stock booking: transaction must roll back ledger/cache and session together.
    await pool.query(
      `CREATE FUNCTION fail_assy_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."Status" = 'COMPLETED' THEN RAISE EXCEPTION 'test rollback'; END IF; RETURN NEW; END $$`,
    );
    await pool.query(
      'CREATE TRIGGER fail_assy_update BEFORE UPDATE ON "AssemblySession" FOR EACH ROW EXECUTE FUNCTION fail_assy_update()',
    );
    await assert.rejects(
      service.complete(
        restarted.Id,
        { manPowerNik: nik, requestId: randomUUID() },
        'DISPLAY',
      ),
    );
    assert.equal(await client.inventoryLedger.count(), 1);
    assert.equal(
      (await client.finishGood.findUniqueOrThrow({ where: { Id: fg.Id } })).Qty,
      6,
    );
    assert.equal(
      (
        await client.assemblySession.findUniqueOrThrow({
          where: { Id: restarted.Id },
        })
      ).Status,
      'IN_PROGRESS',
    );
    await pool.query('DROP TRIGGER fail_assy_update ON "AssemblySession"');
    // Cross-day durations are persisted as instants, not time-of-day values.
    await client.assemblySession.update({
      where: { Id: restarted.Id },
      data: { StartedAt: new Date(Date.now() - 26 * 3600000) },
    });
    const crossDay = await service.complete(
      restarted.Id,
      { manPowerNik: nik, requestId: randomUUID() },
      'DISPLAY',
    );
    assert(
      crossDay.EndedAt!.getTime() - crossDay.StartedAt.getTime() >=
        26 * 3600000,
    );
    await assert.rejects(
      client.assemblySession.create({
        data: {
          LabelDataId: labels[1].Id,
          ManPowerUid: operators[0].Uid,
          ManPowerName: 'TEST',
          Status: 'COMPLETED',
          StartedAt: now,
          EndedAt: new Date(),
          StartRequestId: randomUUID(),
          CompleteRequestId: randomUUID(),
          CreatedBy: 'TEST',
          Channel: 'INTERNAL',
        },
      }),
    );
    assert.equal(
      (await client.finishGood.findUniqueOrThrow({ where: { Id: fg.Id } })).Qty,
      12,
    );
    console.log(
      'PASS: PostgreSQL concurrent starts/completions, partial uniqueness, per-box gate, cancellation, cross-day duration, ledger/cache/audit transaction rollback.',
    );
  } finally {
    await client.$disconnect();
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
    assert.equal(dirname(resolve(temp)), resolve(tmpdir()));
    assert(basename(temp).startsWith('ansei-assembly-'));
    rmSync(temp, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Assembly integration failed',
  );
  process.exitCode = 1;
});
