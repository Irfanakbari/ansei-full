import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';

describe('DeliveryService', () => {
  let service: DeliveryService;
  let prismaService: any;
  let logService: any;

  const createMockTx = () => ({
    deliveryHistory: { create: jest.fn() },
    finishGood: { update: jest.fn() },
    inventoryLedger: { create: jest.fn() },
  });

  const mockPrismaService = {
    labelData: { findUnique: jest.fn() },
    forecast: { findUnique: jest.fn() },
    finishGood: { findUnique: jest.fn() },
    productionRelease: { findUnique: jest.fn() },
    billOfMaterials: { findMany: jest.fn() },
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LogProcessService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<DeliveryService>(DeliveryService);
    prismaService = mockPrismaService;
    logService = mockLogService;
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
      mockPrismaService.billOfMaterials.findMany.mockResolvedValue([]);
      mockPrismaService.shopping.findMany.mockResolvedValue([]);
      mockPrismaService.finishGood.findUnique.mockResolvedValue(mockFinishGood);
      mockPrismaService.deliveryHistory.findFirst.mockResolvedValue(null); // No duplicate

      const mockTx = createMockTx();
      mockTx.deliveryHistory.create.mockResolvedValue(mockDelivery);
      mockTx.finishGood.update.mockResolvedValue({});
      mockTx.inventoryLedger.create.mockResolvedValue({});

      mockPrismaService.$transaction.mockImplementation((callback) => {
        return callback(mockTx);
      });

      const result = await service.create(dto, 'admin');

      expect(result.success).toBe(true);
    });

    it('should throw error when label not found', async () => {
      mockPrismaService.labelData.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ labelDataId: 999 }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

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
        { Id: 1, ForecastId: 'PO-001', Qty: 100 },
        { Id: 2, ForecastId: 'PO-002', Qty: 50 },
      ];

      mockPrismaService.deliveryHistory.count.mockResolvedValue(2);
      mockPrismaService.deliveryHistory.findMany.mockResolvedValue(
        mockDeliveries,
      );

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.meta.totalItems).toBe(2);
      expect(result.data).toHaveLength(2);
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
});
