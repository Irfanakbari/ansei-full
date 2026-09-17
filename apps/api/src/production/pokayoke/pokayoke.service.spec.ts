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
    labelData: {
      findUnique: jest.fn(),
      update: jest.fn(),
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
    $transaction: jest.fn(),
  };

  const mockLogService = {
    startProcess: jest.fn(),
    addLog: jest.fn(),
    completeProcess: jest.fn(),
  };

  const mockShoppingService = {
    // Add mock methods as needed
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
    jest.clearAllMocks();
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
    });

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
      const mockForecast = { PoId: 'PO-001' };
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
      expect(mockPrismaService.labelData.update).toHaveBeenCalled();
      expect(mockPrismaService.productionRelease.update).toHaveBeenCalledWith({
        where: { Id: 'release-1' },
        data: { TotalGoodQty: { increment: 20 } },
      });
    });

    it('should throw error when label not found', async () => {
      mockPrismaService.labelData.findUnique.mockResolvedValue(null);

      await expect(
        service.scan({ labelNumber: 'INVALID', status: 'SUKSES' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
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
  });
});
