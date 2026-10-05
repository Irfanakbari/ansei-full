// These unit tests inject frozen requirement fixtures; real snapshot persistence is exercised by phase-one.database.spec.ts.
jest.mock('../../common/helpers/bom-snapshot.helper', () => ({
  ...jest.requireActual('../../common/helpers/bom-snapshot.helper'),
  snapshotBomEntries: (tx: {
    snapshotRequirements: { findMany: () => Promise<unknown> };
  }) => tx.snapshotRequirements.findMany(),
}));
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PokayokeService } from './pokayoke.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { ShoppingService } from '../shopping/shopping.service';

describe('PokayokeService', () => {
  let service: PokayokeService;
  let prismaService: any;
  let logService: any;

  const mockPrismaService = {
    assemblySession: { findFirst: jest.fn() },
    labelData: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    forecast: {
      findUnique: jest.fn(),
    },
    finishGood: {
      findUnique: jest.fn(),
    },
    pokayokeScanHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    productionRelease: {
      update: jest.fn(),
    },
    productionTraceEvent: { create: jest.fn() },
    $executeRaw: jest.fn(),
    snapshotRequirements: { findMany: jest.fn() },
    shopping: { findMany: jest.fn() },
    inventoryLedger: { aggregate: jest.fn() },
    deliveryHistory: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockLogService = {
    startProcess: jest.fn(),
    addLog: jest.fn(),
    completeProcess: jest.fn(),
  };

  const mockShoppingService = {
    checkRequirement: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PokayokeService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LogProcessService, useValue: mockLogService },
        { provide: ShoppingService, useValue: mockShoppingService },
      ],
    }).compile();

    service = module.get<PokayokeService>(PokayokeService);
    prismaService = mockPrismaService;
    logService = mockLogService;
    jest.resetAllMocks();
    mockPrismaService.deliveryHistory.findUnique.mockResolvedValue(null);
  });

  describe('getScanOptions', () => {
    beforeEach(() => {
      mockPrismaService.$transaction.mockImplementation(
        (callback: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          callback(mockPrismaService),
      );
      mockPrismaService.snapshotRequirements.findMany.mockResolvedValue([
        { Qty: 1, MaterialData: { PartNumber: 'MAT-001' } },
      ]);
      mockPrismaService.shopping.findMany.mockResolvedValue([
        { Id: 'SHP-1', MaterialId: 'MAT-001', QtyPick: 20 },
      ]);
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: { QtyIn: 20 },
      });
    });

    it('includes ready assembly and non-assembly labels and applies search and limit', async () => {
      const candidates = [
        {
          Id: 1,
          LabelNumber: 'LBL-ASSY',
          ForecastId: 'PO-001',
          FinishGoodId: 'FG-001',
          ProductionReleaseId: 'REL-1',
          QtyThisBox: 20,
          Scanned: false,
          RequiresAssembly: true,
          PartData: { PartName: 'FG A' },
          ProductionRelease: { ReleaseNumber: 'PR-001' },
        },
        {
          Id: 2,
          LabelNumber: 'LBL-DIRECT',
          ForecastId: 'PO-001',
          FinishGoodId: 'FG-001',
          ProductionReleaseId: 'REL-1',
          QtyThisBox: 20,
          Scanned: false,
          RequiresAssembly: null,
          PartData: { PartName: 'FG A' },
          ProductionRelease: { ReleaseNumber: 'PR-001' },
        },
      ];
      mockPrismaService.labelData.findMany.mockResolvedValue(candidates);
      mockPrismaService.labelData.findUnique
        .mockResolvedValueOnce(candidates[0])
        .mockResolvedValueOnce(candidates[1]);
      mockPrismaService.forecast.findUnique.mockResolvedValue({
        PoId: 'PO-001',
        Qty: 20,
        FinishGoodId: 'FG-001',
        ProductionReleaseId: 'REL-1',
        ProductionRelease: { Status: 'RELEASED' },
      });
      mockPrismaService.assemblySession.findFirst.mockResolvedValue({
        Id: 'A1',
      });

      const result = await service.getScanOptions({
        labelNumber: 'LBL',
        limit: 2,
      });

      expect(result.labels).toHaveLength(2);
      expect(result.labels[0].requiresAssembly).toBe(true);
      expect(result.labels[1].requiresAssembly).toBe(false);
      expect(mockPrismaService.labelData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 2,
          where: expect.objectContaining({
            Scanned: false,
            DeliveryHistory: null,
            LabelNumber: { contains: 'LBL', mode: 'insensitive' },
          }),
        }),
      );
    });

    it.each(['IN_PROGRESS', 'CANCELLED'])(
      'excludes assembly session status %s',
      async (status) => {
        const candidate = {
          Id: 1,
          LabelNumber: 'LBL-ASSY',
          ForecastId: 'PO-001',
          FinishGoodId: 'FG-001',
          ProductionReleaseId: 'REL-1',
          QtyThisBox: 20,
          Scanned: false,
          RequiresAssembly: true,
          PartData: { PartName: 'FG A' },
          ProductionRelease: { ReleaseNumber: 'PR-001' },
        };
        mockPrismaService.labelData.findMany.mockResolvedValue([candidate]);
        mockPrismaService.labelData.findUnique.mockResolvedValue(candidate);
        mockPrismaService.forecast.findUnique.mockResolvedValue({
          PoId: 'PO-001',
          Qty: 20,
          FinishGoodId: 'FG-001',
          ProductionReleaseId: 'REL-1',
          ProductionRelease: { Status: 'RELEASED' },
        });
        mockPrismaService.assemblySession.findFirst.mockResolvedValue(null);

        await expect(service.getScanOptions()).resolves.toEqual({ labels: [] });
        expect(status).toBeDefined();
      },
    );

    it('rejects a delivered label in the direct scan path', async () => {
      mockLogService.startProcess.mockResolvedValue({
        ProcessId: 'PR123',
        ProcessStart: new Date(),
      });
      mockLogService.addLog.mockResolvedValue({});
      mockLogService.completeProcess.mockResolvedValue(undefined);
      mockPrismaService.labelData.findUnique.mockResolvedValue({
        Id: 1,
        LabelNumber: 'LBL001',
        ForecastId: 'PO-001',
        FinishGoodId: 'FG-001',
        ProductionReleaseId: 'REL-1',
        QtyThisBox: 20,
        Scanned: false,
      });
      mockPrismaService.forecast.findUnique.mockResolvedValue({
        PoId: 'PO-001',
      });
      mockPrismaService.finishGood.findUnique.mockResolvedValue({
        PartNumber: 'FG-001',
        PartName: 'FG A',
      });
      mockPrismaService.deliveryHistory.findUnique.mockResolvedValue({ Id: 1 });
      mockShoppingService.checkRequirement.mockResolvedValue({
        requirements: [{ qtyNeeded: 20, qtyPicked: 20 }],
        summary: {
          overallPercentage: 100,
          totalQtyPicked: 20,
          totalQtyNeeded: 20,
          totalMaterials: 1,
        },
      });
      mockPrismaService.$transaction.mockImplementation(
        (callback: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          callback(mockPrismaService),
      );

      await expect(
        service.scan({ labelNumber: 'LBL001', status: 'GAGAL' }, 'admin'),
      ).rejects.toThrow('delivered');
      expect(
        mockPrismaService.pokayokeScanHistory.create,
      ).not.toHaveBeenCalled();
    });
  });

  describe('scan', () => {
    const mockProcess = { ProcessId: 'PR123', ProcessStart: new Date() };

    beforeEach(() => {
      mockLogService.startProcess.mockResolvedValue(mockProcess as any);
      mockLogService.addLog.mockResolvedValue({} as any);
      mockLogService.completeProcess.mockResolvedValue(undefined);
      mockPrismaService.$transaction.mockImplementation(
        (callback: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          callback(mockPrismaService),
      );
      mockPrismaService.snapshotRequirements.findMany.mockResolvedValue([
        { Qty: 1, MaterialData: { PartNumber: 'MAT-001' } },
      ]);
      mockPrismaService.shopping.findMany.mockResolvedValue([
        { Id: 'SHP-1', MaterialId: 'MAT-001', QtyPick: 20 },
      ]);
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: { QtyIn: 20 },
      });
      mockShoppingService.checkRequirement.mockResolvedValue({
        requirements: [{ qtyNeeded: 20, qtyPicked: 20 }],
        summary: {
          overallPercentage: 100,
          totalQtyPicked: 20,
          totalQtyNeeded: 20,
          totalMaterials: 1,
        },
      });
      mockPrismaService.labelData.updateMany.mockResolvedValue({ count: 1 });
    });

    it.each(['SUKSES', 'GAGAL'])(
      'blocks %s scans before mandatory assembly completion',
      async (status) => {
        mockPrismaService.labelData.findUnique.mockResolvedValue({
          Id: 1,
          LabelNumber: 'LBL001',
          ForecastId: 'PO-001',
          FinishGoodId: 'FG-001',
          ProductionReleaseId: 'release-1',
          QtyThisBox: 20,
          Scanned: false,
          RequiresAssembly: true,
        });
        mockPrismaService.forecast.findUnique.mockResolvedValue({
          PoId: 'PO-001',
          Qty: 20,
          FinishGoodId: 'FG-001',
          ProductionReleaseId: 'release-1',
          ProductionRelease: { Status: 'RELEASED' },
        });
        mockPrismaService.finishGood.findUnique.mockResolvedValue({
          PartNumber: 'FG-001',
          PartName: 'Finish Good A',
        });
        await expect(
          service.scan({ labelNumber: 'LBL001', status }, 'admin'),
        ).rejects.toThrow('Assembly must be completed');
        expect(
          mockPrismaService.pokayokeScanHistory.create,
        ).not.toHaveBeenCalled();
      },
    );

    it('should successfully scan a valid label', async () => {
      const dto = { labelNumber: 'LBL001', status: 'SUKSES' };
      const mockLabelData = {
        Id: 1,
        LabelNumber: 'LBL001',
        ForecastId: 'PO-001',
        FinishGoodId: 'FG-001',
        ProductionReleaseId: 'release-1',
        QtyThisBox: 20,
        Scanned: false,
        PartData: { PartNumber: 'FG-001', PartName: 'Finish Good A' },
        POData: { PoId: 'PO-001', VendorName: 'Vendor A' },
      };
      const mockForecast = {
        PoId: 'PO-001',
        Qty: 20,
        FinishGoodId: 'FG-001',
        ProductionReleaseId: 'release-1',
        ProductionRelease: { Status: 'RELEASED' },
      };
      const mockFinishGood = {
        PartNumber: 'FG-001',
        PartName: 'Finish Good A',
      };
      const mockScanResult = {
        Id: 1,
        LabelNumber: 'LBL001',
        Status: 'SUKSES',
        CreatedAt: new Date(),
        CreatedBy: 'admin',
      };

      mockPrismaService.labelData.findUnique.mockResolvedValue(mockLabelData);
      mockPrismaService.forecast.findUnique.mockResolvedValue(mockForecast);
      mockPrismaService.finishGood.findUnique.mockResolvedValue(mockFinishGood);
      mockPrismaService.pokayokeScanHistory.create.mockResolvedValue(
        mockScanResult,
      );
      mockPrismaService.labelData.update.mockResolvedValue({});

      const result = await service.scan(dto, 'admin');

      expect(result.success).toBe(true);
      expect(result.data.labelNumber).toBe('LBL001');
      expect(mockPrismaService.labelData.updateMany).toHaveBeenCalledWith({
        where: { Id: 1, Scanned: false },
        data: { Scanned: true },
      });
      expect(mockPrismaService.pokayokeScanHistory.create).toHaveBeenCalledWith(
        {
          data: expect.objectContaining({ LabelDataId: 1 }),
        },
      );
      expect(mockPrismaService.productionRelease.update).toHaveBeenCalledWith({
        where: { Id: 'release-1' },
        data: { TotalGoodQty: { increment: 20 } },
      });
    });

    it('rolls back the successful scan unit when the release increment fails', async () => {
      const label = {
        Id: 1,
        LabelNumber: 'LBL001',
        ForecastId: 'PO-001',
        FinishGoodId: 'FG-001',
        ProductionReleaseId: 'release-1',
        QtyThisBox: 20,
        Scanned: false,
      };
      mockPrismaService.labelData.findUnique.mockResolvedValue(label);
      mockPrismaService.forecast.findUnique.mockResolvedValue({
        PoId: 'PO-001',
        Qty: 20,
        FinishGoodId: 'FG-001',
        ProductionReleaseId: 'release-1',
        ProductionRelease: { Status: 'RELEASED' },
      });
      mockPrismaService.finishGood.findUnique.mockResolvedValue({
        PartNumber: 'FG-001',
        PartName: 'Finish Good A',
      });
      mockPrismaService.pokayokeScanHistory.create.mockResolvedValue({ Id: 1 });
      mockPrismaService.productionRelease.update.mockRejectedValue(
        new Error('release update failed'),
      );

      await expect(
        service.scan({ labelNumber: 'LBL001', status: 'SUKSES' }, 'admin'),
      ).rejects.toThrow('release update failed');
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(logService.completeProcess).toHaveBeenLastCalledWith(
        'PR123',
        'FAILED',
      );
    });

    it('rejects a concurrent successful scan when the label claim loses', async () => {
      mockPrismaService.labelData.findUnique.mockResolvedValue({
        Id: 1,
        LabelNumber: 'LBL001',
        ForecastId: 'PO-001',
        FinishGoodId: 'FG-001',
        ProductionReleaseId: 'release-1',
        QtyThisBox: 20,
        Scanned: false,
      });
      mockPrismaService.forecast.findUnique.mockResolvedValue({
        PoId: 'PO-001',
        Qty: 20,
        FinishGoodId: 'FG-001',
        ProductionReleaseId: 'release-1',
        ProductionRelease: { Status: 'RELEASED' },
      });
      mockPrismaService.finishGood.findUnique.mockResolvedValue({
        PartNumber: 'FG-001',
        PartName: 'Finish Good A',
      });
      mockPrismaService.labelData.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.scan({ labelNumber: 'LBL001', status: 'SUKSES' }, 'admin'),
      ).rejects.toThrow('already validated');
      expect(
        mockPrismaService.pokayokeScanHistory.create,
      ).not.toHaveBeenCalled();
      expect(mockPrismaService.productionRelease.update).not.toHaveBeenCalled();
    });

    it('fails closed when shopping validation unexpectedly fails', async () => {
      mockPrismaService.labelData.findUnique.mockResolvedValue({
        Id: 1,
        LabelNumber: 'LBL001',
        ForecastId: 'PO-001',
        FinishGoodId: 'FG-001',
        Scanned: false,
      });
      mockPrismaService.forecast.findUnique.mockResolvedValue({
        PoId: 'PO-001',
        Qty: 20,
        FinishGoodId: 'FG-001',
        ProductionReleaseId: 'release-1',
        ProductionRelease: { Status: 'RELEASED' },
      });
      mockShoppingService.checkRequirement.mockRejectedValue(
        new Error('shopping unavailable'),
      );

      await expect(
        service.scan({ labelNumber: 'LBL001', status: 'SUKSES' }, 'admin'),
      ).rejects.toThrow('shopping unavailable');
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw error when label not found', async () => {
      mockPrismaService.labelData.findUnique.mockResolvedValue(null);

      await expect(
        service.scan({ labelNumber: 'INVALID', status: 'SUKSES' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects rounded 100% when a BOM material is still missing', async () => {
      mockPrismaService.labelData.findUnique.mockResolvedValue({
        Id: 1,
        LabelNumber: 'LBL001',
        ForecastId: 'PO-001',
        Scanned: false,
      });
      mockPrismaService.forecast.findUnique.mockResolvedValue({
        PoId: 'PO-001',
      });
      mockShoppingService.checkRequirement.mockResolvedValue({
        summary: {
          overallPercentage: 100,
          totalQtyPicked: 200,
          totalQtyNeeded: 201,
        },
        requirements: [
          { qtyNeeded: 200, qtyPicked: 200 },
          { qtyNeeded: 1, qtyPicked: 0 },
        ],
      });
      await expect(
        service.scan({ labelNumber: 'LBL001', status: 'SUKSES' }, 'admin'),
      ).rejects.toThrow('Shopping belum selesai');
      expect(mockPrismaService.labelData.updateMany).not.toHaveBeenCalled();
    });

    it('records a failed comparison without claiming the label or incrementing output', async () => {
      mockPrismaService.labelData.findUnique.mockResolvedValue({
        Id: 1,
        LabelNumber: 'LBL001',
        ForecastId: 'PO-001',
        FinishGoodId: 'FG-001',
        ProductionReleaseId: 'release-1',
        QtyThisBox: 20,
        Scanned: false,
      });
      mockPrismaService.forecast.findUnique.mockResolvedValue({
        PoId: 'PO-001',
        Qty: 20,
        FinishGoodId: 'FG-001',
        ProductionReleaseId: 'release-1',
        ProductionRelease: { Status: 'RELEASED' },
      });
      mockPrismaService.finishGood.findUnique.mockResolvedValue({
        PartNumber: 'FG-001',
        PartName: 'Finish Good A',
      });
      mockPrismaService.pokayokeScanHistory.create.mockResolvedValue({
        Id: 1,
        Status: 'GAGAL',
      });
      const result = await service.scan(
        { labelNumber: 'LBL001', status: 'GAGAL' },
        'admin',
      );
      expect(result.success).toBe(false);
      expect(mockPrismaService.pokayokeScanHistory.create).toHaveBeenCalledWith(
        { data: expect.objectContaining({ Status: 'GAGAL' }) },
      );
      expect(mockPrismaService.labelData.updateMany).not.toHaveBeenCalled();
      expect(mockPrismaService.productionRelease.update).not.toHaveBeenCalled();
    });

    it('should throw error when label already scanned', async () => {
      const mockLabelData = {
        Id: 1,
        LabelNumber: 'LBL001',
        Scanned: true,
      };
      mockPrismaService.labelData.findUnique.mockResolvedValue(mockLabelData);

      await expect(
        service.scan({ labelNumber: 'LBL001', status: 'SUKSES' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated scan history', async () => {
      const mockScans = [
        { Id: 1, LabelNumber: 'LBL001', Status: 'SUKSES' },
        { Id: 2, LabelNumber: 'LBL002', Status: 'GAGAL' },
      ];

      mockPrismaService.pokayokeScanHistory.count.mockResolvedValue(2);
      mockPrismaService.pokayokeScanHistory.findMany.mockResolvedValue(
        mockScans,
      );

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.meta.totalItems).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('should filter by status', async () => {
      mockPrismaService.pokayokeScanHistory.count.mockResolvedValue(0);
      mockPrismaService.pokayokeScanHistory.findMany.mockResolvedValue([]);

      await service.findAll({ status: 'SUKSES' });

      expect(
        mockPrismaService.pokayokeScanHistory.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ Status: 'SUKSES' }),
        }),
      );
    });
    it('should filter by active release when activeReleaseOnly is true', async () => {
      mockPrismaService.pokayokeScanHistory.count.mockResolvedValue(0);
      mockPrismaService.pokayokeScanHistory.findMany.mockResolvedValue([]);

      await service.findAll({ activeReleaseOnly: true });

      expect(
        mockPrismaService.pokayokeScanHistory.findMany,
      ).toHaveBeenCalledWith(
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
});
