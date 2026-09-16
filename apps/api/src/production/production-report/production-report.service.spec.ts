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
      findMany: jest.fn(),
    },
    pokayokeScanHistory: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    finishGood: {
      findUnique: jest.fn(),
    },
    manPower: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
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

      expect(result.meta.totalItems).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(50);
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

    it('should create production report linked to valid Forecast with Pokayoke SUKSES and RELEASED release', async () => {
      const createDto = {
        productionStamp: '2026-06-10T08:00:00Z',
        recordType: 'ONE' as any,
        qty: 50,
        manPowerUid: 'uid-1',
        finishGoodId: 'FG-001',
        forecastId: 'PO-2026-001',
      };

      const mockManPower = { Uid: 'uid-1', Nik: 'NIK001', Name: 'John' };
      const mockFinishGood = {
        PartNumber: 'FG-001',
        PartName: 'Finish Good A',
      };
      const mockForecast = {
        PoId: 'PO-2026-001',
        PoNumber: 'PONUM-1',
        FinishGoodId: 'FG-001',
        ProductionRelease: {
          Id: 'rel-1',
          ReleaseNumber: 'PR-001',
          Status: 'RELEASED',
        },
      };

      mockPrismaService.manPower.findUnique.mockResolvedValue(
        mockManPower as any,
      );
      mockPrismaService.finishGood.findUnique.mockResolvedValue(
        mockFinishGood as any,
      );
      mockPrismaService.productionReport.findFirst.mockResolvedValue(null);
      mockPrismaService.forecast.findUnique.mockResolvedValue(
        mockForecast as any,
      );
      mockPrismaService.pokayokeScanHistory.findFirst.mockResolvedValue({
        Id: 1,
        PoId: 'PO-2026-001',
        Status: 'SUKSES',
      } as any);
      mockPrismaService.productionRelease.findFirst.mockResolvedValue({
        Id: 'rel-1',
        ReleaseNumber: 'PR-001',
      } as any);
      mockPrismaService.productionReport.create.mockResolvedValue({
        Id: 10,
        ...createDto,
        ForecastId: 'PO-2026-001',
      } as any);
      mockPrismaService.productionRelease.update.mockResolvedValue({} as any);

      const result = await service.create(createDto, 'OPERATOR');

      expect(result.Id).toBe(10);
      expect(mockPrismaService.forecast.findUnique).toHaveBeenCalledWith({
        where: { PoId: 'PO-2026-001' },
        include: { ProductionRelease: true },
      });
      expect(
        mockPrismaService.pokayokeScanHistory.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          PoId: 'PO-2026-001',
          Status: 'SUKSES',
        },
      });
      expect(mockLogService.completeProcess).toHaveBeenCalledWith(
        'PR123',
        'SUCCESS',
      );
    });

    it('should reject when Forecast is not found', async () => {
      const createDto = {
        productionStamp: '2026-06-10T08:00:00Z',
        recordType: 'ONE' as any,
        qty: 50,
        manPowerUid: 'uid-1',
        finishGoodId: 'FG-001',
        forecastId: 'PO-UNKNOWN',
      };

      mockPrismaService.manPower.findUnique.mockResolvedValue({
        Uid: 'uid-1',
      } as any);
      mockPrismaService.finishGood.findUnique.mockResolvedValue({
        PartNumber: 'FG-001',
      } as any);
      mockPrismaService.productionReport.findFirst.mockResolvedValue(null);
      mockPrismaService.forecast.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'OPERATOR')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when Forecast has no SUKSES in PokayokeScanHistory', async () => {
      const createDto = {
        productionStamp: '2026-06-10T08:00:00Z',
        recordType: 'ONE' as any,
        qty: 50,
        manPowerUid: 'uid-1',
        finishGoodId: 'FG-001',
        forecastId: 'PO-NO-SCAN',
      };

      mockPrismaService.manPower.findUnique.mockResolvedValue({
        Uid: 'uid-1',
      } as any);
      mockPrismaService.finishGood.findUnique.mockResolvedValue({
        PartNumber: 'FG-001',
      } as any);
      mockPrismaService.productionReport.findFirst.mockResolvedValue(null);
      mockPrismaService.forecast.findUnique.mockResolvedValue({
        PoId: 'PO-NO-SCAN',
        FinishGoodId: 'FG-001',
        ProductionRelease: { Status: 'RELEASED', ReleaseNumber: 'REL-01' },
      } as any);
      mockPrismaService.pokayokeScanHistory.findFirst.mockResolvedValue(null);

      await expect(service.create(createDto, 'OPERATOR')).rejects.toThrow(
        /belum dilakukan scan Pokayoke/,
      );
    });

    it('should reject when Forecast ProductionRelease is closed or not RELEASED', async () => {
      const createDto = {
        productionStamp: '2026-06-10T08:00:00Z',
        recordType: 'ONE' as any,
        qty: 50,
        manPowerUid: 'uid-1',
        finishGoodId: 'FG-001',
        forecastId: 'PO-CLOSED',
      };

      mockPrismaService.manPower.findUnique.mockResolvedValue({
        Uid: 'uid-1',
      } as any);
      mockPrismaService.finishGood.findUnique.mockResolvedValue({
        PartNumber: 'FG-001',
      } as any);
      mockPrismaService.productionReport.findFirst.mockResolvedValue(null);
      mockPrismaService.forecast.findUnique.mockResolvedValue({
        PoId: 'PO-CLOSED',
        FinishGoodId: 'FG-001',
        ProductionRelease: { Status: 'COMPLETED', ReleaseNumber: 'REL-CLOSED' },
      } as any);
      mockPrismaService.pokayokeScanHistory.findFirst.mockResolvedValue({
        PoId: 'PO-CLOSED',
        Status: 'SUKSES',
      } as any);

      await expect(service.create(createDto, 'OPERATOR')).rejects.toThrow(
        /sudah close atau tidak aktif/,
      );
    });

    it('should reject when FinishGood does not match Forecast FinishGood', async () => {
      const createDto = {
        productionStamp: '2026-06-10T08:00:00Z',
        recordType: 'ONE' as any,
        qty: 50,
        manPowerUid: 'uid-1',
        finishGoodId: 'FG-001',
        forecastId: 'PO-MISMATCH',
      };

      mockPrismaService.manPower.findUnique.mockResolvedValue({
        Uid: 'uid-1',
      } as any);
      mockPrismaService.finishGood.findUnique.mockResolvedValue({
        PartNumber: 'FG-001',
      } as any);
      mockPrismaService.productionReport.findFirst.mockResolvedValue(null);
      mockPrismaService.forecast.findUnique.mockResolvedValue({
        PoId: 'PO-MISMATCH',
        FinishGoodId: 'FG-999', // Different FG!
        ProductionRelease: { Status: 'RELEASED', ReleaseNumber: 'REL-01' },
      } as any);
      mockPrismaService.pokayokeScanHistory.findFirst.mockResolvedValue({
        PoId: 'PO-MISMATCH',
        Status: 'SUKSES',
      } as any);

      await expect(service.create(createDto, 'OPERATOR')).rejects.toThrow(
        /tidak sesuai dengan Finish Good pada Forecast/,
      );
    });
  });

  describe('findByOperatorNik', () => {
    it('should return operator and reports for valid NIK', async () => {
      const mockManPower = {
        Uid: 'uid-1',
        Nik: 'NIK001',
        Name: 'Operator One',
        Line: 'Line 1',
      };

      const mockReports = [
        {
          Id: 1,
          Date: '2026-09-16',
          Time: '09:00:00',
          ProductionStamp: new Date(),
          Qty: 50,
          NgQty: 2,
          RecordType: 'ONE',
          FinishGoodId: 'FG-001',
          ForecastId: 'PO-001',
          PoNumber: 'PO-001',
          CreatedAt: new Date(),
          FGData: { PartNumber: 'FG-001', PartName: 'Part 1' },
          ForecastData: {
            PoId: 'PO-001',
            PoNumber: 'PO-001',
            VendorName: 'Vendor',
          },
        },
      ];

      mockPrismaService.manPower.findFirst.mockResolvedValue(
        mockManPower as any,
      );
      mockPrismaService.productionReport.findMany.mockResolvedValue(
        mockReports as any,
      );

      const result = await service.findByOperatorNik('NIK001');

      expect(result.operator).toEqual(mockManPower);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].forecastId).toBe('PO-001');
    });

    it('should return empty list when operator NIK not found', async () => {
      mockPrismaService.manPower.findFirst.mockResolvedValue(null);

      const result = await service.findByOperatorNik('UNKNOWN');

      expect(result.operator).toBeNull();
      expect(result.data).toEqual([]);
    });
  });

  describe('getActiveForecasts', () => {
    it('should return only forecasts with RELEASED release and SUKSES pokayoke scan', async () => {
      const mockCandidates = [
        {
          PoId: 'PO-1',
          PoNumber: 'PON-1',
          FinishGoodId: 'FG-1',
          VendorName: 'Vendor 1',
          DeliveryDate: new Date(),
          Qty: 100,
          PartData: { PartName: 'Part 1' },
          ProductionRelease: { ReleaseNumber: 'PR-1' },
        },
        {
          PoId: 'PO-2',
          PoNumber: 'PON-2',
          FinishGoodId: 'FG-1',
          VendorName: 'Vendor 1',
          DeliveryDate: new Date(),
          Qty: 50,
          PartData: { PartName: 'Part 1' },
          ProductionRelease: { ReleaseNumber: 'PR-1' },
        },
      ];

      mockPrismaService.forecast.findMany.mockResolvedValue(
        mockCandidates as any,
      );
      // Only PO-1 has pokayoke scan!
      mockPrismaService.pokayokeScanHistory.findMany.mockResolvedValue([
        { PoId: 'PO-1' },
      ] as any);

      const result = await service.getActiveForecasts('FG-1');

      expect(result).toHaveLength(1);
      expect(result[0].poId).toBe('PO-1');
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
