// These unit tests inject frozen requirement fixtures; real snapshot persistence is exercised by phase-one.database.spec.ts.
jest.mock('../../common/helpers/bom-snapshot.helper', () => ({
  ...jest.requireActual('../../common/helpers/bom-snapshot.helper'),
  snapshotBomEntries: (tx: {
    snapshotRequirements: { findMany: () => Promise<unknown> };
  }) => tx.snapshotRequirements.findMany(),
}));
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { OutboxService } from '../../common/outbox/outbox.service';

describe('DeliveryService', () => {
  let service: DeliveryService;
  let prismaService: any;
  let logService: any;
  let outboxService: any;

  const createMockTx = () => ({
    productionFinding: { findFirst: jest.fn().mockResolvedValue(null) },
    productionTraceEvent: { create: jest.fn() },
    $executeRaw: jest.fn(),
    assemblySession: { findFirst: jest.fn().mockResolvedValue(null) },
    labelData: {
      findUnique: jest.fn().mockResolvedValue({
        Id: 1,
        LabelNumber: 'LBL001',
        ProductionDemandId: 'PO-001',
        FinishGoodId: 'FG-001',
        ProductionReleaseId: 'release-1',
        Scanned: true,
        QtyThisBox: 100,
      }),
    },
    productionOrder: {
      findUnique: jest.fn().mockResolvedValue({
        PoId: 'PO-001',
        FinishGoodId: 'FG-001',
        Qty: 100,
        DeliveryPeriod: 1,
        ProductionReleaseId: 'release-1',
        ProductionRelease: { Status: 'RELEASED', ReleaseNumber: 'PR-001' },
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    snapshotRequirements: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ Qty: 1, MaterialData: { PartNumber: 'MAT-1' } }]),
    },
    shopping: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { Id: 'SHP-1', MaterialId: 'MAT-1', QtyPick: 100 },
        ]),
    },
    deliveryHistory: {
      create: jest.fn(),
      findUnique: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { Qty: 0 } }),
    },
    finishGood: { findUnique: jest.fn(), update: jest.fn() },
    inventoryLedger: {
      create: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { QtyIn: 100 } }),
    },
  });

  const mockPrismaService = {
    labelData: { findUnique: jest.fn() },
    productionOrder: { findUnique: jest.fn() },
    finishGood: { findUnique: jest.fn() },
    productionRelease: { findUnique: jest.fn() },
    snapshotRequirements: { findMany: jest.fn() },
    shopping: { findMany: jest.fn() },
    deliveryHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    inventoryLedger: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    sapTransaction: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(),
  };

  const mockLogService = {
    startProcess: jest.fn(),
    addLog: jest.fn(),
    completeProcess: jest.fn(),
  };

  const mockOutboxService = {
    create: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LogProcessService, useValue: mockLogService },
        { provide: OutboxService, useValue: mockOutboxService },
      ],
    }).compile();

    service = module.get<DeliveryService>(DeliveryService);
    prismaService = mockPrismaService;
    logService = mockLogService;
    outboxService = mockOutboxService;
    jest.clearAllMocks();
  });

  describe('create', () => {
    const mockProcess = { ProcessId: 'PR123', ProcessStart: new Date() };

    const priorForecast = (
      period: number,
      poId: string,
      labelQuantities: number[],
      deliveredLabels: number,
      targetQty = 100,
    ) => ({
      PoId: poId,
      Qty: targetQty,
      DeliveryPeriod: period,
      LabelData: labelQuantities.map((qty, index) => ({
        LabelNumber: `${poId}-LBL-${index + 1}`,
        QtyThisBox: qty,
        ProductionReleaseId: 'release-1',
      })),
      DeliveryHistory: labelQuantities
        .slice(0, deliveredLabels)
        .map((qty, index) => ({
          ProductionDemandId: poId,
          LabelDataId: `${poId}-LBL-${index + 1}`,
          Qty: qty,
        })),
    });

    const setupReadyDelivery = (period: number) => {
      mockPrismaService.labelData.findUnique.mockResolvedValue({
        Id: 1,
        LabelNumber: 'LBL001',
        ProductionDemandId: 'PO-001',
        FinishGoodId: 'FG-001',
        QtyThisBox: 100,
        Scanned: true,
      });
      mockPrismaService.productionOrder.findUnique.mockResolvedValue({
        PoId: 'PO-001',
        FinishGoodId: 'FG-001',
        Qty: 100,
        DeliveryPeriod: period,
        ProductionReleaseId: 'release-1',
      });
      mockPrismaService.productionRelease.findUnique.mockResolvedValue({
        Id: 'release-1',
        ReleaseNumber: 'PR-001',
        Status: 'RELEASED',
      });
      mockPrismaService.snapshotRequirements.findMany.mockResolvedValue([]);
      mockPrismaService.shopping.findMany.mockResolvedValue([]);
      mockPrismaService.deliveryHistory.findFirst.mockResolvedValue(null);
      const tx = createMockTx();
      tx.productionOrder.findUnique.mockResolvedValue({
        PoId: 'PO-001',
        FinishGoodId: 'FG-001',
        Qty: 100,
        DeliveryPeriod: period,
        ProductionReleaseId: 'release-1',
        ProductionRelease: { Status: 'RELEASED', ReleaseNumber: 'PR-001' },
      });
      tx.deliveryHistory.findUnique.mockResolvedValue(null);
      tx.deliveryHistory.create.mockResolvedValue({
        Id: 1,
        ProductionDemandId: 'PO-001',
        Qty: 100,
        LabelDataId: 'LBL001',
      });
      tx.finishGood.findUnique.mockResolvedValue({
        PartNumber: 'FG-001',
        Qty: 200,
      });
      mockPrismaService.$transaction.mockImplementation(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      );
      return tx;
    };

    beforeEach(() => {
      mockLogService.startProcess.mockResolvedValue(mockProcess as any);
      mockLogService.addLog.mockResolvedValue({} as any);
      mockLogService.completeProcess.mockResolvedValue(undefined);
    });

    it('should create delivery successfully', async () => {
      const dto = { labelNumber: 'LBL001' };
      const mockLabelData = {
        Id: 1,
        LabelNumber: 'LBL001',
        ProductionDemandId: 'NPO-001',
        FinishGoodId: 'FG-001',
        QtyThisBox: 100,
        Scanned: true,
        PartData: { PartNumber: 'FG-001', PartName: 'Finish Good A' },
        POData: { PoId: 'NPO-001', SourceType: 'NON_PO', PoNumber: '' },
      };
      const mockForecast = {
        PoId: 'NPO-001',
        FinishGoodId: 'FG-001',
        Qty: 10,
        ProductionReleaseId: 'release-1',
      };
      const mockProductionRelease = {
        Id: 'release-1',
        ReleaseNumber: 'PR-001',
        Status: 'RELEASED',
      };
      const mockFinishGood = { PartNumber: 'FG-001', Qty: 150 };
      const mockDelivery = { Id: 1, ProductionDemandId: 'NPO-001', Qty: 100 };

      mockPrismaService.labelData.findUnique.mockResolvedValue(mockLabelData);
      mockPrismaService.productionOrder.findUnique.mockResolvedValue(
        mockForecast,
      );
      mockPrismaService.productionRelease.findUnique.mockResolvedValue(
        mockProductionRelease,
      );
      mockPrismaService.snapshotRequirements.findMany.mockResolvedValue([]);
      mockPrismaService.shopping.findMany.mockResolvedValue([]);
      mockPrismaService.finishGood.findUnique.mockResolvedValue(mockFinishGood);
      mockPrismaService.deliveryHistory.findFirst.mockResolvedValue(null); // No duplicate

      const mockTx = createMockTx();
      mockTx.deliveryHistory.create.mockResolvedValue(mockDelivery);
      mockTx.deliveryHistory.findUnique.mockResolvedValue(null);
      mockTx.finishGood.findUnique.mockResolvedValue(mockFinishGood);
      mockTx.finishGood.update.mockResolvedValue({});
      mockTx.inventoryLedger.create.mockResolvedValue({});

      mockPrismaService.$transaction.mockImplementation((callback) => {
        return callback(mockTx);
      });

      const result = await service.create(dto, 'admin');

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        forecastId: 'NPO-001',
        demandId: 'NPO-001',
        referenceNumber: 'NPO-001',
        sourceType: 'NON_PO',
        poNumber: null,
      });
      expect(mockPrismaService.labelData.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { LabelNumber: 'LBL001' } }),
      );
      expect(mockTx.labelData.findUnique).toHaveBeenCalledWith({
        where: { Id: 1 },
      });
    });

    it('should create delivery with palletNumber and enqueue outbox event', async () => {
      const dto = { labelNumber: 'LBL001', palletNumber: 'PP2PANS001' };
      const mockLabelData = {
        Id: 1,
        LabelNumber: 'LBL001',
        ProductionDemandId: 'PO-001',
        FinishGoodId: 'FG-001',
        QtyThisBox: 100,
        Scanned: true,
      };
      const mockForecast = {
        PoId: 'PO-001',
        FinishGoodId: 'FG-001',
        VendorName: 'Vendor A',
        Qty: 100,
        ProductionReleaseId: 'release-1',
      };
      const mockProductionRelease = {
        Id: 'release-1',
        ReleaseNumber: 'REL001',
        Status: 'RELEASED',
      };
      const mockFinishGood = { PartNumber: 'FG-001', Qty: 500 };
      const mockDeliveryWithPallet = {
        Id: 1,
        ProductionDemandId: 'PO-001',
        Qty: 100,
        PalletNumber: 'PP2PANS001',
        CreatedAt: new Date(),
        CreatedBy: 'admin',
        LabelDataId: 'LBL001',
      };

      mockPrismaService.labelData.findUnique.mockResolvedValue(mockLabelData);
      mockPrismaService.productionOrder.findUnique.mockResolvedValue(
        mockForecast,
      );
      mockPrismaService.productionRelease.findUnique.mockResolvedValue(
        mockProductionRelease,
      );
      mockPrismaService.snapshotRequirements.findMany.mockResolvedValue([]);
      mockPrismaService.shopping.findMany.mockResolvedValue([]);
      mockPrismaService.finishGood.findUnique.mockResolvedValue(mockFinishGood);
      mockPrismaService.deliveryHistory.findFirst.mockResolvedValue(null);

      const mockTx = createMockTx();
      mockTx.deliveryHistory.create.mockResolvedValue(mockDeliveryWithPallet);
      mockTx.deliveryHistory.findUnique.mockResolvedValue(null);
      mockTx.finishGood.findUnique.mockResolvedValue(mockFinishGood);
      mockTx.finishGood.update.mockResolvedValue({});
      mockTx.inventoryLedger.create.mockResolvedValue({});

      mockPrismaService.$transaction.mockImplementation((callback) => {
        return callback(mockTx);
      });

      const result = await service.create(dto, 'admin');

      expect(result.success).toBe(true);
      expect(result.data.palletNumber).toBe('PP2PANS001');
      expect(outboxService.create).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          type: 'PALLET_CONNECTOR_HISTORY',
          payload: {
            kode: 'PP2PANS001',
            deliveryId: 1,
          },
        }),
      );
    });

    it.each([
      {
        period: 2,
        earlier: [priorForecast(1, 'PO-A', [50, 50], 1)],
        blockedPeriod: 1,
      },
      {
        period: 4,
        earlier: [
          priorForecast(1, 'PO-A', [100], 1),
          priorForecast(2, 'PO-B', [50, 50], 1),
        ],
        blockedPeriod: 2,
      },
      {
        period: 6,
        earlier: [
          priorForecast(1, 'PO-A', [100], 1),
          priorForecast(2, 'PO-B', [100], 1),
          priorForecast(4, 'PO-C', [50, 50], 1),
        ],
        blockedPeriod: 4,
      },
    ])(
      'blocks period $period when an earlier period is incomplete',
      async ({ period, earlier, blockedPeriod }) => {
        const tx = setupReadyDelivery(period);
        tx.productionOrder.findMany.mockResolvedValue(earlier);

        const error = await service
          .create({ labelNumber: 'LBL001' }, 'admin')
          .catch((cause: unknown) => cause);
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).message).toContain(
          `period ${blockedPeriod} is incomplete`,
        );
        expect((error as ConflictException).message).toContain('PR-001');
        expect((error as ConflictException).message).toContain('units pending');
        expect(tx.deliveryHistory.create).not.toHaveBeenCalled();
        expect(tx.finishGood.update).not.toHaveBeenCalled();
        expect(tx.inventoryLedger.create).not.toHaveBeenCalled();
        expect(outboxService.create).not.toHaveBeenCalled();
      },
    );

    it('allows delivery when every label in all earlier periods is complete, including gaps', async () => {
      const tx = setupReadyDelivery(6);
      tx.productionOrder.findMany.mockResolvedValue([
        priorForecast(1, 'PO-A', [50, 50], 2),
        priorForecast(1, 'PO-B', [100], 1),
        priorForecast(2, 'PO-C', [100], 1),
        priorForecast(4, 'PO-D', [100], 1),
      ]);

      await expect(
        service.create({ labelNumber: 'LBL001' }, 'admin'),
      ).resolves.toMatchObject({ success: true });
      expect(tx.productionOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            ProductionReleaseId: 'release-1',
            DeliveryPeriod: { lt: 6 },
          },
        }),
      );
      expect(tx.deliveryHistory.create).toHaveBeenCalledTimes(1);
    });

    it('does not wait for another PO in the same period or another release', async () => {
      const tx = setupReadyDelivery(2);
      tx.productionOrder.findMany.mockResolvedValue([
        priorForecast(1, 'PO-A', [100], 1),
      ]);

      await expect(
        service.create({ labelNumber: 'LBL001' }, 'admin'),
      ).resolves.toMatchObject({ success: true });
      expect(tx.productionOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            ProductionReleaseId: 'release-1',
            DeliveryPeriod: { lt: 2 },
          },
        }),
      );
    });

    it('serializes concurrent period scans and reads the previous period after commit', async () => {
      const tx = setupReadyDelivery(2);
      const labels = {
        LBL001: {
          Id: 1,
          LabelNumber: 'LBL001',
          ProductionDemandId: 'PO-001',
          FinishGoodId: 'FG-001',
          ProductionReleaseId: 'release-1',
          QtyThisBox: 100,
          Scanned: true,
        },
        LBL002: {
          Id: 2,
          LabelNumber: 'LBL002',
          ProductionDemandId: 'PO-002',
          FinishGoodId: 'FG-001',
          ProductionReleaseId: 'release-1',
          QtyThisBox: 100,
          Scanned: true,
        },
      };
      const forecasts = {
        'PO-001': {
          PoId: 'PO-001',
          Qty: 100,
          FinishGoodId: 'FG-001',
          DeliveryPeriod: 2,
          ProductionReleaseId: 'release-1',
          ProductionRelease: { Status: 'RELEASED', ReleaseNumber: 'PR-001' },
        },
        'PO-002': {
          PoId: 'PO-002',
          Qty: 100,
          FinishGoodId: 'FG-001',
          DeliveryPeriod: 4,
          ProductionReleaseId: 'release-1',
          ProductionRelease: { Status: 'RELEASED', ReleaseNumber: 'PR-001' },
        },
      };
      mockPrismaService.labelData.findUnique.mockImplementation(
        ({ where }: { where: { LabelNumber: keyof typeof labels } }) =>
          labels[where.LabelNumber],
      );
      mockPrismaService.productionOrder.findUnique.mockImplementation(
        ({ where }: { where: { PoId: keyof typeof forecasts } }) =>
          forecasts[where.PoId],
      );
      tx.labelData.findUnique.mockImplementation(
        ({ where }: { where: { Id: number } }) =>
          where.Id === 1 ? labels.LBL001 : labels.LBL002,
      );
      tx.productionOrder.findUnique.mockImplementation(
        ({ where }: { where: { PoId: keyof typeof forecasts } }) =>
          forecasts[where.PoId],
      );
      let periodTwoCommitted = false;
      tx.productionOrder.findMany.mockImplementation(
        ({ where }: { where: { DeliveryPeriod: { lt: number } } }) => [
          priorForecast(1, 'PO-A', [100], 1),
          ...(where.DeliveryPeriod.lt > 2
            ? [priorForecast(2, 'PO-001', [100], periodTwoCommitted ? 1 : 0)]
            : []),
        ],
      );

      let enterFirstDelivery!: () => void;
      const firstDeliveryEntered = new Promise<void>((resolve) => {
        enterFirstDelivery = resolve;
      });
      let finishFirstDelivery!: () => void;
      const firstDeliveryGate = new Promise<void>((resolve) => {
        finishFirstDelivery = resolve;
      });
      tx.deliveryHistory.create.mockImplementation(
        async ({
          data,
        }: {
          data: {
            ProductionDemandId: string;
            LabelDataId: string;
            Qty: number;
          };
        }) => {
          if (data.ProductionDemandId === 'PO-001') {
            enterFirstDelivery();
            await firstDeliveryGate;
          }
          return { Id: data.ProductionDemandId === 'PO-001' ? 1 : 2, ...data };
        },
      );

      let transactionTail = Promise.resolve();
      mockPrismaService.$transaction.mockImplementation(
        (
          callback: (client: typeof tx) => Promise<{
            delivery: { ProductionDemandId: string };
          }>,
        ) => {
          const previous = transactionTail;
          let unlock!: () => void;
          transactionTail = new Promise<void>((resolve) => {
            unlock = resolve;
          });
          return (async () => {
            await previous;
            try {
              const result = await callback(tx);
              if (result.delivery.ProductionDemandId === 'PO-001')
                periodTwoCommitted = true;
              return result;
            } finally {
              unlock();
            }
          })();
        },
      );

      const periodTwo = service.create({ labelNumber: 'LBL001' }, 'admin');
      await firstDeliveryEntered;
      const periodFour = service.create({ labelNumber: 'LBL002' }, 'admin');
      finishFirstDelivery();

      const results = await Promise.all([periodTwo, periodFour]);
      expect(results.map((result) => result.success)).toEqual([true, true]);
      expect(
        tx.productionOrder.findMany.mock.calls.map(
          ([arg]) => arg.where.DeliveryPeriod.lt,
        ),
      ).toEqual([2, 4]);
      expect(tx.deliveryHistory.create).toHaveBeenCalledTimes(2);
    });

    it.each([
      { name: 'missing labels', earlier: priorForecast(1, 'PO-A', [], 0) },
      {
        name: 'label quantity mismatch',
        earlier: priorForecast(1, 'PO-A', [40], 1),
      },
      {
        name: 'delivery quantity mismatch',
        earlier: {
          ...priorForecast(1, 'PO-A', [100], 1),
          DeliveryHistory: [
            { ProductionDemandId: 'PO-A', LabelDataId: 'PO-A-LBL-1', Qty: 99 },
          ],
        },
      },
    ])('blocks $name before any delivery side effect', async ({ earlier }) => {
      const tx = setupReadyDelivery(2);
      tx.productionOrder.findMany.mockResolvedValue([earlier]);

      await expect(
        service.create({ labelNumber: 'LBL001' }, 'admin'),
      ).rejects.toThrow(ConflictException);
      expect(tx.deliveryHistory.create).not.toHaveBeenCalled();
      expect(tx.finishGood.update).not.toHaveBeenCalled();
      expect(tx.inventoryLedger.create).not.toHaveBeenCalled();
      expect(outboxService.create).not.toHaveBeenCalled();
    });

    it('should throw error when label not found', async () => {
      mockPrismaService.labelData.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ labelNumber: 'MISSING-LABEL' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      'closed',
      'incomplete',
      'missing-production',
      'overdelivery',
      'missing-assembly',
    ])(
      'rejects %s after rechecking inside the transaction without cutting stock',
      async (scenario) => {
        mockPrismaService.labelData.findUnique.mockResolvedValue({
          Id: 1,
          LabelNumber: 'LBL001',
          ProductionDemandId: 'PO-001',
          FinishGoodId: 'FG-001',
          QtyThisBox: 100,
          Scanned: true,
        });
        mockPrismaService.productionOrder.findUnique.mockResolvedValue({
          PoId: 'PO-001',
          FinishGoodId: 'FG-001',
          Qty: 100,
          ProductionReleaseId: 'release-1',
        });
        mockPrismaService.productionRelease.findUnique.mockResolvedValue({
          Id: 'release-1',
          Status: 'RELEASED',
        });
        mockPrismaService.snapshotRequirements.findMany.mockResolvedValue([]);
        mockPrismaService.shopping.findMany.mockResolvedValue([]);
        mockPrismaService.deliveryHistory.findFirst.mockResolvedValue(null);
        const tx = createMockTx();
        if (scenario === 'missing-assembly')
          tx.labelData.findUnique.mockResolvedValue({
            Id: 1,
            LabelNumber: 'LBL001',
            ProductionDemandId: 'PO-001',
            FinishGoodId: 'FG-001',
            ProductionReleaseId: 'release-1',
            Scanned: true,
            QtyThisBox: 100,
            RequiresAssembly: true,
          });
        if (scenario === 'closed')
          tx.productionOrder.findUnique.mockResolvedValue({
            PoId: 'PO-001',
            FinishGoodId: 'FG-001',
            Qty: 100,
            ProductionReleaseId: 'release-1',
            ProductionRelease: { Status: 'COMPLETED' },
          });
        if (scenario === 'incomplete')
          tx.shopping.findMany.mockResolvedValue([
            { Id: 'SHP-1', MaterialId: 'MAT-1', QtyPick: 99 },
          ]);
        if (scenario === 'missing-production')
          tx.inventoryLedger.aggregate.mockResolvedValue({
            _sum: { QtyIn: 0 },
          });
        if (scenario === 'overdelivery')
          tx.deliveryHistory.aggregate.mockResolvedValue({ _sum: { Qty: 1 } });
        mockPrismaService.$transaction.mockImplementation(
          (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
        );
        await expect(
          service.create({ labelNumber: 'LBL001' }, 'admin'),
        ).rejects.toThrow(BadRequestException);
        expect(tx.finishGood.update).not.toHaveBeenCalled();
        expect(tx.inventoryLedger.create).not.toHaveBeenCalled();
        expect(tx.deliveryHistory.create).not.toHaveBeenCalled();
      },
    );

    it('should throw error when label not scanned', async () => {
      const mockLabelData = { Id: 1, LabelNumber: 'LBL001', Scanned: false };
      mockPrismaService.labelData.findUnique.mockResolvedValue(mockLabelData);

      await expect(
        service.create({ labelNumber: 'LBL001' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated deliveries', async () => {
      const mockDeliveries = [
        {
          Id: 1,
          ProductionDemandId: 'PO-001',
          Qty: 100,
          LabelDataId: 'LBL-001',
          LabelData: {
            LabelNumber: 'LBL-001',
            ProductionRelease: { ReleaseNumber: 'REL-001' },
          },
        },
        {
          Id: 2,
          ProductionDemandId: 'PO-002',
          Qty: 50,
          LabelDataId: 'LBL-002',
          LabelData: {
            LabelNumber: 'LBL-002',
            ProductionRelease: { ReleaseNumber: 'REL-002' },
          },
        },
      ];

      mockPrismaService.deliveryHistory.count.mockResolvedValue(2);
      mockPrismaService.deliveryHistory.findMany.mockResolvedValue(
        mockDeliveries,
      );

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.meta.totalItems).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        labelNumber: 'LBL-001',
        releaseNumber: 'REL-001',
      });
    });

    it('should filter by forecastId', async () => {
      mockPrismaService.deliveryHistory.count.mockResolvedValue(0);
      mockPrismaService.deliveryHistory.findMany.mockResolvedValue([]);

      await service.findAll({ forecastId: 'PO-001' });

      expect(mockPrismaService.deliveryHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ProductionDemandId: 'PO-001' }),
        }),
      );
    });

    it('should filter by active release when activeReleaseOnly is true', async () => {
      mockPrismaService.deliveryHistory.count.mockResolvedValue(0);
      mockPrismaService.deliveryHistory.findMany.mockResolvedValue([]);

      await service.findAll({ activeReleaseOnly: true });

      expect(mockPrismaService.deliveryHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            LabelData: {
              ProductionRelease: { Status: 'RELEASED' },
            },
          }),
        }),
      );
    });
  });

  describe('getPalletOptions', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return active pallet options', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                kode: 'PP2PANS001',
                name: 'ANSEI',
                isActive: 1,
                partName: 'LATCH',
              },
              { kode: 'PP2PANS002', name: 'ANSEI', isActive: 0 },
            ],
          }),
      });
      global.fetch = mockFetch as any;

      const result = await service.getPalletOptions();

      expect(result).toEqual([
        { kode: 'PP2PANS001', name: 'ANSEI', partName: 'LATCH' },
      ]);
    });

    it('should return empty array on fetch failure', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('Network error')) as any;

      const result = await service.getPalletOptions();

      expect(result).toEqual([]);
    });
  });
});
