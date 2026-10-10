/* By Irfan Akbari Vuteq Indonesia - 2026-10-10 */
import type { Prisma, SapTransaction } from '../../generated/prisma/client';
import {
  aggregateCounting,
  captureCountingFinish,
  matchesCounting,
  prepareCounting,
} from './sap-counting';
import type { SapItemSyncService } from './sap-item-sync.service';
import { assertNoActiveInventoryCounting } from '../helpers/inventory-counting-check.helper';
import { ItemCategory } from '../../generated/prisma/enums';

const snapshot = {
  countingId: 'sto',
  reference: 'AIC-10102601',
  category: 'MATERIAL',
  date: '2026-10-10',
  time: '09:00:00',
  lines: [{ itemCode: 'SAP-MAT', parts: ['MAT'], before: 100, counted: 98 }],
};
function transaction(kind = 'INVENTORY_COUNTING'): SapTransaction {
  return {
    Id: 'event',
    Kind: kind,
    Warehouse: 'DMY-ANS',
    Snapshot: {
      ...snapshot,
      ...(kind === 'INVENTORY_COUNTING'
        ? {}
        : { rootId: 'root', dependencyId: 'dependency' }),
    },
  } as unknown as SapTransaction;
}
function document(counted = false) {
  return {
    DocumentEntry: 1,
    DocumentNumber: 20,
    DocObjectCodeEx: '1470000065',
    DocumentStatus: 'cdsOpen',
    Reference2: 'AIC10102601',
    Remarks: 'STO: AIC-10102601',
    InventoryCountingLines: [
      {
        LineNumber: 0,
        ItemCode: 'SAP-MAT',
        WarehouseCode: 'DMY-ANS',
        Freeze: 'tYES',
        Counted: counted ? 'tYES' : 'tNO',
        CountedQuantity: counted ? 98 : 0,
        InWarehouseQuantity: 100,
      },
    ],
  };
}
describe('SAP STO aggregation and evidence', () => {
  it('adds Warehouse, Rack and aliases once per SAP item', () => {
    const base = {
      FinishGoodId: null,
      SystemQty: 0,
      SystemQtyRack: 0,
      ActualQty: 0,
      ActualQtyRack: 0,
    };
    expect(
      aggregateCounting(
        [
          {
            ...base,
            MaterialId: 'A',
            Location: 'WAREHOUSE',
            SystemQty: 70,
            ActualQty: 68,
          },
          {
            ...base,
            MaterialId: 'A',
            Location: 'RACK',
            SystemQtyRack: 20,
            ActualQtyRack: 21,
          },
          {
            ...base,
            MaterialId: 'B',
            Location: 'WAREHOUSE',
            SystemQty: 10,
            ActualQty: 9,
          },
        ],
        new Map([
          ['A', 'SAP-MAT'],
          ['B', 'SAP-MAT'],
        ]),
        true,
      ),
    ).toEqual([
      { itemCode: 'SAP-MAT', parts: ['A', 'B'], before: 100, counted: 98 },
    ]);
  });
  it('rejects missing counts and duplicate locations', () => {
    const detail = {
      MaterialId: 'A',
      FinishGoodId: null,
      Location: 'RACK',
      SystemQty: 0,
      SystemQtyRack: 10,
      ActualQty: 0,
      ActualQtyRack: null,
    };
    expect(() =>
      aggregateCounting([detail], new Map([['A', 'X']]), true),
    ).toThrow('Complete');
    expect(() =>
      aggregateCounting([detail, detail], new Map([['A', 'X']]), false),
    ).toThrow('Duplicate');
  });
  it('requires freeze, identity, cutoff and status evidence', () => {
    expect(matchesCounting(transaction(), document())).toBe(true);
    for (const change of [
      { Reference2: 'foreign' },
      { DocumentStatus: 'cdsClosed' },
      {
        InventoryCountingLines: [
          { ...document().InventoryCountingLines[0], Freeze: 'tNO' },
        ],
      },
    ])
      expect(matchesCounting(transaction(), { ...document(), ...change })).toBe(
        false,
      );
  });
  it('only accepts the approved quantities and exact posting base', () => {
    const row = transaction('INVENTORY_POSTING');
    const doc = {
      Reference2: 'AIC10102601',
      Remarks: 'STO: AIC-10102601',
      InventoryPostingLines: [
        {
          ItemCode: 'SAP-MAT',
          WarehouseCode: 'DMY-ANS',
          BaseEntry: 1,
          BaseType: 1470000065,
          CountedQuantity: 98,
          Variance: -2,
          ActualPrice: 0,
          PostedValueLC: 0,
          PostedValueSC: 0,
        },
      ],
    };
    expect(matchesCounting(row, doc, 1)).toBe(true);
    expect(
      matchesCounting(
        row,
        {
          ...doc,
          Remarks: 'STO: AIC-10102601 Based On Inventory Counting 20',
        },
        1,
      ),
    ).toBe(true);
    expect(
      matchesCounting(
        row,
        {
          ...doc,
          Remarks: 'STO: AIC-10102602 Based On Inventory Counting 20',
        },
        1,
      ),
    ).toBe(false);
    for (const field of ['ActualPrice', 'PostedValueLC', 'PostedValueSC']) {
      expect(
        matchesCounting(
          row,
          {
            ...doc,
            InventoryPostingLines: [
              { ...doc.InventoryPostingLines[0], [field]: 1 },
            ],
          },
          1,
        ),
      ).toBe(false);
    }
    expect(matchesCounting(row, doc, 2)).toBe(false);
    expect(
      matchesCounting(
        row,
        {
          ...doc,
          InventoryPostingLines: [
            { ...doc.InventoryPostingLines[0], Variance: 2 },
          ],
        },
        1,
      ),
    ).toBe(false);
  });
  it('does not release the local stock barrier after local completion alone', async () => {
    const db = {
      sapTransaction: {
        findFirst: jest.fn().mockResolvedValue({ Id: 'root' }),
      },
      stockOpname: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    await expect(
      assertNoActiveInventoryCounting(db, ItemCategory.MATERIAL),
    ).rejects.toThrow('awaiting recovery');
    db.sapTransaction.findFirst.mockResolvedValue(null);
    await expect(
      assertNoActiveInventoryCounting(db, ItemCategory.MATERIAL),
    ).resolves.toBeUndefined();
  });
});

describe('SAP STO request preparation', () => {
  function fixture() {
    const readResource = jest.fn().mockImplementation((resource: string) =>
      Promise.resolve(
        resource.startsWith('Warehouses')
          ? { EnableBinLocations: 'tNO' }
          : resource.startsWith('Items')
            ? {
                InventoryItem: 'tYES',
                InventoryUOM: 'PCS',
                AvgStdPrice: 0,
                ItemWarehouseInfoCollection: [
                  { WarehouseCode: 'DMY-ANS', InStock: 100 },
                ],
              }
            : document(true),
      ),
    );
    const findUnique = jest.fn().mockResolvedValue({
      Id: 'root',
      PostedAt: new Date(),
      DocumentEntry: 1,
      Event: { Status: 'SUCCEEDED' },
    });
    return {
      readResource,
      findUnique,
      run: (kind: string, row = transaction(kind)) =>
        prepareCounting(
          {
            sapTransaction: { findUnique },
          } as unknown as Prisma.TransactionClient,
          { readResource } as unknown as SapItemSyncService,
          row,
        ),
    };
  }
  it('creates one frozen counting with the STO number in remarks', async () => {
    const result = await fixture().run('INVENTORY_COUNTING');
    expect(result.resource).toBe('InventoryCountings');
    expect(result.body).toMatchObject({
      Remarks: 'STO: AIC-10102601',
      InventoryCountingLines: [{ Freeze: 'tYES', WarehouseCode: 'DMY-ANS' }],
    });
  });
  it('posts the final absolute count against its verified base document', async () => {
    const result = await fixture().run('INVENTORY_POSTING');
    expect(result.body).toMatchObject({
      InventoryPostingLines: [
        {
          BaseEntry: 1,
          BaseLine: 0,
          BaseType: 1470000065,
          CountedQuantity: 98,
        },
      ],
    });
  });
  it('waits for dependencies and rejects external changes', async () => {
    const f = fixture();
    f.findUnique.mockResolvedValue(null);
    await expect(f.run('INVENTORY_POSTING')).rejects.toThrow('Waiting for');
    const g = fixture();
    g.readResource.mockResolvedValue({
      InventoryItem: 'tYES',
      InventoryUOM: 'PCS',
      AvgStdPrice: 0,
      ItemWarehouseInfoCollection: [{ WarehouseCode: 'DMY-ANS', InStock: 101 }],
    });
    await expect(g.run('INVENTORY_COUNTING')).rejects.toThrow('differs');
  });
  it('permits a zero-priced surplus only when the SAP company allows it', async () => {
    const f = fixture();
    const original = f.readResource.getMockImplementation()!;
    let allowed = false;
    f.readResource.mockImplementation((resource: string) => {
      if (resource === 'CompanyService_GetAdminInfo')
        return Promise.resolve({
          AllowInBoundPostingWithZeroPrice: allowed ? 'tYES' : 'tNO',
        });
      if (resource.startsWith('InventoryCountings')) {
        const doc = document(true);
        doc.InventoryCountingLines[0].CountedQuantity = 101;
        return Promise.resolve(doc);
      }
      return original(resource);
    });
    const row = transaction('INVENTORY_POSTING');
    row.Snapshot = {
      ...snapshot,
      rootId: 'root',
      dependencyId: 'dependency',
      lines: [{ ...snapshot.lines[0], counted: 101 }],
    };
    await expect(f.run('INVENTORY_POSTING', row)).rejects.toThrow(
      'Zero-price STO surplus is disabled',
    );
    allowed = true;
    const result = await f.run('INVENTORY_POSTING', row);
    expect(result.body).toMatchObject({
      PriceSource: 'ippsItemCost',
      InventoryPostingLines: [{ CountedQuantity: 101, Price: 0 }],
    });
  });
  it('rejects bin management rather than guessing the bin', async () => {
    const f = fixture();
    f.readResource.mockResolvedValue({ EnableBinLocations: 'tYES' });
    await expect(f.run('INVENTORY_COUNTING')).rejects.toThrow('bin');
  });
  it('rejects missing or nonzero inventory cost, including warehouse costing', async () => {
    for (const costing of [
      { AvgStdPrice: null },
      { AvgStdPrice: 10 },
      { AvgStdPrice: 0, ManageStockByWarehouse: 'tYES' },
    ]) {
      const f = fixture();
      const original = f.readResource.getMockImplementation()!;
      f.readResource.mockImplementation(async (resource: string) => {
        const result = await original(resource);
        return resource.startsWith('Items')
          ? { ...result, ...costing }
          : result;
      });
      await expect(f.run('INVENTORY_POSTING')).rejects.toThrow(
        'zero inventory cost',
      );
    }
  });
});

describe('SAP STO cancellation', () => {
  function fixture(code: string | null, submitted: unknown = null) {
    const root = {
      ...transaction(),
      SourceKey: 'sto:sto:start',
      PostedAt: null,
      SubmittedRequest: submitted,
      Event: { Status: 'FAILED', LastErrorCode: code, UpdatedAt: new Date() },
    };
    const db = {
      sapTransaction: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: { SourceKey?: string } }) =>
            Promise.resolve(where.SourceKey === 'sto:sto:start' ? root : null),
          ),
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: unknown }) =>
            Promise.resolve(data),
          ),
      },
      outboxEvent: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
      sapConnectionState: { findUnique: jest.fn().mockResolvedValue(null) },
      logProcess: { create: jest.fn() },
      actionAuditEvent: { create: jest.fn() },
    };
    return {
      db,
      run: () =>
        captureCountingFinish(
          db as unknown as Prisma.TransactionClient,
          'sto',
          'test',
          true,
        ),
    };
  }
  it('cancels a definitely unsent request with a compare-and-swap and audit', async () => {
    const f = fixture('SAP_BLOCKED');
    await f.run();
    expect(f.db.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ReferenceType: 'STOCK_OPNAME',
          LastErrorCode: 'SAP_COUNTING_CANCELLED',
        }),
      }),
    );
    expect(f.db.sapTransaction.create).not.toHaveBeenCalled();
    expect(f.db.logProcess.create).toHaveBeenCalled();
  });
  it('keeps uncertain requests held and creates a dependent close', async () => {
    const f = fixture('OUTBOX_DELIVERY_UNCERTAIN', {
      resource: 'InventoryCountings',
    });
    await f.run();
    expect(f.db.outboxEvent.updateMany).not.toHaveBeenCalled();
    expect(f.db.sapTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          Kind: 'COUNTING_CLOSE',
          Snapshot: expect.objectContaining({
            rootId: 'event',
            cancelled: true,
          }),
        }),
      }),
    );
  });
});
