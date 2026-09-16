import { Test, TestingModule } from '@nestjs/testing';
import { ShoppingService } from './shopping.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NotFoundException } from '@nestjs/common';
import { PrinterService } from '../../common/printer/printer.service';

describe('ShoppingService', () => {
  let service: ShoppingService;
  let prismaService: any;
  let logService: any;
  let printerService: { printPartTagAnsei: jest.Mock };

  beforeEach(async () => {
    prismaService = {
      forecast: { findUnique: jest.fn() },
      productionRelease: { findUnique: jest.fn() },
      billOfMaterials: { findMany: jest.fn() },
      finishGood: { findUnique: jest.fn(), update: jest.fn() },
      boxQTY: { findUnique: jest.fn() },
      material: { findUnique: jest.fn() },
      shopping: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      inventoryLedger: { create: jest.fn() },
      $transaction: jest.fn((cb) => cb(prismaService)),
    };

    logService = {
      startProcess: jest
        .fn()
        .mockResolvedValue({ ProcessId: 'PR123', FunctionId: 'SHOPPING' }),
      addLog: jest.fn().mockResolvedValue({}),
      completeProcess: jest.fn().mockResolvedValue(undefined),
    };
    printerService = {
      printPartTagAnsei: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShoppingService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
        { provide: PrinterService, useValue: printerService },
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

  describe('part tag printing', () => {
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
});
