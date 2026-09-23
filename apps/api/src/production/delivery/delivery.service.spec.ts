// These unit tests inject frozen requirement fixtures; real snapshot persistence is exercised by phase-one.database.spec.ts.
jest.mock('../../common/helpers/bom-snapshot.helper', () => ({
  ...jest.requireActual('../../common/helpers/bom-snapshot.helper'),
  snapshotBomEntries: (tx: {
    snapshotRequirements: { findMany: () => Promise<unknown> };
  }) => tx.snapshotRequirements.findMany(),
}));
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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
    productionTraceEvent: { create: jest.fn() },
    $executeRaw: jest.fn(),
    assemblySession: { findFirst: jest.fn().mockResolvedValue(null) },
    labelData: {
      findUnique: jest.fn().mockResolvedValue({
        Id: 1,
        LabelNumber: 'LBL001',
        ForecastId: 'PO-001',
        FinishGoodId: 'FG-001',
        ProductionReleaseId: 'release-1',
        Scanned: true,
        QtyThisBox: 100,
      }),
    },
    forecast: {
      findUnique: jest.fn().mockResolvedValue({
        PoId: 'PO-001',
        FinishGoodId: 'FG-001',
        Qty: 100,
        ProductionReleaseId: 'release-1',
        ProductionRelease: { Status: 'RELEASED' },
      }),
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
    forecast: { findUnique: jest.fn() },
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
    inventoryLedger: { create: jest.fn() },
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

    beforeEach(() => {
      mockLogService.startProcess.mockResolvedValue(mockProcess as any);
      mockLogService.addLog.mockResolvedValue({} as any);
      mockLogService.completeProcess.mockResolvedValue(undefined);
    });

    it('should create delivery successfully', async () => {
      const dto = { labelDataId: 1 };
      const mockLabelData = {
        Id: 1,
        LabelNumber: 'LBL001',
        ForecastId: 'PO-001',
        FinishGoodId: 'FG-001',
        QtyThisBox: 100,
        Scanned: true,
        PartData: { PartNumber: 'FG-001', PartName: 'Finish Good A' },
        POData: { PoId: 'PO-001', VendorName: 'Vendor A' },
      };
      const mockForecast = {
        PoId: 'PO-001',
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
      const mockDelivery = { Id: 1, ForecastId: 'PO-001', Qty: 100 };

      mockPrismaService.labelData.findUnique.mockResolvedValue(mockLabelData);
      mockPrismaService.forecast.findUnique.mockResolvedValue(mockForecast);
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
    });

    it('should create delivery with palletNumber and enqueue outbox event', async () => {
      const dto = { labelDataId: 1, palletNumber: 'PP2PANS001' };
      const mockLabelData = {
        Id: 1,
        LabelNumber: 'LBL001',
        ForecastId: 'PO-001',
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
        ForecastId: 'PO-001',
        Qty: 100,
        PalletNumber: 'PP2PANS001',
        CreatedAt: new Date(),
        CreatedBy: 'admin',
        LabelDataId: 'LBL001',
      };

      mockPrismaService.labelData.findUnique.mockResolvedValue(mockLabelData);
      mockPrismaService.forecast.findUnique.mockResolvedValue(mockForecast);
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

    it('should throw error when label not found', async () => {
      mockPrismaService.labelData.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ labelDataId: 999 }, 'admin'),
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
          ForecastId: 'PO-001',
          FinishGoodId: 'FG-001',
          QtyThisBox: 100,
          Scanned: true,
        });
        mockPrismaService.forecast.findUnique.mockResolvedValue({
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
            ForecastId: 'PO-001',
            FinishGoodId: 'FG-001',
            ProductionReleaseId: 'release-1',
            Scanned: true,
            QtyThisBox: 100,
            RequiresAssembly: true,
          });
        if (scenario === 'closed')
          tx.forecast.findUnique.mockResolvedValue({
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
          service.create({ labelDataId: 1 }, 'admin'),
        ).rejects.toThrow(BadRequestException);
        expect(tx.finishGood.update).not.toHaveBeenCalled();
        expect(tx.inventoryLedger.create).not.toHaveBeenCalled();
        expect(tx.deliveryHistory.create).not.toHaveBeenCalled();
      },
    );

    it('should throw error when label not scanned', async () => {
      const mockLabelData = { Id: 1, LabelNumber: 'LBL001', Scanned: false };
      mockPrismaService.labelData.findUnique.mockResolvedValue(mockLabelData);

      await expect(service.create({ labelDataId: 1 }, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated deliveries', async () => {
      const mockDeliveries = [
        {
          Id: 1,
          ForecastId: 'PO-001',
          Qty: 100,
          LabelDataId: 'LBL-001',
          LabelData: {
            LabelNumber: 'LBL-001',
            ProductionRelease: { ReleaseNumber: 'REL-001' },
          },
        },
        {
          Id: 2,
          ForecastId: 'PO-002',
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
          where: expect.objectContaining({ ForecastId: 'PO-001' }),
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
