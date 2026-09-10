import { Test, TestingModule } from '@nestjs/testing';
import { ProductionReportService } from './production-report.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ProductionReportService', () => {
  let service: ProductionReportService;
  let prismaService: jest.Mocked<PrismaService>;
  let logService: jest.Mocked<LogProcessService>;

  const mockPrismaService = {
    productionReport: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    forecast: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    finishGood: {
      findUnique: jest.fn(),
    },
    manPower: {
      findUnique: jest.fn(),
    },
    productionRelease: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockLogService = {
    startProcess: jest.fn(),
    addLog: jest.fn(),
    completeProcess: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionReportService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LogProcessService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<ProductionReportService>(ProductionReportService);
    prismaService = module.get(PrismaService);
    logService = module.get(LogProcessService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated production reports', async () => {
      const mockReports = [
        {
          Id: 1,
          Date: '2026-06-10',
          ProductionStamp: new Date(),
          Qty: 100,
          NgQty: 5,
          ManPowerUid: 'uid-1',
          FinishGoodId: 'FG-001',
        },
      ];

      mockPrismaService.productionReport.count.mockResolvedValue(1);
      mockPrismaService.productionReport.findMany.mockResolvedValue(
        mockReports as any,
      );

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });

    it('should filter by date', async () => {
      mockPrismaService.productionReport.count.mockResolvedValue(0);
      mockPrismaService.productionReport.findMany.mockResolvedValue([]);

      await service.findAll({ date: '2026-06-10' });

      expect(mockPrismaService.productionReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ Date: '2026-06-10' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a production report by id', async () => {
      const mockReport = {
        Id: 1,
        Date: '2026-06-10',
        Qty: 100,
        NgQty: 5,
      };

      mockPrismaService.productionReport.findUnique.mockResolvedValue(
        mockReport as any,
      );

      const result = await service.findOne(1);

      expect(result).toEqual(mockReport);
    });

    it('should throw NotFoundException when report not found', async () => {
      mockPrismaService.productionReport.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const mockProcess = { ProcessId: 'PR123', ProcessStart: new Date() };

    beforeEach(() => {
      mockLogService.startProcess.mockResolvedValue(mockProcess as any);
      mockLogService.addLog.mockResolvedValue({} as any);
      mockLogService.completeProcess.mockResolvedValue(undefined);
    });

    it('should create a production report with valid data', async () => {
      const createDto = {
        productionStamp: '2026-06-10T08:00:00Z',
        recordType: 'ONE' as any,
        qty: 100,
        manPowerUid: 'uid-1',
        finishGoodId: 'FG-001',
      };

      const mockManPower = { Uid: 'uid-1', Nik: 'NIK001', Name: 'John' };
      const mockFinishGood = {
        PartNumber: 'FG-001',
        PartName: 'Finish Good A',
      };
      const mockCreated = { Id: 1, ...createDto };

      mockPrismaService.manPower.findUnique.mockResolvedValue(
        mockManPower as any,
      );
      mockPrismaService.finishGood.findUnique.mockResolvedValue(
        mockFinishGood as any,
      );
      mockPrismaService.productionReport.findFirst.mockResolvedValue(null);
      mockPrismaService.productionRelease.findFirst.mockResolvedValue({
        ReleaseNumber: 'PR-001',
      } as any);
      mockPrismaService.productionReport.create.mockResolvedValue(
        mockCreated as any,
      );
      mockPrismaService.productionRelease.update.mockResolvedValue({} as any);

      const result = await service.create(createDto, 'admin');

      expect(result).toEqual(mockCreated);
      expect(mockLogService.startProcess).toHaveBeenCalled();
      expect(mockLogService.completeProcess).toHaveBeenCalledWith(
        'PR123',
        'SUCCESS',
      );
    });

    it('should throw error when ManPower not found', async () => {
      const createDto = {
        productionStamp: '2026-06-10T08:00:00Z',
        recordType: 'ONE' as any,
        qty: 100,
        manPowerUid: 'invalid-uid',
        finishGoodId: 'FG-001',
      };

      mockPrismaService.manPower.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockLogService.completeProcess).toHaveBeenCalledWith(
        'PR123',
        'FAILED',
      );
    });
  });

  describe('validateReport', () => {
    const mockProcess = { ProcessId: 'PR123', ProcessStart: new Date() };

    beforeEach(() => {
      mockLogService.startProcess.mockResolvedValue(mockProcess as any);
      mockLogService.addLog.mockResolvedValue({} as any);
      mockLogService.completeProcess.mockResolvedValue(undefined);
    });

    it('should validate a production report', async () => {
      const mockReport = {
        Id: 1,
        Qty: 100,
        NgQty: 5,
        FinishGoodId: 'FG-001',
        ValidatedAt: null,
      };

      mockPrismaService.productionReport.findUnique.mockResolvedValue(
        mockReport as any,
      );
      mockPrismaService.productionRelease.findFirst.mockResolvedValue({
        ReleaseNumber: 'PR-001',
      } as any);
      mockPrismaService.productionReport.update.mockResolvedValue({
        ...mockReport,
        ValidatedAt: new Date(),
      } as any);

      const result = await service.validateReport(1, 'admin');

      expect(mockPrismaService.productionReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ValidatedBy: 'admin' }),
        }),
      );
    });

    it('should throw error when report already validated', async () => {
      const mockReport = {
        Id: 1,
        ValidatedAt: new Date(),
      };

      mockPrismaService.productionReport.findUnique.mockResolvedValue(
        mockReport as any,
      );

      await expect(service.validateReport(1, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
