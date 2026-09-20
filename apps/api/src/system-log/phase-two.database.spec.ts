/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';
import { TransferService } from '../warehouse/transfer/transfer.service';
import { BomRevisionsService } from '../master/bom-revisions/bom-revisions.service';
import { auditContext } from '../common/helpers/audit-context.helper';
import { auditedTransaction } from '../common/helpers/audited-transaction.helper';
import {
  claimCommand,
  finishCommand,
} from '../common/helpers/business-command.helper';
import { SystemLogService } from './system-log.service';
import { IncomingService } from '../warehouse/incoming/incoming.service';
import { ProductionReportService } from '../production/production-report/production-report.service';

const databaseSuite =
  process.env.PHASE2_DATABASE_TEST === '1' ? describe : describe.skip;
databaseSuite('Phase 2 PostgreSQL command and audit invariants', () => {
  let db: PrismaService;
  let logs: LogProcessService;
  let transfer: TransferService;
  const context = <T>(work: () => Promise<T>, key = randomUUID()) =>
    auditContext.run({ requestId: randomUUID(), idempotencyKey: key }, work);
  const material = async (qty = 100) => {
    const part = `P2-${randomUUID()}`;
    await db.material.create({
      data: {
        PartNumber: part,
        PartName: 'Fixture only',
        CreatedBy: 'fixture',
        UpdatedBy: 'fixture',
        QtyWarehouse: qty,
      },
    });
    await db.inventoryLedger.create({
      data: {
        Id: randomUUID(),
        TransactionDate: new Date(),
        ItemCategory: 'MATERIAL',
        MaterialId: part,
        Location: 'WAREHOUSE',
        TransactionType: 'INCOMING_SUPPLIER',
        ReferenceDoc: 'P2-FIXTURE',
        BalanceBefore: 0,
        QtyIn: qty,
        QtyOut: 0,
        BalanceAfter: qty,
        CreatedBy: 'fixture',
      },
    });
    return part;
  };
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.hostname !== '127.0.0.1' || url.pathname !== '/ansei_phase2')
      throw new Error('Requires disposable localhost ansei_phase2 database');
    db = new PrismaService();
    await db.$connect();
    logs = new LogProcessService(db);
    transfer = new TransferService(db, logs);
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it('replays the original transfer with one pair of ledger entries and immutable audit evidence', async () => {
    const part = await material();
    const key = randomUUID();
    const first = await context(() =>
      transfer.transferToRack(part, 20, 'actor-a', key),
    );
    const second = await context(() =>
      transfer.transferToRack(part, 20, 'actor-a', key),
    );
    expect(second).toEqual(first);
    expect(
      await db.inventoryLedger.count({
        where: { MaterialId: part, TransactionType: 'TRANSFER_TO_RACK' },
      }),
    ).toBe(2);
    expect(
      await db.material.findUnique({ where: { PartNumber: part } }),
    ).toMatchObject({ QtyWarehouse: 80, QtyRack: 20 });
    const command = await db.businessCommand.findUniqueOrThrow({
      where: { Scope_RequestId: { Scope: 'TRANSFER_TO_RACK', RequestId: key } },
    });
    expect(
      await db.actionAuditEvent.count({
        where: { SourceId: command.Id, Action: 'REPLAY' },
      }),
    ).toBe(1);
    const ledger = await db.inventoryLedger.findFirstOrThrow({
      where: {
        MaterialId: part,
        TransactionType: 'TRANSFER_TO_RACK',
        Location: 'WAREHOUSE',
      },
    });
    const audit = await db.actionAuditEvent.findFirstOrThrow({
      where: { SourceType: 'InventoryLedger', SourceId: ledger.Id },
    });
    expect(audit).toMatchObject({
      Actor: 'actor-a',
      ActorSource: 'REQUEST_CONTEXT',
    });
    expect(audit.ProcessId).toBeTruthy();
    expect(audit.RequestId).toBeTruthy();
    expect(audit.After).toMatchObject({
      BalanceBefore: 100,
      BalanceAfter: 80,
      QtyOut: 20,
    });
    expect(audit.After).not.toHaveProperty('Notes');
    await expect(
      db.actionAuditEvent.update({
        where: { Id: audit.Id },
        data: { Actor: 'changed' },
      }),
    ).rejects.toThrow();
    await expect(
      db.businessCommand.update({
        where: { Id: command.Id },
        data: { Result: { changed: true } },
      }),
    ).rejects.toThrow();
    await expect(
      context(() => transfer.transferToRack(part, 21, 'actor-a', key)),
    ).rejects.toThrow('another operation');
    await expect(
      context(() => transfer.transferToRack(part, 20, 'actor-b', key)),
    ).rejects.toThrow('another operation');
  });

  it('serializes concurrent identical commands and rejects competing stock overdraw', async () => {
    const part = await material(20);
    const key = randomUUID();
    const results = await Promise.all([
      context(() => transfer.transferToRack(part, 5, 'worker', key)),
      context(() => transfer.transferToRack(part, 5, 'worker', key)),
    ]);
    expect(results[0]).toEqual(results[1]);
    const competing = await Promise.allSettled([
      context(() => transfer.transferToRack(part, 10, 'worker', randomUUID())),
      context(() => transfer.transferToRack(part, 10, 'worker', randomUUID())),
    ]);
    expect(competing.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.material.findUnique({ where: { PartNumber: part } }),
    ).toMatchObject({ QtyWarehouse: 5, QtyRack: 15 });
  });

  it('rolls back command, balance and audit together when work fails', async () => {
    const part = await material();
    const key = randomUUID();
    const before = await db.actionAuditEvent.count();
    await expect(
      context(() =>
        auditedTransaction(db, async (tx) => {
          await claimCommand(tx, 'ROLLBACK_TEST', key, 'worker', { part });
          await tx.material.update({
            where: { PartNumber: part },
            data: { QtyWarehouse: 90 },
          });
          throw new Error('deliberate rollback');
        }),
      ),
    ).rejects.toThrow('deliberate rollback');
    expect(await db.businessCommand.count({ where: { RequestId: key } })).toBe(
      0,
    );
    expect(await db.actionAuditEvent.count()).toBe(before);
    expect(
      (await db.material.findUniqueOrThrow({ where: { PartNumber: part } }))
        .QtyWarehouse,
    ).toBe(100);
  });

  it('replays BOM creation and approval without creating revisions or approval events twice', async () => {
    const bom = new BomRevisionsService(db, logs);
    const fg = await db.finishGood.create({
      data: {
        PartNumber: `P2-${randomUUID()}`,
        PartName: 'Fixture',
        CreatedBy: 'fixture',
        UpdatedBy: 'fixture',
      },
    });
    const component = await db.material.findUniqueOrThrow({
      where: { PartNumber: await material() },
    });
    const key = randomUUID();
    const payload = {
      finishGoodId: fg.Id,
      reason: 'Baseline',
      lines: [{ materialId: component.Id, qty: 1 }],
    };
    const revision = await context(() => bom.create(payload, 'maker'), key);
    const replay = await context(() => bom.create(payload, 'maker'), key);
    expect(JSON.parse(JSON.stringify(replay))).toEqual(
      JSON.parse(JSON.stringify(revision)),
    );
    const submitted = await context(() =>
      bom.action(
        revision.Id,
        'SUBMIT',
        { expectedVersion: revision.Version },
        'maker',
      ),
    );
    const approvalKey = randomUUID();
    await context(
      () =>
        bom.action(
          revision.Id,
          'APPROVE',
          { expectedVersion: submitted.Version },
          'checker',
        ),
      approvalKey,
    );
    await context(
      () =>
        bom.action(
          revision.Id,
          'APPROVE',
          { expectedVersion: submitted.Version },
          'checker',
        ),
      approvalKey,
    );
    expect(await db.bomRevision.count({ where: { FinishGoodId: fg.Id } })).toBe(
      1,
    );
    expect(
      await db.bomRevisionEvent.count({
        where: { RevisionId: revision.Id, Action: 'APPROVE' },
      }),
    ).toBe(1);
  });

  it('does not overwrite successful process status after a later failure; detail messages cannot be changed', async () => {
    const process = await logs.startProcess({
      functionId: 'P2_TEST',
      functionName: 'Terminal state',
      createdBy: 'test',
    });
    await logs.completeProcess(process.ProcessId, 'SUCCESS', 'Committed');
    await logs.completeProcess(process.ProcessId, 'FAILED');
    expect(
      (
        await db.logProcess.findUniqueOrThrow({
          where: { ProcessId: process.ProcessId },
        })
      ).ProcessStatus,
    ).toBe('SUCCESS');
    const detail = await db.logProcessDetail.findFirstOrThrow({
      where: { ProcessId: process.ProcessId },
    });
    await expect(
      db.logProcessDetail.delete({
        where: { ProcessDetailId: detail.ProcessDetailId },
      }),
    ).rejects.toThrow();
  });

  it('serves paginated, filtered evidence and never infers an update actor from the old creator', async () => {
    const part = await material();
    const updated = await db.material.update({
      where: { PartNumber: part },
      data: { IsActive: false },
    });
    const service = new SystemLogService(db);
    const result = await service.actions({
      page: 1,
      limit: 1,
      sourceType: 'Material',
      sourceId: String(updated.Id),
      action: 'UPDATE',
    });
    expect(result.data).toHaveLength(1);
    expect(result.meta.totalItems).toBe(1);
    expect(result.data[0]).toMatchObject({
      Actor: null,
      ActorSource: 'UNATTRIBUTED',
      Before: { IsActive: true },
      After: { IsActive: false },
    });
  });

  it('keeps command results even when the HTTP response is lost', async () => {
    const key = randomUUID();
    await auditedTransaction(db, async (tx) => {
      const claimed = await claimCommand(tx, 'LOST_RESPONSE', key, 'worker', {
        quantity: 2,
      });
      await finishCommand(tx, claimed.command.Id, { reference: 'saved' });
    });
    const replay = await auditedTransaction(db, (tx) =>
      claimCommand(tx, 'LOST_RESPONSE', key, 'worker', { quantity: 2 }),
    );
    expect(replay.duplicate).toBe(true);
    expect(replay.command.Result).toEqual({ reference: 'saved' });
  });

  it('receives material once and replays the receipt after it is already closed', async () => {
    const part = await material(0);
    const component = await db.material.findUniqueOrThrow({
      where: { PartNumber: part },
    });
    const supplier = await db.supplier.create({
      data: {
        Name: 'Fixture supplier',
        CreatedBy: 'TEST',
        UpdatedBy: 'TEST',
      },
    });
    const incoming = await db.incoming.create({
      data: {
        Id: randomUUID(),
        PoId: `P2-${randomUUID()}`,
        ReceivedBy: 'fixture',
        SupplierId: supplier.Id,
        IncomingMaterial: {
          create: { MaterialId: component.Id, Qty: 10, QtyChecked: 10 },
        },
      },
    });
    // No upload method is involved in a receipt.
    const service = new IncomingService(db, logs, {} as never);
    const key = randomUUID();
    const first = await context(
      () => service.receive(incoming.Id, 'receiver'),
      key,
    );
    const second = await context(
      () => service.receive(incoming.Id, 'receiver'),
      key,
    );
    expect(JSON.parse(JSON.stringify(second))).toEqual(
      JSON.parse(JSON.stringify(first)),
    );
    expect(first).toMatchObject({
      totalQty: 10,
      totalItems: 1,
      inventoryUpdated: true,
    });
    expect(
      (await db.material.findUniqueOrThrow({ where: { Id: component.Id } }))
        .QtyWarehouse,
    ).toBe(10);
    expect(
      await db.inventoryLedger.count({
        where: { ReferenceDoc: incoming.PoId },
      }),
    ).toBe(1);
    await expect(
      context(() => service.receive(incoming.Id, 'another-receiver'), key),
    ).rejects.toThrow('another operation');
  });

  it('records one production report and one trace event for concurrent retries from the station', async () => {
    const suffix = randomUUID();
    const fg = await db.finishGood.create({
      data: {
        PartNumber: `P2-${suffix}`,
        PartName: 'Fixture',
        CreatedBy: 'fixture',
        UpdatedBy: 'fixture',
      },
    });
    const operator = await db.manPower.create({
      data: {
        Nik: `TEST-${suffix}`,
        Name: 'Fixture operator',
        CreatedBy: 'TEST',
        UpdatedBy: 'TEST',
      },
    });
    const release = await db.productionRelease.create({
      data: {
        ReleaseNumber: `P2-${suffix}`,
        PlanDate: new Date(),
        CreatedBy: 'fixture',
        Status: 'RELEASED',
      },
    });
    try {
      const po = `P2-${suffix}`;
      await db.forecast.create({
        data: {
          PoId: po,
          Date: new Date(),
          VendorCode: 'TEST',
          VendorName: 'Fixture',
          ReceivingArea: 'TEST',
          DeliveryDate: new Date(),
          DeliveryPeriod: 1,
          Classification: 'TEST',
          PoNumber: po,
          Item: 1,
          Qty: 10,
          FinishGoodId: fg.PartNumber,
          ProductionReleaseId: release.Id,
        },
      });
      await db.pokayokeScanHistory.create({
        data: {
          LabelNumber: `TEST-${suffix}`,
          PoId: po,
          PartNumber: fg.PartNumber,
          PartName: 'Fixture',
          CreatedBy: 'fixture',
          Status: 'SUKSES',
        },
      });
      const service = new ProductionReportService(db, logs);
      const payload = {
        productionStamp: new Date().toISOString(),
        qty: 10,
        ngQty: 0,
        manPowerUid: operator.Uid,
        finishGoodId: fg.PartNumber,
        forecastId: po,
      };
      const key = randomUUID();
      const [first, second] = await Promise.all([
        context(() => service.create(payload, 'verified-station'), key),
        context(() => service.create(payload, 'verified-station'), key),
      ]);
      expect(JSON.parse(JSON.stringify(first))).toEqual(
        JSON.parse(JSON.stringify(second)),
      );
      expect(
        await db.productionReport.count({ where: { ForecastId: po } }),
      ).toBe(1);
      expect(
        await db.productionTraceEvent.count({
          where: {
            ForecastId: po,
            Type: 'PRODUCTION_REPORT_CREATED',
            Actor: 'verified-station',
          },
        }),
      ).toBe(1);
    } finally {
      await db.productionRelease.update({
        where: { Id: release.Id },
        data: { Status: 'COMPLETED' },
      });
    }
  });
});
