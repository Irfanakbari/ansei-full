// These unit tests inject frozen requirement fixtures; real snapshot persistence is exercised by phase-one.database.spec.ts.
jest.mock('./bom-snapshot.helper', () => ({
  ...jest.requireActual('./bom-snapshot.helper'),
  snapshotBomEntries: (tx: {
    snapshotRequirements: { findMany: () => Promise<unknown> };
  }) => tx.snapshotRequirements.findMany(),
}));
import { assertLabelReady, isShoppingComplete } from './production-flow.helper';
import type { Prisma } from '../../generated/prisma/client';

describe('production flow prerequisites', () => {
  const label = {
    Id: 1,
    ForecastId: 'PO-1',
    ProductionReleaseId: 'REL-1',
    FinishGoodId: 'FG-1',
    Scanned: true,
    QtyThisBox: 201,
  };
  const forecast = {
    PoId: 'PO-1',
    Qty: 201,
    FinishGoodId: 'FG-1',
    ProductionReleaseId: 'REL-1',
    ProductionRelease: { Status: 'RELEASED' },
  };
  const mocks = {
    assemblySession: { findFirst: jest.fn() },
    labelData: { findUnique: jest.fn() },
    forecast: { findUnique: jest.fn() },
    snapshotRequirements: { findMany: jest.fn() },
    shopping: { findMany: jest.fn() },
    deliveryHistory: { findUnique: jest.fn() },
    inventoryLedger: { aggregate: jest.fn() },
  };
  const tx = mocks as unknown as Prisma.TransactionClient;
  beforeEach(() => {
    jest.resetAllMocks();
    mocks.labelData.findUnique.mockResolvedValue(label);
    mocks.forecast.findUnique.mockResolvedValue(forecast);
    mocks.snapshotRequirements.findMany.mockResolvedValue([
      { Qty: 1, MaterialData: { PartNumber: 'MAT-1' } },
    ]);
    mocks.shopping.findMany.mockResolvedValue([
      { Id: 'SHP-1', MaterialId: 'MAT-1', QtyPick: 201 },
    ]);
    mocks.deliveryHistory.findUnique.mockResolvedValue(null);
    mocks.inventoryLedger.aggregate.mockResolvedValue({ _sum: { QtyIn: 201 } });
  });

  it('blocks assy labels even when shopping already has a full forecast result', async () => {
    mocks.labelData.findUnique.mockResolvedValue({
      ...label,
      RequiresAssembly: true,
    });
    await expect(assertLabelReady(tx, 1, false)).rejects.toThrow(
      'Assembly must be completed',
    );
  });
  it('allows only the completed box using its own ledger evidence', async () => {
    mocks.labelData.findUnique.mockResolvedValue({
      ...label,
      RequiresAssembly: true,
      QtyThisBox: 5,
    });
    mocks.assemblySession.findFirst.mockResolvedValue({ Id: 'session' });
    mocks.inventoryLedger.aggregate.mockResolvedValue({ _sum: { QtyIn: 5 } });
    await expect(assertLabelReady(tx, 1, false)).resolves.toBeDefined();
    expect(mocks.inventoryLedger.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ReferenceDoc: 'ASSY-session' }),
      }),
    );
  });
  it('rejects completed sessions missing stock evidence', async () => {
    mocks.labelData.findUnique.mockResolvedValue({
      ...label,
      RequiresAssembly: true,
    });
    mocks.assemblySession.findFirst.mockResolvedValue({ Id: 'session' });
    mocks.inventoryLedger.aggregate.mockResolvedValue({ _sum: { QtyIn: 0 } });
    await expect(assertLabelReady(tx, 1, false)).rejects.toThrow(
      'stock result',
    );
  });
  it('rejects rounded 100% and prevents excess material hiding a shortage', () => {
    expect(Math.round((200 / 201) * 100)).toBe(100);
    expect(
      isShoppingComplete({
        requirements: [
          { qtyNeeded: 200, qtyPicked: 200 },
          { qtyNeeded: 1, qtyPicked: 0 },
        ],
      }),
    ).toBe(false);
    expect(
      isShoppingComplete({
        requirements: [
          { qtyNeeded: 200, qtyPicked: 201 },
          { qtyNeeded: 1, qtyPicked: 0 },
        ],
      }),
    ).toBe(false);
    expect(isShoppingComplete({ requirements: [] })).toBe(false);
  });

  it('accepts completed shopping with forecast-specific production ledger evidence', async () => {
    await expect(assertLabelReady(tx, 1, true)).resolves.toEqual({
      label,
      forecast,
    });
    expect(mocks.inventoryLedger.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          FinishGoodId: 'FG-1',
          TransactionType: 'PRODUCTION_RESULT',
          ReferenceDoc: { in: ['PROD-SHP-1'] },
        }),
      }),
    );
  });

  it.each(['DRAFT', 'COMPLETED', 'CANCELLED'])(
    'rejects a %s release during the write transaction',
    async (status) => {
      mocks.forecast.findUnique.mockResolvedValue({
        ...forecast,
        ProductionRelease: { Status: status },
      });
      await expect(assertLabelReady(tx, 1, false)).rejects.toThrow('RELEASED');
    },
  );

  it.each([null, { ...label, Scanned: false }])(
    'rejects delivery of a missing or unscanned label',
    async (value) => {
      mocks.labelData.findUnique.mockResolvedValue(value);
      await expect(assertLabelReady(tx, 1, true)).rejects.toThrow('POKAYOKE');
    },
  );

  it.each([
    { ...label, ProductionReleaseId: 'OTHER' },
    { ...label, FinishGoodId: 'OTHER' },
    { ...label, QtyThisBox: 0 },
  ])('rejects stale label association or invalid quantity', async (value) => {
    mocks.labelData.findUnique.mockResolvedValue(value);
    await expect(assertLabelReady(tx, 1, false)).rejects.toThrow('RELEASED');
  });

  it('rejects incomplete material picking inside the transaction', async () => {
    mocks.shopping.findMany.mockResolvedValue([
      { Id: 'SHP-1', MaterialId: 'MAT-1', QtyPick: 200 },
    ]);
    await expect(assertLabelReady(tx, 1, false)).rejects.toThrow(
      'every BOM material',
    );
  });

  it('rejects an empty BOM', async () => {
    mocks.snapshotRequirements.findMany.mockResolvedValue([]);
    await expect(assertLabelReady(tx, 1, false)).rejects.toThrow(
      'every BOM material',
    );
  });

  it.each([null, 0, 200])(
    'rejects missing or insufficient production result %s',
    async (qty) => {
      mocks.inventoryLedger.aggregate.mockResolvedValue({
        _sum: { QtyIn: qty },
      });
      await expect(assertLabelReady(tx, 1, false)).rejects.toThrow(
        'production result',
      );
    },
  );
});
