import { Test, TestingModule } from '@nestjs/testing';
import { ShoppingService } from './shopping.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OutboxService } from '../../common/outbox/outbox.service';

describe('ShoppingService', () => {
  let service: ShoppingService;
  let prismaService: any;
  let logService: any;
  let outboxService: { create: jest.Mock };

  beforeEach(async () => {
    prismaService = {
      labelData: {
        findMany: jest.fn().mockResolvedValue([{ RequiresAssembly: false }]),
      },
      forecast: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
      productionRelease: { findUnique: jest.fn() },
      billOfMaterials: { findMany: jest.fn() },
      finishGood: { findUnique: jest.fn(), update: jest.fn() },
      boxQTY: { findUnique: jest.fn() },
      material: { findUnique: jest.fn() },
      shopping: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      stockOpname: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      inventoryLedger: {
        create: jest.fn(),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { QtyIn: 5, QtyOut: 0 } }),
      },
      outboxEvent: { upsert: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn((cb) => cb(prismaService)),
    };

    logService = {
      startProcess: jest
        .fn()
        .mockResolvedValue({ ProcessId: 'PR123', FunctionId: 'SHOPPING' }),
      addLog: jest.fn().mockResolvedValue({}),
      completeProcess: jest.fn().mockResolvedValue(undefined),
    };
    outboxService = {
      create: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShoppingService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
        { provide: OutboxService, useValue: outboxService },
      ],
    }).compile();

    service = module.get<ShoppingService>(ShoppingService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getForecastPickingStatus', () => {
    it('should return picking status for forecast', async () => {
      const mockForecast = {
        PoId: 'PO-001',
        FinishGoodId: 'FG-001',
        Qty: 100,
        ProductionReleaseId: 'rel-1',
        PartData: { PartNumber: 'FG-001', PartName: 'Finish Good A' },
      };
      const mockProductionRelease = { Status: 'RELEASED' };
      const mockBom = [
        {
          Id: 1,
          Qty: 2,
          MaterialData: { PartNumber: 'MAT-001', PartName: 'Material A' },
        },
      ];

      prismaService.forecast.findUnique.mockResolvedValue(mockForecast);
      prismaService.productionRelease.findUnique.mockResolvedValue(
        mockProductionRelease,
      );
      prismaService.billOfMaterials.findMany.mockResolvedValue(mockBom);
      prismaService.shopping.findMany.mockResolvedValue([]);

      const result = await service.getForecastPickingStatus('PO-001');
      expect(result.forecastId).toBe('PO-001');
    });

    it('should throw NotFoundException when forecast not found', async () => {
      prismaService.forecast.findUnique.mockResolvedValue(null);
      await expect(service.getForecastPickingStatus('INVALID')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe.skip('part tag printing', () => {
    const forecast = {
      PoId: 'PO-001',
      FinishGoodId: 'FG-001',
      Qty: 24,
      VendorCode: 'VENDOR-001',
      Classification: 'A',
      DeliveryDate: new Date('2026-08-20T00:00:00.000Z'),
      PoNumber: 'PO-NUMBER-001',
      ReceivingArea: 'RECEIVING-A',
    };
    const finishGood = {
      PartNumber: 'FG-001',
      PartName: 'Finish Good A',
      Qty: 24,
    };

    it('emits forecast, finish good, box quantity, and qtyPerbox', async () => {
      const boxQTY = { PartNumber: 'FG-001', Qty: 6 };
      prismaService.forecast.findUnique.mockResolvedValue(forecast);
      prismaService.finishGood.findUnique.mockResolvedValue(finishGood);
      prismaService.boxQTY.findUnique.mockResolvedValue(boxQTY);

      await service['emitPartTag']('PO-001', 'FG-001', 'PR123');

      expect(printerService.printPartTagAnsei).toHaveBeenCalledWith({
        poId: 'PO-001',
        qtyOrder: 24,
        partNumber: 'FG-001',
        partName: 'Finish Good A',
        vendorCode: 'VENDOR-001',
        classificationCode: 'A',
        deliveryDate: forecast.DeliveryDate,
        qtyPerbox: 6,
        poNumber: 'PO-NUMBER-001',
        receivingArea: 'RECEIVING-A',
      });
      expect(logService.addLog).toHaveBeenCalledWith(
        expect.objectContaining({
          processId: 'PR123',
          type: 'INFO',
          message: expect.stringContaining('emitted'),
        }),
      );
    });

    it('falls back qtyPerbox to forecast quantity without BoxQTY', async () => {
      prismaService.forecast.findUnique.mockResolvedValue(forecast);
      prismaService.finishGood.findUnique.mockResolvedValue(finishGood);
      prismaService.boxQTY.findUnique.mockResolvedValue(null);

      await service['emitPartTag']('PO-001', 'FG-001', 'PR123');

      expect(printerService.printPartTagAnsei).toHaveBeenCalledWith(
        expect.objectContaining({ qtyPerbox: 24 }),
      );
    });

    it('audit-logs an emit failure without rejecting', async () => {
      prismaService.forecast.findUnique.mockResolvedValue(forecast);
      prismaService.finishGood.findUnique.mockResolvedValue(finishGood);
      prismaService.boxQTY.findUnique.mockResolvedValue(null);
      printerService.printPartTagAnsei.mockRejectedValue(
        new Error('Queue error'),
      );

      await expect(
        service['emitPartTag']('PO-001', 'FG-001', 'PR123'),
      ).resolves.toBeUndefined();
      expect(logService.addLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ERROR',
          message: expect.stringContaining('failed'),
        }),
      );
    });

    it('does not reject when failure auditing also fails', async () => {
      prismaService.forecast.findUnique.mockRejectedValue(
        new Error('database'),
      );
      logService.addLog.mockRejectedValue(new Error('audit'));

      await expect(
        service['emitPartTag']('PO-001', 'FG-001', 'PR123'),
      ).resolves.toBeUndefined();
      expect(printerService.printPartTagAnsei).not.toHaveBeenCalled();
    });
  });

  describe('create ADDITIONAL shopping', () => {
    it('sets ForecastId to null and allows free picking without foreign key error', async () => {
      const mockMaterial = {
        Id: 1,
        PartNumber: 'MAT-001',
        PartName: 'Material A',
        QtyRack: 10,
        IsActive: true,
      };

      const mockCreatedShopping = {
        Id: 'SHP-20260916-0001',
        ForecastId: null,
        MaterialId: 'MAT-001',
        QtyPick: 2,
        Type: 'ADDITIONAL',
        Description: '',
        CreatedBy: 'test',
        CreatedAt: new Date(),
        UpdatedAt: new Date(),
        MaterialData: mockMaterial,
        ForecastData: null,
      };

      prismaService.material.findUnique.mockResolvedValue(mockMaterial);
      prismaService.material.update = jest.fn().mockResolvedValue({
        ...mockMaterial,
        QtyRack: 8,
      });
      prismaService.shopping.findMany = jest.fn().mockResolvedValue([]);
      prismaService.shopping.create = jest
        .fn()
        .mockResolvedValue(mockCreatedShopping);

      const result = await service.create(
        {
          materialId: 'MAT-001',
          qtyPick: 2,
          type: 'ADDITIONAL',
          forecastId: 'ADDITIONAL',
          description: '',
        },
        'test',
      );

      expect(result).toBeDefined();
      expect(result.ForecastId).toBeNull();
      expect(prismaService.shopping.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ForecastId: null,
            MaterialId: 'MAT-001',
            QtyPick: 2,
            Type: 'ADDITIONAL',
          }),
        }),
      );
    });

    it('should throw BadRequestException if active inventory counting is in progress', async () => {
      prismaService.stockOpname.findFirst.mockResolvedValueOnce({
        Id: 'opname-1',
        OpnameNumber: 'IC-2026-001',
        Category: 'MATERIAL',
        Status: 'IN_PROGRESS',
      });

      let caughtError: unknown;
      try {
        await service.create(
          {
            materialId: 'MAT-001',
            qtyPick: 2,
            type: 'ADDITIONAL',
            forecastId: 'ADDITIONAL',
            description: '',
          },
          'test',
        );
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(BadRequestException);
    });
  });

  describe('production result idempotency', () => {
    const dto = {
      materialId: 'MAT-001',
      qtyPick: 2,
      type: 'REGULER' as const,
      forecastId: 'PO-001',
      description: '',
    };

    beforeEach(() => {
      prismaService.forecast.findUnique.mockResolvedValue({
        PoId: 'PO-001',
        Qty: 1,
        FinishGoodId: 'FG-001',
        ProductionRelease: { Status: 'RELEASED' },
      });
      jest.spyOn(service, 'generateShoppingId').mockResolvedValue('SHP-001');
      prismaService.material.findUnique.mockResolvedValue({
        QtyRack: 10,
        PartName: 'Material A',
      });
      prismaService.material.update = jest.fn().mockResolvedValue({});
      prismaService.shopping.create.mockResolvedValue({
        Id: 'SHP-001',
        ForecastId: 'PO-001',
      });
      prismaService.billOfMaterials.findMany.mockResolvedValue([
        {
          Qty: 2,
          MaterialData: { PartNumber: 'MAT-001' },
        },
      ]);
      prismaService.billOfMaterials.findFirst = jest
        .fn()
        .mockResolvedValue({ Qty: 2 });
      prismaService.shopping.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ MaterialId: 'MAT-001', QtyPick: 2 }]);
      prismaService.finishGood.findUnique.mockResolvedValue({
        Qty: 5,
        PartName: 'Finish Good A',
      });
      prismaService.finishGood.update.mockResolvedValue({});
      prismaService.forecast.findUniqueOrThrow.mockResolvedValue({
        PoId: 'PO-001',
        Qty: 1,
        VendorCode: 'VENDOR-001',
        Classification: 'A',
        DeliveryDate: new Date('2026-08-20T00:00:00.000Z'),
        PoNumber: 'PO-NUMBER-001',
        ReceivingArea: 'RECEIVING-A',
      });
      prismaService.boxQTY.findUnique.mockResolvedValue({ Qty: 1 });
    });

    it('does not increment finish good or add a duplicate production ledger when the durable claim exists', async () => {
      prismaService.$executeRaw
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      await service['executeShoppingTransaction'](dto, 'test', 'PR123', {
        finishGoodId: 'FG-001',
        forecastQty: 1,
        shouldIncrementFinishGood: true,
      });

      expect(prismaService.finishGood.update).not.toHaveBeenCalled();
      expect(prismaService.inventoryLedger.create).toHaveBeenCalledTimes(1);
      expect(prismaService.inventoryLedger.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            TransactionType: 'PRODUCTION_RESULT',
          }),
        }),
      );
    });

    it.each([
      {
        Qty: 2,
        FinishGoodId: 'FG-001',
        ProductionRelease: { Status: 'RELEASED' },
      },
      {
        Qty: 1,
        FinishGoodId: 'FG-OTHER',
        ProductionRelease: { Status: 'RELEASED' },
      },
      {
        Qty: 1,
        FinishGoodId: 'FG-001',
        ProductionRelease: { Status: 'COMPLETED' },
      },
      null,
    ])(
      'rejects a forecast amendment or close before the shopping transaction begins',
      async (forecast) => {
        prismaService.forecast.findUnique.mockResolvedValue(forecast);
        await expect(
          service['executeShoppingTransaction'](dto, 'test', 'PR123', {
            finishGoodId: 'FG-001',
            forecastQty: 1,
            shouldIncrementFinishGood: true,
          }),
        ).rejects.toThrow('Forecast changed');
        expect(prismaService.shopping.create).not.toHaveBeenCalled();
        expect(prismaService.inventoryLedger.create).not.toHaveBeenCalled();
      },
    );

    it('prints assembly labels at shopping completion without crediting finish goods', async () => {
      prismaService.labelData.findMany.mockResolvedValue([
        { RequiresAssembly: true },
      ]);
      prismaService.$executeRaw.mockResolvedValue(1);
      await service['executeShoppingTransaction'](dto, 'test', 'PR123', {
        finishGoodId: 'FG-001',
        forecastQty: 1,
      });
      expect(prismaService.finishGood.update).not.toHaveBeenCalled();
      expect(prismaService.inventoryLedger.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            TransactionType: 'PRODUCTION_RESULT',
          }),
        }),
      );
      expect(outboxService.create).toHaveBeenCalled();
    });

    it('creates exactly one production result after transaction-local completion recheck wins the claim', async () => {
      prismaService.$executeRaw.mockResolvedValue(1);

      await service['executeShoppingTransaction'](dto, 'test', 'PR123', {
        finishGoodId: 'FG-001',
        forecastQty: 1,
        shouldIncrementFinishGood: false,
      });

      expect(prismaService.finishGood.update).toHaveBeenCalledWith({
        where: { PartNumber: 'FG-001' },
        data: { Qty: 6 },
      });
      expect(prismaService.inventoryLedger.create).toHaveBeenCalledTimes(2);
      expect(prismaService.inventoryLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            TransactionType: 'PRODUCTION_RESULT',
            BalanceBefore: 5,
            BalanceAfter: 6,
          }),
        }),
      );
    });
  });
});
