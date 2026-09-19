// Snapshot transaction invariants are exercised against PostgreSQL in phase-one.database.spec.ts.
jest.mock('../../common/helpers/bom-snapshot.helper', () => ({
  snapshotRelease: () => Promise.resolve(undefined),
  latestSnapshot: jest.fn().mockResolvedValue(null),
  assertNoOutstandingReplacement: () => Promise.resolve(undefined),
}));
import { Test, TestingModule } from '@nestjs/testing';
import * as snapshots from '../../common/helpers/bom-snapshot.helper';
import { ForecastService } from './forecast.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { ExcelService } from '../../common/utils/excel.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrinterService } from '../../common/printer/printer.service';
import type { Prisma } from '../../generated/prisma/client';

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
      $executeRaw: jest.fn(),
      $transaction: jest.fn(),
      pokayokeScanHistory: { count: jest.fn().mockResolvedValue(0) },
      forecast: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ProductionRelease: null,
          ShoppingCompletion: null,
          _count: { Shopping: 0, DeliveryHistory: 0, ProductionReport: 0 },
          LabelData: [],
        }),
        aggregate: jest.fn().mockResolvedValue({ _sum: { Qty: 112 } }),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        createMany: jest.fn(),
      },
      finishGood: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ IsPassthrough: false }),
        findMany: jest.fn(),
      },
      productionRelease: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      labelData: {
        findFirst: jest.fn().mockResolvedValue({ RequiresAssembly: true }),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      boxQTY: { findUnique: jest.fn().mockResolvedValue({ Qty: 5 }) },
    };
    prismaService.$transaction.mockImplementation(
      (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(prismaService),
    );

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
      prismaService.forecast.count.mockResolvedValue(1);
      prismaService.forecast.findMany.mockResolvedValue(mockForecasts);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual(mockForecasts);
    });

    it('should filter forecasts by an inclusive delivery date range', async () => {
      prismaService.forecast.count.mockResolvedValue(0);
      prismaService.forecast.findMany.mockResolvedValue([]);

      await service.findAll({
        page: 1,
        limit: 50,
        deliveryDateFrom: '2026-09-01',
        deliveryDateTo: '2026-09-30',
      });

      const expectedWhere = {
        DeliveryDate: {
          gte: new Date('2026-09-01T00:00:00.000Z'),
          lte: new Date('2026-09-30T23:59:59.999Z'),
        },
      };
      expect(prismaService.forecast.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
      expect(prismaService.forecast.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
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

  describe('safe forecast amendments', () => {
    const forecast = {
      Id: 1,
      PoId: 'PO-001',
      Qty: 10,
      FinishGoodId: 'FG-001',
      ProductionReleaseId: 'rel-1',
    };
    const clean = {
      ProductionRelease: { Status: 'RELEASED' },
      ShoppingCompletion: null,
      _count: { Shopping: 0, DeliveryHistory: 0, ProductionReport: 0 },
      LabelData: [{ Scanned: false, _count: { PokayokeHistory: 0 } }],
    };
    beforeEach(() => {
      prismaService.forecast.findUnique.mockResolvedValue(forecast);
      prismaService.forecast.findUniqueOrThrow.mockResolvedValue(clean);
      prismaService.productionRelease.findUnique.mockResolvedValue({
        Id: 'rel-1',
        Status: 'RELEASED',
      });
      prismaService.forecast.update.mockResolvedValue({ ...forecast, Qty: 12 });
    });

    it('allows a clean RELEASED forecast and replaces labels and target atomically', async () => {
      await service.update('1', { qty: 12 }, 'admin');
      expect(prismaService.labelData.deleteMany).toHaveBeenCalledWith({
        where: { ForecastId: 'PO-001' },
      });
      expect(prismaService.labelData.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ QtyThisBox: 5, ForecastId: 'PO-001' }),
          expect.objectContaining({ QtyThisBox: 5, ForecastId: 'PO-001' }),
          expect.objectContaining({ QtyThisBox: 2, ForecastId: 'PO-001' }),
        ],
      });
      expect(prismaService.productionRelease.update).toHaveBeenCalledWith({
        where: { Id: 'rel-1' },
        data: { TotalTargetQty: 112 },
      });
      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(logService.completeProcess).toHaveBeenCalledWith(
        'PR123',
        'SUCCESS',
        undefined,
        prismaService,
      );
    });

    it('preserves snapshotted PO identity before any shopping activity', async () => {
      jest
        .mocked(snapshots.latestSnapshot)
        .mockResolvedValueOnce({ Id: 'snapshot' } as Awaited<
          ReturnType<typeof snapshots.latestSnapshot>
        >);
      await expect(
        service.update('1', { poId: 'PO-NEW' }, 'admin'),
      ).rejects.toThrow('snapshotted PO');
      expect(prismaService.forecast.update).not.toHaveBeenCalled();
      expect(prismaService.labelData.deleteMany).not.toHaveBeenCalled();
    });

    it('regenerates labels for a changed PO and finish good without historical snapshots', async () => {
      prismaService.forecast.update.mockResolvedValue({
        ...forecast,
        PoId: 'PO-NEW',
        FinishGoodId: 'FG-NEW',
      });
      await service.update(
        '1',
        { poId: 'PO-NEW', finishGoodId: 'FG-NEW' },
        'admin',
      );
      expect(prismaService.boxQTY.findUnique).toHaveBeenCalledWith({
        where: { PartNumber: 'FG-NEW' },
      });
      expect(prismaService.labelData.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            LabelNumber: 'PO-NEW00100005',
            ForecastId: 'PO-NEW',
            FinishGoodId: 'FG-NEW',
          }),
        ]),
      });
    });

    it('preserves the released assembly rule for quantity changes despite master changes', async () => {
      prismaService.labelData.findFirst.mockResolvedValue({
        RequiresAssembly: false,
      });
      prismaService.finishGood.findUniqueOrThrow.mockResolvedValue({
        IsPassthrough: false,
      });
      await service.update('1', { qty: 12 }, 'admin');
      expect(prismaService.labelData.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ RequiresAssembly: false }),
        ]),
      });
      expect(prismaService.finishGood.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('keeps label identifiers stable for metadata-only edits', async () => {
      await service.update('1', { vendorName: 'Updated vendor' }, 'admin');
      expect(prismaService.labelData.deleteMany).not.toHaveBeenCalled();
      expect(prismaService.labelData.createMany).not.toHaveBeenCalled();
    });

    it.each([
      { ...clean, _count: { ...clean._count, Shopping: 1 } },
      { ...clean, _count: { ...clean._count, DeliveryHistory: 1 } },
      { ...clean, _count: { ...clean._count, ProductionReport: 1 } },
      {
        ...clean,
        LabelData: [{ Scanned: true, _count: { PokayokeHistory: 0 } }],
      },
      {
        ...clean,
        LabelData: [{ Scanned: false, _count: { PokayokeHistory: 1 } }],
      },
      {
        ...clean,
        LabelData: [
          {
            Scanned: false,
            _count: { PokayokeHistory: 0, AssemblySessions: 1 },
          },
        ],
      },
      { ...clean, ShoppingCompletion: { ForecastId: 'PO-001' } },
    ])(
      'blocks edits and deletes after any operational activity, including failed scans',
      async (activity) => {
        prismaService.forecast.findUniqueOrThrow.mockResolvedValue(activity);
        await expect(service.update('1', { qty: 1 }, 'admin')).rejects.toThrow(
          'operational activity',
        );
        await expect(service.remove('1', 'admin')).rejects.toThrow(
          'operational activity',
        );
        expect(prismaService.forecast.update).not.toHaveBeenCalled();
        expect(prismaService.forecast.delete).not.toHaveBeenCalled();
        expect(prismaService.labelData.deleteMany).not.toHaveBeenCalled();
      },
    );

    it.each(['COMPLETED', 'CANCELLED'])(
      'blocks edits in %s releases',
      async (status) => {
        prismaService.forecast.findUniqueOrThrow.mockResolvedValue({
          ...clean,
          ProductionRelease: { Status: status },
        });
        await expect(service.update('1', { qty: 12 }, 'admin')).rejects.toThrow(
          'cannot be changed',
        );
      },
    );

    it('requires unlinking before deleting a clean assigned forecast', async () => {
      await expect(service.remove('1', 'admin')).rejects.toThrow('Untag');
      expect(prismaService.forecast.delete).not.toHaveBeenCalled();
    });

    it('blocks historical scans even if their label relation is no longer present', async () => {
      prismaService.pokayokeScanHistory.count.mockResolvedValue(1);
      await expect(service.update('1', { qty: 12 }, 'admin')).rejects.toThrow(
        'operational activity',
      );
      expect(prismaService.forecast.update).not.toHaveBeenCalled();
    });

    it('fails the amendment transaction when the new finish good has no box quantity', async () => {
      prismaService.boxQTY.findUnique.mockResolvedValue(null);
      await expect(service.update('1', { qty: 12 }, 'admin')).rejects.toThrow(
        'Box Qty',
      );
      expect(prismaService.labelData.createMany).not.toHaveBeenCalled();
      expect(logService.completeProcess).toHaveBeenLastCalledWith(
        'PR123',
        'FAILED',
      );
    });

    it.each([0, -1, 1.5])(
      'rejects invalid amended quantity %s',
      async (qty) => {
        await expect(service.update('1', { qty }, 'admin')).rejects.toThrow(
          'positive integer',
        );
        expect(prismaService.forecast.update).not.toHaveBeenCalled();
      },
    );
  });
});
