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
    RackLocation: 'RACK-A1',
    QtyRack: 50,
    QtyWarehouse: 100,
    IsActive: true,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      material: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([mockMaterial]),
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
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      businessCommand: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ Id: 'command-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      actionAuditEvent: { create: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([
        {
          BusinessDate: new Date('2026-10-29T00:00:00.000Z'),
          LastSequence: 1,
        },
      ]),
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
      expect(prismaService.inventoryLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ ReferenceDoc: 'TTR-2910260001' }),
      });
      expect(logService.startProcess).toHaveBeenCalled();
      expect(logService.completeProcess).toHaveBeenCalled();
    });

    it.each(['MAT-001', 'rack-a1'])(
      'accepts a scan matching the selected material: %s',
      async (scanCode) => {
        prismaService.material.findUnique.mockResolvedValue(mockMaterial);

        const result = await service.transferToRack(
          'MAT-001',
          10,
          'admin',
          undefined,
          scanCode,
        );

        expect(result.success).toBe(true);
        expect(prismaService.inventoryLedger.create).toHaveBeenCalledTimes(2);
      },
    );

    it('rejects a scan for another material without changing stock', async () => {
      prismaService.material.findUnique.mockResolvedValue(mockMaterial);

      await expect(
        service.transferToRack('MAT-001', 10, 'admin', undefined, 'RACK-B2'),
      ).rejects.toThrow(BadRequestException);

      expect(prismaService.material.update).not.toHaveBeenCalled();
      expect(prismaService.inventoryLedger.create).not.toHaveBeenCalled();
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
          UpdatedBy: 'admin',
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

  describe('getTransferHistory', () => {
    it('should return paginated transfer history with status and paired data', async () => {
      const mockWhLedger = {
        Id: 'wh-1',
        ReferenceDoc: 'TRANSFER-TO-RACK-001',
        MaterialId: 'MAT-001',
        Location: 'WAREHOUSE',
        TransactionType: 'TRANSFER_TO_RACK',
        BalanceBefore: 100,
        QtyIn: 0,
        QtyOut: 20,
        BalanceAfter: 80,
        TransactionDate: new Date(),
        CreatedBy: 'admin',
        Notes: 'Transfer to Rack',
      };
      const mockRackLedger = {
        Id: 'rack-1',
        ReferenceDoc: 'TRANSFER-TO-RACK-001',
        MaterialId: 'MAT-001',
        Location: 'RACK',
        TransactionType: 'TRANSFER_TO_RACK',
        BalanceBefore: 50,
        QtyIn: 20,
        QtyOut: 0,
        BalanceAfter: 70,
        TransactionDate: new Date(),
        CreatedBy: 'admin',
      };

      prismaService.inventoryLedger.count.mockResolvedValue(1);
      prismaService.inventoryLedger.findMany
        .mockResolvedValueOnce([mockWhLedger])
        .mockResolvedValueOnce([mockRackLedger])
        .mockResolvedValueOnce([]); // no revert
      prismaService.material.findMany.mockResolvedValue([mockMaterial]);

      const result = await service.getTransferHistory({ page: 1, limit: 50 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].referenceDoc).toBe('TRANSFER-TO-RACK-001');
      expect(result.data[0].qty).toBe(20);
      expect(result.data[0].status).toBe('COMPLETED');
      expect(result.data[0].partName).toBe('Test Material');
      expect(result.meta.totalItems).toBe(1);
    });
  });

  describe('revertTransfer', () => {
    it('should successfully revert a transfer, update stock and create reversal ledger entries', async () => {
      const mockWhLedger = {
        Id: 'wh-1',
        ReferenceDoc: 'TRANSFER-TO-RACK-001',
        MaterialId: 'MAT-001',
        Location: 'WAREHOUSE',
        TransactionType: 'TRANSFER_TO_RACK',
        QtyIn: 0,
        QtyOut: 20,
      };

      const mockRackLedger = {
        Id: 'rack-1',
        ReferenceDoc: 'TRANSFER-TO-RACK-001',
        MaterialId: 'MAT-001',
        Location: 'RACK',
        TransactionType: 'TRANSFER_TO_RACK',
        QtyIn: 20,
        QtyOut: 0,
      };
      prismaService.inventoryLedger.findMany.mockResolvedValue([
        mockWhLedger,
        mockRackLedger,
      ]);
      prismaService.inventoryLedger.findFirst.mockResolvedValue(null);

      prismaService.material.findUnique.mockResolvedValue(mockMaterial);
      prismaService.material.update.mockResolvedValue({
        ...mockMaterial,
        QtyWarehouse: 120,
        QtyRack: 30,
      });
      prismaService.inventoryLedger.create.mockResolvedValue({});

      const result = await service.revertTransfer(
        'TRANSFER-TO-RACK-001',
        'admin',
        'Salah kirim',
        '00000000-0000-4000-8000-000000000003',
      );

      expect(result.success).toBe(true);
      expect(result.referenceDoc).toBe('TRANSFER-TO-RACK-001');
      expect(result.warehouseAfter).toBe(120); // 100 + 20
      expect(result.rackAfter).toBe(30); // 50 - 20
      expect(prismaService.material.update).toHaveBeenCalledWith({
        where: { PartNumber: 'MAT-001' },
        data: {
          QtyWarehouse: 120,
          QtyRack: 30,
          UpdatedBy: 'admin',
        },
      });
      expect(prismaService.inventoryLedger.create).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException if transfer does not exist', async () => {
      prismaService.inventoryLedger.findMany.mockResolvedValue([]);

      await expect(
        service.revertTransfer(
          'NON-EXISTENT',
          'admin',
          'Wrong transfer',
          '00000000-0000-4000-8000-000000000004',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if transfer has already been reverted', async () => {
      prismaService.inventoryLedger.findMany.mockResolvedValue([
        {
          ReferenceDoc: 'TRANSFER-TO-RACK-001',
          MaterialId: 'MAT-001',
          Location: 'WAREHOUSE',
          QtyIn: 0,
          QtyOut: 20,
        },
        {
          ReferenceDoc: 'TRANSFER-TO-RACK-001',
          MaterialId: 'MAT-001',
          Location: 'RACK',
          QtyIn: 20,
          QtyOut: 0,
        },
      ]);
      prismaService.inventoryLedger.findFirst.mockResolvedValue({
        ReferenceDoc: 'REVERT-TRANSFER-TO-RACK-001',
      });

      await expect(
        service.revertTransfer(
          'TRANSFER-TO-RACK-001',
          'admin',
          'Duplicate revert',
          '00000000-0000-4000-8000-000000000005',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if rack stock is insufficient to revert', async () => {
      prismaService.inventoryLedger.findMany.mockResolvedValue([
        {
          ReferenceDoc: 'TRANSFER-TO-RACK-001',
          MaterialId: 'MAT-001',
          Location: 'WAREHOUSE',
          QtyIn: 0,
          QtyOut: 100,
        },
        {
          ReferenceDoc: 'TRANSFER-TO-RACK-001',
          MaterialId: 'MAT-001',
          Location: 'RACK',
          QtyIn: 100,
          QtyOut: 0,
        },
      ]);
      prismaService.inventoryLedger.findFirst.mockResolvedValue(null);

      // material only has 50 in rack
      prismaService.material.findUnique.mockResolvedValue(mockMaterial);

      await expect(
        service.revertTransfer(
          'TRANSFER-TO-RACK-001',
          'admin',
          'Wrong quantity',
          '00000000-0000-4000-8000-000000000006',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
