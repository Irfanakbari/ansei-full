/* By Irfan Akbari Vuteq Indonesia - 2026-10-06 */
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ProductionDashboardController } from './production-dashboard.controller';
import {
  buildDashboardRelease,
  DashboardReleaseSource,
  ProductionDashboardService,
  productionDashboardSelect,
} from './production-dashboard.service';

const now = new Date('2026-10-06T03:30:00Z'); // 10:30 WIB
type Order = DashboardReleaseSource['Forecasts'][number];
function order(poId: string, period = 1, shipped = 0): Order {
  return {
    PoId: poId,
    Qty: 20,
    FinishGoodId: 'FG-TEST',
    DeliveryPeriod: period,
    DeliveryDate: new Date('2026-10-06T00:00:00Z'),
    PartData: { PartName: 'Test part' },
    BomSnapshots: [
      {
        ReleaseId: 'release-a',
        TargetQty: 20,
        Lines: [
          { Id: 'line', RequiredQty: 40, Material: { PartNumber: 'MAT-TEST' } },
        ],
      },
    ],
    Shopping: [{ Id: `pick-${poId}`, QtyPick: 40, MaterialId: 'MAT-TEST' }],
    LabelData: [1, 2].map((n) => ({
      LabelNumber: `${poId}-${n}`,
      QtyThisBox: 10,
      Scanned: true,
      RequiresAssembly: false,
      AssemblySessions: [],
    })),
    DeliveryHistory: Array.from({ length: shipped }, (_, n) => ({
      ProductionDemandId: poId,
      LabelDataId: `${poId}-${n + 1}`,
      Qty: 10,
      CreatedAt: now,
    })),
  };
}
function release(orders: Order[]): DashboardReleaseSource {
  return {
    Id: 'release-a',
    ReleaseNumber: 'PR-TEST-A',
    PlanDate: now,
    Forecasts: orders,
    ProductionFindings: [],
  };
}
const output = (poId: string, qty = 20, date = now) => ({
  ReferenceDoc: `PROD-pick-${poId}`,
  FinishGoodId: 'FG-TEST',
  QtyIn: qty,
  TransactionDate: date,
});

describe('production dashboard calculations', () => {
  it('keeps scans, shipped quantities and fully shipped PO distinct', () => {
    const result = buildDashboardRelease(
      release([order('PO-1', 1, 1), order('PO-2', 1, 2)]),
      [output('PO-1'), output('PO-2')],
      now,
    );
    expect(result.metrics).toMatchObject({
      poCount: 2,
      planQty: 40,
      producedQty: 40,
      deliveredQty: 30,
      completedPo: 1,
      partialPo: 1,
      remainingQty: 10,
      validatedLabels: 4,
      deliveredLabels: 3,
      awaitingDeliveryQty: 10,
      issuePo: 0,
    });
    expect(result.orders[0].deliveryComplete).toBe(false);
  });

  it('handles cycle gaps, all PO in each cycle and independent releases', () => {
    const orders = [
      order('A', 1, 2),
      order('B', 1, 1),
      order('C', 2),
      order('D', 4),
      order('E', 6),
    ];
    const before = buildDashboardRelease(
      release(orders),
      orders.map((o) => output(o.PoId)),
      now,
    );
    expect(
      before.cycles.map((c) => [c.period, c.status, c.blockedByPeriod]),
    ).toEqual([
      [1, 'CURRENT', null],
      [2, 'BLOCKED', 1],
      [4, 'BLOCKED', 1],
      [6, 'BLOCKED', 1],
    ]);
    expect(before.metrics.cycleBlockedQty).toBe(60);
    orders[1] = order('B', 1, 2);
    orders[2] = order('C', 2, 2);
    const after = buildDashboardRelease(release(orders), [], now);
    expect(after.cycles.map((c) => c.status)).toEqual([
      'COMPLETE',
      'COMPLETE',
      'CURRENT',
      'BLOCKED',
    ]);
    expect(after.cycles[3].blockedByPeriod).toBe(4);
    const other = release([order('OTHER', 6)]);
    other.Id = 'release-b';
    expect(buildDashboardRelease(other, [], now).cycles[0].status).toBe(
      'CURRENT',
    );
  });

  it.each(['missing', 'quantity', 'record'] as const)(
    'flags %s labels/history without claiming delivery complete',
    (kind) => {
      const po = order('PO', 1, 2);
      if (kind === 'missing') po.LabelData = [];
      if (kind === 'quantity') po.LabelData[0].QtyThisBox = 9;
      if (kind === 'record') po.DeliveryHistory[0].Qty = 9;
      const result = buildDashboardRelease(release([po]), [output('PO')], now);
      expect(result.metrics.completedPo).toBe(0);
      expect(result.metrics.issuePo).toBe(1);
      expect(result.cycles[0].status).toBe('CURRENT');
    },
  );

  it('requires each released BOM material, even when aggregate picking is excessive', () => {
    const po = order('PO');
    po.BomSnapshots.unshift({
      ReleaseId: 'old-release',
      TargetQty: 20,
      Lines: [
        { Id: 'old', RequiredQty: 1, Material: { PartNumber: 'MAT-TEST' } },
      ],
    });
    po.BomSnapshots[1].Lines.push({
      Id: 'second',
      RequiredQty: 10,
      Material: { PartNumber: 'MAT-SECOND' },
    });
    po.Shopping[0].QtyPick = 1000;
    expect(
      buildDashboardRelease(release([po]), [], now).orders[0].shoppingStatus,
    ).toBe('IN_PROGRESS');
    po.Shopping.push({
      Id: 'pick-second',
      MaterialId: 'MAT-SECOND',
      QtyPick: 10,
    });
    expect(
      buildDashboardRelease(release([po]), [], now).orders[0].shoppingStatus,
    ).toBe('COMPLETE');
    po.BomSnapshots = [];
    expect(
      buildDashboardRelease(release([po]), [], now).orders[0].shoppingStatus,
    ).toBe('UNAVAILABLE');
  });

  it('attributes completed assembly ledger only and counts running boxes separately', () => {
    const po = order('PO');
    po.LabelData.forEach((label) => {
      label.RequiresAssembly = true;
    });
    po.LabelData[0].AssemblySessions = [{ Id: 'done', Status: 'COMPLETED' }];
    po.LabelData[1].AssemblySessions = [
      { Id: 'running', Status: 'IN_PROGRESS' },
    ];
    const result = buildDashboardRelease(
      release([po]),
      [
        { ...output('PO', 10), ReferenceDoc: 'ASSY-done' },
        { ...output('PO', 10), ReferenceDoc: 'ASSY-running' },
        {
          ...output('PO', 999),
          ReferenceDoc: 'ASSY-done',
          FinishGoodId: 'OTHER-FG',
        },
        output('UNRELATED', 999),
      ],
      now,
    );
    expect(result.metrics).toMatchObject({
      producedQty: 10,
      assemblyLabels: 2,
      assemblyComplete: 1,
      assemblyRunning: 1,
      directFlowPo: 0,
    });
    expect(result.orders[0].productionStatus).toBe('IN_PROGRESS');
  });

  it('uses WIB day boundaries for overdue and hourly quantities', () => {
    const po = order('PO', 1, 1);
    po.DeliveryDate = new Date('2026-10-05T17:00:00Z'); // today WIB
    po.DeliveryHistory[0].CreatedAt = new Date('2026-10-05T17:05:00Z');
    const result = buildDashboardRelease(
      release([po]),
      [
        output('PO', 10, new Date('2026-10-05T16:59:00Z')),
        output('PO', 10, new Date('2026-10-05T17:00:00Z')),
      ],
      now,
    );
    expect(result.metrics.overduePo).toBe(0);
    expect(result.metrics.producedQty).toBe(20);
    expect(result.hourly).toHaveLength(11);
    expect(result.hourly[0]).toEqual({
      hour: '00:00',
      producedQty: 10,
      deliveredQty: 10,
    });
    po.DeliveryDate = new Date('2026-10-05T00:00:00Z');
    expect(buildDashboardRelease(release([po]), [], now).metrics).toMatchObject(
      { overduePo: 1, overdueQty: 10 },
    );
  });

  it('retains abnormal actual quantities and surfaces review instead of hiding them', () => {
    const po = order('PO', 1, 2);
    po.DeliveryHistory[0].Qty = 15;
    const result = buildDashboardRelease(release([po]), [output('PO')], now);
    expect(result.metrics).toMatchObject({
      deliveredQty: 25,
      planQty: 20,
      remainingQty: 0,
      completedPo: 0,
      issuePo: 1,
    });
  });
});

