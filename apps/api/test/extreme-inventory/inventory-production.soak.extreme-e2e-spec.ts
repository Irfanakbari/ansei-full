/* By Irfan Akbari Vuteq Indonesia - 2026-09-24 */
import { createHash, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  assertInventoryIntegrity,
  createExtremeTestApp,
  truncateApplicationTables,
} from './extreme-test-harness';

const minutes = Number(process.env.EXTREME_SOAK_MINUTES ?? 30);
const workerCount = Number(process.env.EXTREME_SOAK_WORKERS ?? 50);
const soakSeed = process.env.EXTREME_SOAK_SEED ?? 'ansei-extreme-20260924';
const durationMs = Math.max(1, minutes) * 60_000;

const deterministicRequestId = (worker: number, operation: number) => {
  const hex = createHash('sha256')
    .update(`${soakSeed}:${worker}:${operation}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

jest.setTimeout(durationMs + 120_000);

describe('Extreme inventory manual soak', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    if (process.env.EXTREME_E2E_MODE !== 'soak') {
      throw new Error('Run this suite through test:e2e:extreme:soak.');
    }
    ({ app, prisma } = await createExtremeTestApp());
    await truncateApplicationTables(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serializes sustained parallel stock movement without drift', async () => {
    process.stdout.write(
      `Extreme soak seed=${soakSeed} workers=${workerCount} minutes=${minutes}\n`,
    );
    const partNumber = 'EXT-SOAK-MATERIAL';
    const startingQty = 2_000_000_000;
    await prisma.material.create({
      data: {
        PartNumber: partNumber,
        PartName: 'Extreme soak material',
        CreatedBy: 'extreme-fixture',
        UpdatedBy: 'extreme-fixture',
        QtyWarehouse: startingQty,
      },
    });
    await prisma.inventoryLedger.create({
      data: {
        Id: randomUUID(),
        ItemCategory: 'MATERIAL',
        MaterialId: partNumber,
        Location: 'WAREHOUSE',
        TransactionType: 'INCOMING_SUPPLIER',
        ReferenceDoc: 'EXT-SOAK-FIXTURE',
        BalanceBefore: 0,
        QtyIn: startingQty,
        QtyOut: 0,
        BalanceAfter: startingQty,
        CreatedBy: 'extreme-fixture',
      },
    });

    const deadline = Date.now() + durationMs;
    const completed = Array.from({ length: workerCount }, () => 0);
    const attempted = Array.from({ length: workerCount }, () => 0);
    const conflicts = Array.from({ length: workerCount }, () => 0);
    await Promise.all(
      completed.map(async (_value, worker) => {
        while (Date.now() < deadline) {
          const operation = attempted[worker];
          attempted[worker] += 1;
          const requestId = deterministicRequestId(worker, operation);
          const send = () =>
            request(app.getHttpServer())
              .post(`/v1/warehouse/material/${partNumber}/transfer-to-rack`)
              .set('Authorization', 'Bearer extreme-admin')
              .set('Idempotency-Key', requestId)
              .send({ qty: 1, requestId });
          const first = await send();
          if (first.status === 409) {
            conflicts[worker] += 1;
            continue;
          }
          if (first.status !== 201) {
            throw new Error(
              JSON.stringify({
                seed: soakSeed,
                endpoint: `/v1/warehouse/material/${partNumber}/transfer-to-rack`,
                requestId,
                status: first.status,
                referenceDocument: 'EXT-SOAK-FIXTURE',
              }),
            );
          }
          if ((completed[worker] + worker) % 10 === 0) {
            const replay = await send();
            if (replay.status !== 201) {
              throw new Error(
                JSON.stringify({
                  seed: soakSeed,
                  endpoint: `/v1/warehouse/material/${partNumber}/transfer-to-rack`,
                  requestId,
                  status: replay.status,
                  referenceDocument: 'EXT-SOAK-FIXTURE',
                  replay: true,
                }),
              );
            }
          }
          completed[worker] += 1;
        }
      }),
    );

    const successfulCommands = completed.reduce((sum, value) => sum + value, 0);
    const serializationConflicts = conflicts.reduce(
      (sum, value) => sum + value,
      0,
    );
    process.stdout.write(
      `Extreme soak completed=${successfulCommands} serializationConflicts=${serializationConflicts}\n`,
    );
    expect(successfulCommands).toBeGreaterThanOrEqual(workerCount);
    expect(
      await prisma.businessCommand.count({
        where: { Scope: 'TRANSFER_TO_RACK' },
      }),
    ).toBe(successfulCommands);
    expect(
      await prisma.inventoryLedger.count({
        where: { TransactionType: 'TRANSFER_TO_RACK' },
      }),
    ).toBe(successfulCommands * 2);
    await assertInventoryIntegrity(prisma);
  });
});
