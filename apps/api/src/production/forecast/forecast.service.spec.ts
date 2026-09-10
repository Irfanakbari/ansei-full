import { Test, TestingModule } from '@nestjs/testing';
import { ForecastService } from './forecast.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { ExcelService } from '../../common/utils/excel.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrinterService } from '../../common/printer/printer.service';

describe('ForecastService', () => {
  let service: ForecastService;
  let prismaService: any;
  let excelService: any;
  let logService: any;
  let printerService: any;

  const mockLogProcess = {
    ProcessId: 'PR123',
    FunctionId: 'FORECAST_001',
    FunctionName: 'ForecastService.Create',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'admin',
  };

  beforeEach(async () => {
    prismaService = {
      forecast: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        createMany: jest.fn(),
      },
      finishGood: {
        findMany: jest.fn(),
      },
      productionRelease: {
        findFirst: jest.fn(),
      },
    };

    excelService = {
      readExcelByPosition: jest.fn(),
      parseDateYYYYMMDD: jest.fn(),
    };

    logService = {
      startProcess: jest.fn().mockResolvedValue(mockLogProcess),
      addLog: jest.fn().mockResolvedValue({}),
      completeProcess: jest.fn().mockResolvedValue(undefined),
    };

    printerService = {
      printPartTagAnsei: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForecastService,
        { provide: PrismaService, useValue: prismaService },
        { provide: ExcelService, useValue: excelService },
        { provide: LogProcessService, useValue: logService },
        { provide: PrinterService, useValue: printerService },
      ],
    }).compile();

    service = module.get<ForecastService>(ForecastService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all forecasts', async () => {
      const mockForecasts = [{ Id: 1, PoId: 'PO-001', Qty: 100 }];
      prismaService.forecast.findMany.mockResolvedValue(mockForecasts);

      const result = await service.findAll();

      expect(result).toEqual(mockForecasts);
    });
  });

  describe('findOne', () => {
    it('should return a forecast by id', async () => {
      const mockForecast = { Id: 1, PoId: 'PO-001', Qty: 100 };
      prismaService.forecast.findUnique.mockResolvedValue(mockForecast);

      const result = await service.findOne('1');

      expect(result.PoId).toBe('PO-001');
    });

    it('should throw NotFoundException when not found', async () => {
      prismaService.forecast.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a forecast', async () => {
      const createDto = {
        poId: 'PO-NEW',
        date: new Date(),
        vendorCode: 'V001',
        vendorName: 'Vendor A',
        receivingArea: 'Area 1',
        deliveryDate: new Date(),
        deliveryPeriod: 5,
        classification: 'A',
        poNumber: 'PO123',
        item: 1,
        qty: 100,
        finishGoodId: 'FG-001',
      };

      prismaService.finishGood.findMany.mockResolvedValue([
        { PartNumber: 'FG-001' },
      ]);
      prismaService.forecast.create.mockResolvedValue({ Id: 1, ...createDto });

      const result = await service.create(createDto, 'admin');

      expect(prismaService.forecast.create).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a forecast', async () => {
      const mockForecast = { Id: 1, PoId: 'PO-001' };
      prismaService.forecast.findUnique.mockResolvedValue(mockForecast);

      const result = await service.remove('1', 'admin');

      expect(result.deleted).toBe(true);
    });

    it('should throw NotFoundException when not found', async () => {
      prismaService.forecast.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
