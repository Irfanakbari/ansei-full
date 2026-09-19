import { Test, TestingModule } from '@nestjs/testing';
import { TransferService } from './transfer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { LogProcessModel } from '../../generated/prisma/models';

describe('TransferService', () => {
  let service: TransferService;
  let prismaService: any;
  let logService: any;

  const mockLogProcess: LogProcessModel = {
    ProcessId: 'PR20260607123456123456',
    FunctionId: 'TRANSFER_001',
    FunctionName: 'TransferService.TransferToRack',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'testuser',
  };

  const mockMaterial = {
    Id: 1,
    PartNumber: 'MAT-001',
    PartName: 'Test Material',
    QtyRack: 50,
    QtyWarehouse: 100,
    IsActive: true,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      material: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      inventoryLedger: {
        aggregate: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve({
            _sum: {
              QtyIn: where.Location === 'WAREHOUSE' ? 100 : 50,
              QtyOut: 0,
            },
          }),
        ),
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrismaService)),
    };

    const mockLogService = {
      startProcess: jest.fn().mockResolvedValue(mockLogProcess),
      addLog: jest.fn().mockResolvedValue({}),
      completeProcess: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LogProcessService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<TransferService>(TransferService);
    prismaService = module.get(PrismaService);
    logService = module.get(LogProcessService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('transferToRack', () => {
    it('should transfer stock from warehouse to rack', async () => {
      prismaService.material.findUnique
        .mockResolvedValueOnce(mockMaterial) // validateMaterialExists
        .mockResolvedValueOnce(mockMaterial) // get current stock
        .mockResolvedValueOnce(mockMaterial); // in transaction
      prismaService.material.update.mockResolvedValue(mockMaterial);
      prismaService.inventoryLedger.create.mockResolvedValue({});

      const result = await service.transferToRack('MAT-001', 30, 'admin');

      expect(result.success).toBe(true);
      expect(result.partNumber).toBe('MAT-001');
      expect(result.warehouseBefore).toBe(100);
      expect(result.warehouseAfter).toBe(70);
      expect(result.rackBefore).toBe(50);
      expect(result.rackAfter).toBe(80);
      expect(result.transferQty).toBe(30);
      expect(logService.startProcess).toHaveBeenCalled();
      expect(logService.completeProcess).toHaveBeenCalled();
    });

    it('should throw BadRequestException if material not found', async () => {
      prismaService.material.findUnique.mockResolvedValue(null);

      await expect(
        service.transferToRack('INVALID', 10, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if insufficient warehouse stock', async () => {
      const lowStockMaterial = { ...mockMaterial, QtyWarehouse: 5 };
      prismaService.material.findUnique.mockResolvedValue(lowStockMaterial);

      await expect(
        service.transferToRack('MAT-001', 100, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create InventoryLedger entries', async () => {
      prismaService.material.findUnique
        .mockResolvedValueOnce(mockMaterial) // validateMaterialExists
        .mockResolvedValueOnce(mockMaterial) // get current stock
        .mockResolvedValueOnce(mockMaterial); // in transaction
      prismaService.material.update.mockResolvedValue(mockMaterial);
      prismaService.inventoryLedger.create.mockResolvedValue({});

      await service.transferToRack('MAT-001', 20, 'admin');

      // Should create 2 ledger entries (warehouse and rack)
      expect(prismaService.inventoryLedger.create).toHaveBeenCalledTimes(2);
    });

    it('should update material stock', async () => {
      prismaService.material.findUnique
        .mockResolvedValueOnce(mockMaterial) // validateMaterialExists
        .mockResolvedValueOnce(mockMaterial) // get current stock
        .mockResolvedValueOnce(mockMaterial); // in transaction
      prismaService.material.update.mockResolvedValue({
        ...mockMaterial,
        QtyWarehouse: 80,
        QtyRack: 70,
      });

      await service.transferToRack('MAT-001', 20, 'admin');

      expect(prismaService.material.update).toHaveBeenCalledWith({
        where: { PartNumber: 'MAT-001' },
        data: {
          QtyWarehouse: 80, // 100 - 20
          QtyRack: 70, // 50 + 20
        },
      });
    });

    it('should log process steps', async () => {
      prismaService.material.findUnique.mockResolvedValue(mockMaterial);
      prismaService.material.update.mockResolvedValue(mockMaterial);

      await service.transferToRack('MAT-001', 10, 'admin');

      expect(logService.addLog).toHaveBeenCalled();
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
        undefined,
        expect.any(Object),
      );
    });
  });
});