describe('public production dashboard query', () => {
  it('reads active releases and production ledger in one repeatable snapshot, with no writes', async () => {
    const tx = {
      productionRelease: {
        findMany: jest.fn().mockResolvedValue([release([order('PO', 1, 1)])]),
      },
      inventoryLedger: {
        findMany: jest.fn().mockResolvedValue([output('PO')]),
      },
      stockOpname: {
        findMany: jest.fn().mockResolvedValue([{ Category: 'FINISH_GOOD' }]),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new ProductionDashboardService(
      prisma as unknown as PrismaService,
    );
    const result = await service.getDashboard();
    expect(tx.productionRelease.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { Status: 'RELEASED' },
        select: productionDashboardSelect,
      }),
    );
    expect(tx.inventoryLedger.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ItemCategory: 'FINISH_GOOD',
          Location: 'FINISH_GOOD_AREA',
          TransactionType: 'PRODUCTION_RESULT',
          ReferenceDoc: { in: ['PROD-pick-PO'] },
        },
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
      timeout: 15000,
    });
    expect(result.metrics.deliveredQty).toBe(10);
    expect(result.inventoryHolds).toEqual(['FINISH_GOOD']);
    const publicData = JSON.stringify(result);
    for (const privateField of [
      'ManPower',
      'CreatedBy',
      'Supplier',
      'Price',
      'Password',
      'Token',
      'DeliveryHistory',
      'Shopping',
    ])
      expect(publicData).not.toContain(`"${privateField}`);
    expect(productionDashboardSelect.Forecasts.select.Shopping.where).toEqual({
      Purpose: 'STANDARD',
    });
    expect(productionDashboardSelect.ProductionFindings.where).toEqual({
      DeletedAt: null,
      Status: { in: ['PENDING', 'WAITING_PART_CHANGE'] },
    });
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        ProductionDashboardController.prototype.getDashboard,
      ),
    ).toBe(true);
  });

  it('returns a usable zero state and skips the ledger query when no release is active', async () => {
    const tx = {
      productionRelease: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryLedger: { findMany: jest.fn() },
      stockOpname: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const prisma = {
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    };
    const result = await new ProductionDashboardService(
      prisma as unknown as PrismaService,
    ).getDashboard();
    expect(result.releases).toEqual([]);
    expect(result.metrics).toMatchObject({
      planQty: 0,
      deliveredQty: 0,
      releaseCount: 0,
    });
    expect(tx.inventoryLedger.findMany).not.toHaveBeenCalled();
  });
});
