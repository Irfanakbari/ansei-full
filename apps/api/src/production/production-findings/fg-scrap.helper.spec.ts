/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import type { Prisma, ProductionFinding } from '../../generated/prisma/client';
import { approveFgScrap, pickScrapReplacement } from './fg-scrap.helper';
import {
  createSapLedger,
  captureSapIntent,
  sapCaptureEnabled,
} from '../../common/sap/sap-transaction-capture';

jest.mock('../../common/sap/sap-transaction-capture', () => ({
  createSapLedger: jest.fn(),
  sapCaptureEnabled: jest.fn(),
  captureSapIntent: jest.fn(),
  sapScope: () => ({ company: 'TEST', warehouse: 'TRIAL' }),
  sapAudit: jest.fn(),
}));

describe('FG scrap inventory and label boundaries', () => {
  function fixture(received = true) {
    const label = {
      Id: 1,
      LabelNumber: 'DEM00100010',
      ProductionDemandId: 'DEM',
      ProductionReleaseId: 'REL',
      FinishGoodId: 'FG',
      QtyThisBox: 10,
      RequiresAssembly: true,
      InvalidatedAt: null,
      Scanned: false,
      DeliveryHistory: null as object | null,
      AssemblySessions: received ? [{ Status: 'COMPLETED' }] : [],
    };
    const db = {
      $executeRaw: jest.fn(),
      labelData: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(label),
        findMany: jest.fn().mockResolvedValue([label]),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ Id: 3 }),
      },
      productionBomSnapshot: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          Lines: [
            { Id: 'line', PartNumber: 'MAT', QtyPerUnit: 2, RequiredQty: 20 },
          ],
        }),
      },
      finishGood: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ Qty: 10 }),
        update: jest.fn(),
      },
      inventoryLedger: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { QtyIn: 10, QtyOut: 0 } }),
      },
      shopping: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ MaterialId: 'MAT', QtyPick: 20 }]),
      },
      productionFindingComponent: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      productionFinding: { update: jest.fn(), findUniqueOrThrow: jest.fn() },
      productionRelease: { update: jest.fn() },
      sapTransaction: {
        findFirst: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(
            where.Kind === 'INVENTORY_COUNTING'
              ? null
              : {
                  Id: 'order',
                  Snapshot: {
                    components: [{ itemCode: 'SAP-MAT', perUnit: 2 }],
                  },
                },
          ),
        ),
      },
      sapBackflushPick: { create: jest.fn() },
    };
    const finding = {
      Id: 'finding',
      LabelId: 1,
      SnapshotId: 'bom',
      ProductionDemandId: 'DEM',
      Qty: 2,
    } as ProductionFinding;
    return {
      db,
      label,
      finding,
      tx: db as unknown as Prisma.TransactionClient,
    };
  }
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(sapCaptureEnabled).mockReturnValue(false);
  });
  it('captures pre-receipt scrap once and removes it from pending backflush', async () => {
    const f = fixture(false);
    jest.mocked(sapCaptureEnabled).mockReturnValue(true);
    await approveFgScrap(f.tx, f.finding, 'operator');
    expect(captureSapIntent).toHaveBeenCalledTimes(1);
    expect(captureSapIntent).toHaveBeenCalledWith(
      f.tx,
      expect.objectContaining({
        kind: 'GOODS_ISSUE',
        itemCode: 'SAP-MAT',
        quantity: 4,
        effects: [{ itemCode: 'SAP-MAT', quantity: -4 }],
      }),
      'operator',
    );
    expect(f.db.sapBackflushPick.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ItemCode: 'SAP-MAT',
        Quantity: -4,
        DemandId: 'DEM',
      }),
    });
    expect(createSapLedger).not.toHaveBeenCalled();
    expect(f.db.finishGood.update).not.toHaveBeenCalled();
  });
  it('removes the old quality count when splitting an already scanned box', async () => {
    const f = fixture();
    f.label.Scanned = true;
    await approveFgScrap(f.tx, f.finding, 'operator');
    expect(f.db.labelData.update).toHaveBeenCalledWith({
      where: { Id: 1 },
      data: { InvalidatedAt: expect.any(Date), Scanned: false },
    });
    expect(f.db.productionRelease.update).toHaveBeenCalledWith({
      where: { Id: 'REL' },
      data: { TotalGoodQty: { decrement: 10 } },
    });
  });
  it('post-receipt scrap issues only FG and creates a produced remainder plus a replacement label', async () => {
    const f = fixture();
    await approveFgScrap(f.tx, f.finding, 'operator');
    expect(createSapLedger).toHaveBeenCalledTimes(1);
    expect(createSapLedger).toHaveBeenCalledWith(
      f.tx,
      {
        data: expect.objectContaining({
          FinishGoodId: 'FG',
          TransactionType: 'NG_SCRAP',
          QtyOut: 2,
          BalanceBefore: 10,
          BalanceAfter: 8,
        }),
      },
      'DEM',
    );
    expect(f.db.labelData.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        QtyThisBox: 8,
        StockSourceLabelId: 1,
        ReplacementFindingId: null,
      }),
    });
    expect(f.db.labelData.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        QtyThisBox: 2,
        StockSourceLabelId: null,
        ReplacementFindingId: 'finding',
      }),
    });
    expect(f.db.productionFindingComponent.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ MaterialId: 'MAT', Qty: 4 })],
    });
  });
  it('pre-receipt scrap never reduces MES components twice or receives failed FG', async () => {
    const f = fixture(false);
    await approveFgScrap(f.tx, f.finding, 'operator');
    expect(createSapLedger).not.toHaveBeenCalled();
    expect(f.db.finishGood.update).not.toHaveBeenCalled();
    expect(f.db.productionFinding.update).toHaveBeenCalledWith({
      where: { Id: 'finding' },
      data: expect.objectContaining({ Disposition: 'SCRAP_BEFORE_RECEIPT' }),
    });
  });
  it('delivered FG requires return before scrap', async () => {
    const f = fixture();
    f.label.DeliveryHistory = { Id: 1 };
    await expect(approveFgScrap(f.tx, f.finding, 'operator')).rejects.toThrow(
      'Customer Return',
    );
    expect(createSapLedger).not.toHaveBeenCalled();
  });
  it('rejects FG stock/cache disagreement before any stock mutation', async () => {
    const f = fixture();
    f.db.finishGood.findUniqueOrThrow.mockResolvedValue({ Qty: 9 });
    await expect(approveFgScrap(f.tx, f.finding, 'operator')).rejects.toThrow(
      'differs from the ledger',
    );
    expect(createSapLedger).not.toHaveBeenCalled();
  });
  it('rejects replacement over-picking before a second material consumption', async () => {
    const f = fixture();
    f.db.productionFinding.findUniqueOrThrow.mockResolvedValue({
      Disposition: 'SCRAP_AFTER_RECEIPT',
      Status: 'WAITING_PART_CHANGE',
      ProductionDemandId: 'DEM',
      Components: [{ Id: 'component', Qty: 4, Allocations: [{ Qty: 3 }] }],
    });
    await expect(
      pickScrapReplacement(f.tx, 'finding', 'component', 2, 'operator'),
    ).rejects.toThrow('remaining replacement');
    expect(createSapLedger).not.toHaveBeenCalled();
  });
});
