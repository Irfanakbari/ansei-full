import { ShoppingService } from '../production/shopping/shopping.service';
import { OutboxService } from '../common/outbox/outbox.service';
import { TraceabilityService } from './traceability.service';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';
import { BomRevisionsService } from '../master/bom-revisions/bom-revisions.service';
import { MaterialNgService } from '../production/material-ng-cases/material-ng.service';
import {
  latestSnapshot,
  snapshotRelease,
  assertNoOutstandingReplacement,
} from '../common/helpers/bom-snapshot.helper';
import { lockProductionFlow } from '../common/helpers/production-flow.helper';

const databaseSuite =
  process.env.PHASE1_DATABASE_TEST === '1' ? describe : describe.skip;
databaseSuite('Phase 1 PostgreSQL invariants', () => {
  let db: PrismaService;
  let bom: BomRevisionsService;
  let ng: MaterialNgService;
  let shopping: ShoppingService;
  const prefix = `TEST-${randomUUID()}`;
  let materialId: number;
  let fgId: number;
  let revisionId: string;
  let releaseId: string;
  const material = `${prefix}-M`;
  const fg = `${prefix}-FG`;
  const po = `${prefix}-PO`;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.hostname !== '127.0.0.1' || url.pathname !== '/ansei_phase1')
      throw new Error(
        'Requires dedicated local disposable ansei_phase1 database',
      );
    db = new PrismaService();
    await db.$connect();
    const logs = new LogProcessService(db);
    bom = new BomRevisionsService(db, logs);
    ng = new MaterialNgService(db, logs);
    shopping = new ShoppingService(db, logs, new OutboxService(db));
    materialId = (
      await db.material.create({
        data: {
          PartNumber: material,
          PartName: 'Test component',
          CreatedBy: 'fixture',
          QtyRack: 10,
        },
      })
    ).Id;
    fgId = (
      await db.finishGood.create({
        data: {
          PartNumber: fg,
          PartName: 'Test product',
          CreatedBy: 'fixture',
        },
      })
    ).Id;
    releaseId = (
      await db.productionRelease.create({
        data: {
          ReleaseNumber: prefix,
          PlanDate: new Date(),
          CreatedBy: 'fixture',
          Status: 'RELEASED',
        },
      })
    ).Id;
    await db.forecast.create({
      data: {
        PoId: po,
        PoNumber: prefix,
        FinishGoodId: fg,
        ProductionReleaseId: releaseId,
        Qty: 10,
        Date: new Date(),
        DeliveryDate: new Date(),
        VendorCode: 'TEST',
        VendorName: 'Test',
        ReceivingArea: 'Test',
        DeliveryPeriod: 1,
        Classification: 'Test',
        Item: 1,
      },
    });
    await db.labelData.create({
      data: {
        LabelNumber: prefix,
        FinishGoodId: fg,
        ForecastId: po,
        ProductionReleaseId: releaseId,
        QtyThisBox: 10,
        RequiresAssembly: true,
      },
    });
  });
  afterAll(async () => {
    if (db) {
      if (releaseId)
        await db.productionRelease.update({
          where: { Id: releaseId },
          data: { Status: 'COMPLETED' },
        });
      await db.$disconnect();
    }
  });

  it('requires separate approval and protects approved components', async () => {
    const draft = await bom.create(
      {
        finishGoodId: fgId,
        reason: 'Baseline',
        lines: [{ materialId, qty: 1 }],
      },
      'maker',
    );
    const submitted = await bom.action(
      draft.Id,
      'SUBMIT',
      { expectedVersion: draft.Version },
      'maker',
    );
    await expect(
      bom.action(
        draft.Id,
        'APPROVE',
        { expectedVersion: submitted.Version },
        'maker',
      ),
    ).rejects.toThrow('cannot approve');
    const approved = await bom.action(
      draft.Id,
      'APPROVE',
      { expectedVersion: submitted.Version },
      'reviewer',
    );
    revisionId = approved.Id;
    await expect(
      db.bomRevisionLine.update({
        where: { Id: approved.Lines[0].Id },
        data: { Qty: 3 },
      }),
    ).rejects.toThrow('immutable');
  });

  it('freezes revision 1 while new approval changes only the active BOM', async () => {
    await db.$transaction(async (tx) => {
      await lockProductionFlow(tx);
      await snapshotRelease(tx, releaseId, 'planner');
    });
    const draft = await bom.create(
      {
        finishGoodId: fgId,
        reason: 'New requirement',
        lines: [{ materialId, qty: 2 }],
      },
      'maker',
    );
    const submitted = await bom.action(
      draft.Id,
      'SUBMIT',
      { expectedVersion: draft.Version },
      'maker',
    );
    const results = await Promise.allSettled([
      bom.action(
        draft.Id,
        'APPROVE',
        { expectedVersion: submitted.Version },
        'reviewer',
      ),
      bom.action(
        draft.Id,
        'APPROVE',
        { expectedVersion: submitted.Version },
        'reviewer2',
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const snapshot = await latestSnapshot(db, po, releaseId);
    expect(snapshot?.RevisionId).toBe(revisionId);
    expect(snapshot?.Lines[0].RequiredQty).toBe(10);
    expect(
      (await db.finishGood.findUniqueOrThrow({ where: { Id: fgId } }))
        .ActiveBomRevisionId,
    ).toBe(draft.Id);
    await expect(
      db.productionBomSnapshot.update({
        where: { Id: snapshot!.Id },
        data: { TargetQty: 20 },
      }),
    ).rejects.toThrow('append-only');
  });

  it('appends a quantity amendment using the same revision and snapshots a new PO using the new active BOM', async () => {
    const before = (await latestSnapshot(db, po, releaseId))!;
    await db.$transaction(async (tx) => {
      await lockProductionFlow(tx);
      await tx.forecast.update({ where: { PoId: po }, data: { Qty: 12 } });
      await snapshotRelease(tx, releaseId, 'planner');
    });
    const amended = (await latestSnapshot(db, po, releaseId))!;
    expect(amended.PreviousId).toBe(before.Id);
    expect(amended.RevisionId).toBe(revisionId);
    expect(amended.Lines[0].RequiredQty).toBe(12);
    await db.$transaction(async (tx) => {
      await tx.forecast.update({ where: { PoId: po }, data: { Qty: 10 } });
      await snapshotRelease(tx, releaseId, 'planner');
    });
    const old = await db.forecast.findUniqueOrThrow({ where: { PoId: po } });
    const { Id: ignoredId, ...input } = old;
    void ignoredId;
    await db.forecast.create({ data: { ...input, PoId: `${po}-B` } });
    await db.$transaction(async (tx) => {
      await lockProductionFlow(tx);
      await snapshotRelease(tx, releaseId, 'planner');
    });
    expect(
      (await latestSnapshot(db, `${po}-B`, releaseId))?.Lines[0].QtyPerUnit,
    ).toBe(2);
  });

  it('rejects the last editor and prevents competing drafts from replacing a newly active revision', async () => {
    const first = await bom.create(
      {
        finishGoodId: fgId,
        reason: 'Candidate A',
        lines: [{ materialId, qty: 3 }],
      },
      'maker',
    );
    const edited = await bom.update(
      first.Id,
      {
        expectedVersion: first.Version,
        expectedActiveRevisionId: first.FinishGood.ActiveBomRevisionId,
        lines: [{ materialId, qty: 3 }],
        reason: 'Reviewed edits',
      },
      'editor',
    );
    const a = await bom.action(
      first.Id,
      'SUBMIT',
      { expectedVersion: edited.Version },
      'maker',
    );
    await expect(
      bom.action(a.Id, 'APPROVE', { expectedVersion: a.Version }, 'editor'),
    ).rejects.toThrow('cannot approve');
    const second = await bom.create(
      {
        finishGoodId: fgId,
        reason: 'Candidate B',
        lines: [{ materialId, qty: 4 }],
      },
      'maker',
    );
    const b = await bom.action(
      second.Id,
      'SUBMIT',
      { expectedVersion: second.Version },
      'maker',
    );
    const editing = await bom.create(
      {
        finishGoodId: fgId,
        reason: 'Open editor',
        lines: [{ materialId, qty: 2 }],
      },
      'maker',
    );
    const results = await Promise.allSettled([
      bom.action(
        a.Id,
        'APPROVE',
        { expectedVersion: a.Version },
        'independent',
      ),
      bom.action(
        b.Id,
        'APPROVE',
        { expectedVersion: b.Version },
        'independent',
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await expect(
      bom.update(
        editing.Id,
        {
          expectedVersion: editing.Version,
          expectedActiveRevisionId: editing.FinishGood.ActiveBomRevisionId,
          lines: [{ materialId, qty: 2 }],
        },
        'maker',
      ),
    ).rejects.toThrow('Active BOM changed');
    const refreshed = await bom.get(editing.Id);
    await expect(
      bom.update(
        editing.Id,
        {
          expectedVersion: refreshed.Version,
          expectedActiveRevisionId: refreshed.FinishGood.ActiveBomRevisionId,
          lines: [{ materialId, qty: 2 }],
        },
        'maker',
      ),
    ).resolves.toBeDefined();
    expect((await latestSnapshot(db, po, releaseId))?.RevisionId).toBe(
      revisionId,
    );
    expect(
      (await latestSnapshot(db, `${po}-B`, releaseId))?.Lines[0].QtyPerUnit,
    ).toBe(2);
  });

  it('records NG without stock movement, issues 2 exactly once, and never increases output', async () => {
    const snapshot = (await latestSnapshot(db, po, releaseId))!;
    await db.material.update({
      where: { Id: materialId },
      data: { QtyRack: 20 },
    });
    await db.inventoryLedger.create({
      data: {
        MaterialId: material,
        ItemCategory: 'MATERIAL',
        Location: 'RACK',
        TransactionType: 'PRODUCTION_USAGE',
        ReferenceDoc: prefix,
        BalanceBefore: 0,
        QtyIn: 20,
        QtyOut: 0,
        BalanceAfter: 20,
        CreatedBy: 'fixture',
      },
    });
    const standard = {
      requestId: randomUUID(),
      purpose: 'STANDARD' as const,
      type: 'REGULER' as const,
      forecastId: po,
      snapshotId: snapshot.Id,
      materialId: material,
      qtyPick: 10,
    };
    await shopping.create(standard, 'operator');
    await shopping.create(standard, 'operator');
    const created = await ng.create(
      {
        requestId: randomUUID(),
        forecastId: po,
        snapshotId: snapshot.Id,
        stage: 'Assembly',
        reason: 'Damaged component',
        lines: [{ materialId: material, qtyNg: 2, qtyReplacement: 2 }],
      },
      'operator',
    );
    expect(
      (await db.material.findUniqueOrThrow({ where: { Id: materialId } }))
        .QtyRack,
    ).toBe(10);
    await expect(assertNoOutstandingReplacement(db, releaseId)).rejects.toThrow(
      'outstanding',
    );
    const dto = {
      requestId: randomUUID(),
      lines: [{ detailId: created.Details[0].Id, qty: 2 }],
    };
    const issued = await ng.issue(created.Id, dto, 'operator');
    await ng.issue(created.Id, dto, 'operator');
    expect(issued.Status).toBe('FULFILLED');
    expect(
      (
        await db.shopping.aggregate({
          where: { ForecastId: po },
          _sum: { QtyPick: true },
        })
      )._sum.QtyPick,
    ).toBe(12);
    expect(
      (await db.material.findUniqueOrThrow({ where: { Id: materialId } }))
        .QtyRack,
    ).toBe(8);
    expect(
      (await db.finishGood.findUniqueOrThrow({ where: { Id: fgId } })).Qty,
    ).toBe(0);
    expect(await db.labelData.count({ where: { ForecastId: po } })).toBe(1);
    expect(
      await db.shoppingCompletion.count({ where: { ForecastId: po } }),
    ).toBe(1);
    expect(
      (await db.forecast.findUniqueOrThrow({ where: { PoId: po } })).Qty,
    ).toBe(10);
    await expect(
      ng.issue(
        created.Id,
        { ...dto, lines: [{ detailId: created.Details[0].Id, qty: 1 }] },
        'operator',
      ),
    ).rejects.toThrow('identity');
    await assertNoOutstandingReplacement(db, releaseId);
  });

  it('serializes concurrent partial replacements and preserves the outstanding limit', async () => {
    const snapshot = (await latestSnapshot(db, po, releaseId))!;
    const value = await ng.create(
      {
        requestId: randomUUID(),
        forecastId: po,
        snapshotId: snapshot.Id,
        stage: 'Assembly',
        reason: 'Additional damage',
        lines: [{ materialId: material, qtyNg: 3, qtyReplacement: 3 }],
      },
      'operator',
    );
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        ng.issue(
          value.Id,
          {
            requestId: randomUUID(),
            lines: [{ detailId: value.Details[0].Id, qty: 2 }],
          },
          'operator',
        ),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const partial = await ng.get(value.Id);
    expect(partial.Status).toBe('OPEN');
    expect(
      partial.Details[0].Replacements.reduce((n, s) => n + s.QtyPick, 0),
    ).toBe(2);
    await expect(
      ng.close(
        value.Id,
        { requestId: randomUUID(), reason: 'Cancel', action: 'CANCEL' },
        'operator',
      ),
    ).rejects.toThrow('cannot be cancelled');
    await ng.close(
      value.Id,
      {
        requestId: randomUUID(),
        reason: 'Remaining component recovered',
        action: 'CLOSE',
      },
      'operator',
    );
    await assertNoOutstandingReplacement(db, releaseId);
    await expect(
      ng.create(
        {
          requestId: randomUUID(),
          forecastId: po,
          snapshotId: snapshot.Id,
          stage: 'Assembly',
          reason: 'Invalid excess',
          lines: [{ materialId: material, qtyNg: 100, qtyReplacement: 100 }],
        },
        'operator',
      ),
    ).rejects.toThrow('exceeds material issued');
    await expect(
      db.productionTraceEvent.updateMany({
        where: { ForecastId: po },
        data: { Actor: 'other' },
      }),
    ).rejects.toThrow('append-only');
  });

  it('keeps non-production outside PO usage and resolves renamed materials by stable identity', async () => {
    const before = await db.shopping.aggregate({
      where: { ForecastId: po },
      _sum: { QtyPick: true },
    });
    const dto = {
      requestId: randomUUID(),
      type: 'ADDITIONAL' as const,
      purpose: 'NON_PRODUCTION' as const,
      materialId: material,
      qtyPick: 1,
      destination: 'Maintenance',
      description: 'Tool repair',
    };
    const issue = await shopping.create(dto, 'operator');
    await shopping.create(dto, 'operator');
    expect(issue.ForecastId).toBeNull();
    expect(
      (
        await db.shopping.aggregate({
          where: { ForecastId: po },
          _sum: { QtyPick: true },
        })
      )._sum.QtyPick,
    ).toBe(before._sum.QtyPick);
    await expect(
      shopping.create(
        { ...dto, requestId: randomUUID(), description: '' },
        'operator',
      ),
    ).rejects.toThrow('destination and reason');
    await db.material.update({
      where: { Id: materialId },
      data: { PartNumber: material + '-renamed' },
    });
    const trace = await new TraceabilityService(db).get(po);
    expect(trace.materials[0].standardIssued).toBe(10);
    expect(trace.materials[0].replacementIssued).toBe(4);
    expect(trace.materials[0].materialNg).toBe(5);
    const pickingStatus = await shopping.getForecastPickingStatus(po);
    expect(pickingStatus.bomSummary[0].standardIssued).toBe(10);
    expect(pickingStatus.bomSummary[0].replacementIssued).toBe(4);
    expect(pickingStatus.bomSummary[0].materialNg).toBe(5);
    expect(trace.snapshot?.Lines[0].PartNumber).toBe(material);
    const snapshot = (await latestSnapshot(db, po, releaseId))!;
    const c = await ng.create(
      {
        requestId: randomUUID(),
        forecastId: po,
        snapshotId: snapshot.Id,
        stage: 'Assembly',
        reason: 'No replacement needed',
        lines: [{ materialId: material, qtyNg: 1, qtyReplacement: 0 }],
      },
      'operator',
    );
    expect(c.Details[0].MaterialId).toBe(material + '-renamed');
    await db.finishGood.update({
      where: { Id: fgId },
      data: { PartNumber: fg + '-renamed' },
    });
    await db.$transaction(async (tx) => {
      await lockProductionFlow(tx);
      await snapshotRelease(tx, releaseId, 'planner');
    });
    expect((await latestSnapshot(db, po, releaseId))?.Id).toBe(snapshot.Id);
  });

  it('rolls back a multi-PO snapshot operation when any BOM is unavailable', async () => {
    const missing = await db.finishGood.create({
      data: {
        PartNumber: `${prefix}-missing`,
        PartName: 'Missing BOM',
        CreatedBy: 'fixture',
      },
    });
    await db.forecast.create({
      data: {
        PoId: `${prefix}-bad`,
        PoNumber: prefix,
        FinishGoodId: missing.PartNumber,
        ProductionReleaseId: releaseId,
        Qty: 1,
        Date: new Date(),
        DeliveryDate: new Date(),
        VendorCode: 'TEST',
        VendorName: 'Test',
        ReceivingArea: 'Test',
        DeliveryPeriod: 1,
        Classification: 'Test',
        Item: 2,
      },
    });
    const count = await db.productionBomSnapshot.count();
    await expect(
      db.$transaction(async (tx) => {
        await lockProductionFlow(tx);
        await snapshotRelease(tx, releaseId, 'planner');
      }),
    ).rejects.toThrow('approved BOM');
    expect(await db.productionBomSnapshot.count()).toBe(count);
  });
});
