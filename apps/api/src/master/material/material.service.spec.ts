import { OutboxService } from '../../common/outbox/outbox.service';
import { SapItemSyncService } from '../../common/sap/sap-item-sync.service';
import * as ExcelJS from 'exceljs';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MaterialService } from './material.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';

// Mock the PrismaService
jest.mock('../../prisma/prisma.service');
jest.mock('../../common/log-process/log-process.service');

describe('MaterialService', () => {
  let service: MaterialService;
  const writesEnabled = jest.fn();
  const enqueue = jest.fn();

  const mockSatuan = { Id: 1, Name: 'Pcs' };

  const mockMaterial = {
    Id: 1,
    PartNumber: 'MAT-001',
    PartName: 'Baut M8',
    PartNumberSAP: null,
    MinimumStock: 0,
    MaximumStock: 0,
    CreatedAt: new Date(),
    CreatedBy: 'admin',
    UpdatedAt: new Date(),
    Supplier: 'PT. Supplier ABC',
    SatuanId: 1,
    RackLocation: 'RACK-A1',
    QtyRack: 100,
    QtyWarehouse: 500,
    QtyPerBox: 20,
    SatuanData: mockSatuan,
    BillOfMaterials: [],
    IncomingMaterial: [],
    Shopping: [],
    InventoryLedger: [],
    StockOpnameDetail: [],
    _count: {
      BillOfMaterials: 0,
      IncomingMaterial: 0,
      Shopping: 0,
      InventoryLedger: 0,
      StockOpnameDetail: 0,
    },
  };

  const mockLogProcess = {
    ProcessId: 'PR20260606120000123456',
    FunctionId: 'MATERIAL_001',
    FunctionName: 'createMaterial',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'admin',
  };

  let prismaService: {
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    outboxEvent: { findMany: jest.Mock };
    actionAuditEvent: { create: jest.Mock };
    material: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    inventoryLedger: {
      count: jest.Mock;
      create: jest.Mock;
    };
  };

  let logService: {
    startProcess: jest.Mock;
    addLog: jest.Mock;
    completeProcess: jest.Mock;
  };

  beforeEach(async () => {
    writesEnabled.mockReturnValue(false);
    enqueue.mockReset();
    prismaService = {
      $transaction: jest.fn((work) => work(prismaService)),
      $queryRaw: jest.fn(),
      outboxEvent: { findMany: jest.fn().mockResolvedValue([]) },
      actionAuditEvent: { create: jest.fn() },
      material: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      inventoryLedger: {
        count: jest.fn(),
        create: jest.fn(),
      },
    };

    logService = {
      startProcess: jest.fn(),
      addLog: jest.fn(),
      completeProcess: jest.fn(),
    };

    (PrismaService as unknown as jest.Mock).mockImplementation(
      () => prismaService,
    );
    (LogProcessService as unknown as jest.Mock).mockImplementation(
      () => logService,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaterialService,
        { provide: OutboxService, useValue: { create: enqueue } },
        {
          provide: SapItemSyncService,
          useValue: {
            decorate: jest.fn((items: unknown[]) => items),
            materialWritesEnabled: writesEnabled,
          },
        },
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
      ],
    }).compile();

    service = module.get<MaterialService>(MaterialService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all materials with SatuanData', async () => {
      prismaService.material.count.mockResolvedValue(1);
      const expectedMaterials = [mockMaterial];
      prismaService.material.findMany.mockResolvedValue(expectedMaterials);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual(
        expectedMaterials.map((row) => ({
          ...row,
          SAPUpdateStatus: 'DISABLED',
          SAPUpdateCheckedAt: null,
        })),
      );
      expect(prismaService.material.findMany).toHaveBeenCalledWith({
        include: { SatuanData: true, SupplierData: true },
        orderBy: [{ Id: 'asc' }],
        skip: 0,
        take: 50,
        where: {},
      });
    });

    it('should return unpaginated material options with minimal fields', async () => {
      const options = [{ Id: 1, PartNumber: 'MAT-001', PartName: 'Baut M8' }];
      prismaService.material.findMany.mockResolvedValue(options);

      await expect(
        service.findAll({ page: 1, limit: 50, option: true }),
      ).resolves.toEqual(options);
      expect(prismaService.material.count).not.toHaveBeenCalled();
      expect(prismaService.material.findMany).toHaveBeenCalledWith({
        where: {},
        select: { Id: true, PartNumber: true, PartName: true },
        orderBy: [{ PartNumber: 'asc' }],
      });
    });

    it('should return empty array when no materials exist', async () => {
      prismaService.material.count.mockResolvedValue(0);
      prismaService.material.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a material by id with SatuanData', async () => {
      prismaService.material.findUnique.mockResolvedValue(mockMaterial);

      const result = await service.findOne(1);

      expect(result).toEqual(expect.objectContaining(mockMaterial));
      expect(prismaService.material.findUnique).toHaveBeenCalledWith({
        where: { Id: 1 },
        include: { SatuanData: true, SupplierData: true },
      });
    });

    it('should throw NotFoundException when material not found', async () => {
      prismaService.material.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPartNumber', () => {
    it('should return a material by part number', async () => {
      prismaService.material.findUnique.mockResolvedValue(mockMaterial);

      const result = await service.findByPartNumber('MAT-001');

      expect(result).toEqual(expect.objectContaining(mockMaterial));
      expect(prismaService.material.findUnique).toHaveBeenCalledWith({
        where: { PartNumber: 'MAT-001' },
        include: { SatuanData: true, SupplierData: true },
      });
    });

    it('should throw NotFoundException when material with part number not found', async () => {
      prismaService.material.findUnique.mockResolvedValue(null);

      await expect(service.findByPartNumber('INVALID')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a new material', async () => {
      const createDto = {
        partNumber: 'MAT-002',
        partName: 'Baut M10',
        supplier: 'PT. Supplier XYZ',
        satuanId: 1,
        rackLocation: 'RACK-B2',
      };

      const createdMaterial = {
        ...mockMaterial,
        Id: 2,
        PartNumber: 'MAT-002',
        PartName: 'Baut M10',
        SatuanData: mockSatuan,
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.material.findUnique.mockResolvedValue(null);
      prismaService.material.create.mockResolvedValue(createdMaterial);

      const result = await service.create(createDto, 'admin');

      expect(result).toEqual(createdMaterial);
      expect(prismaService.material.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ QtyPerBox: 0 }),
        }),
      );
      expect(logService.startProcess).toHaveBeenCalledWith({
        functionId: 'MATERIAL_001',
        functionName: 'MaterialService.Create',
        createdBy: 'admin',
      });
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw ConflictException when part number already exists', async () => {
      const createDto = {
        partNumber: 'MAT-001',
        partName: 'Baut M10',
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.material.findUnique.mockResolvedValue(mockMaterial);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should log error and complete process as FAILED on exception', async () => {
      const createDto = {
        partNumber: 'MAT-002',
        partName: 'Baut M10',
      };
      const error = new Error('Database error');

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.material.findUnique.mockResolvedValue(null);
      prismaService.material.create.mockRejectedValue(error);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        'Database error',
      );
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'FAILED',
      );
    });
  });

  describe('SAP update outbox', () => {
    beforeEach(() => {
      writesEnabled.mockReturnValue(true);
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.material.findUnique.mockResolvedValue(mockMaterial);
      prismaService.material.update.mockResolvedValue({
        ...mockMaterial,
        PartName: 'New',
      });
    });
    it('enqueues the changed snapshot inside the material transaction with actor audit', async () => {
      await service.update(1, { partName: 'New' }, 'editor');
      expect(enqueue).toHaveBeenCalledWith(
        prismaService,
        expect.objectContaining({
          type: 'SAP_MATERIAL_UPDATE',
          actor: 'editor',
          referenceId: '1',
          payload: {
            materialId: 1,
            itemCode: 'MAT-001',
            partName: 'New',
            minimumStock: 0,
            maximumStock: 0,
          },
        }),
      );
      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(prismaService.actionAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            Actor: 'editor',
            Before: expect.objectContaining({ partName: 'Baut M8' }),
            After: expect.objectContaining({
              partName: 'New',
              ManageStockByWarehouse: 'tNO',
            }),
          }),
        }),
      );
    });
    it('fails the transaction when the durable job cannot be saved', async () => {
      enqueue.mockRejectedValue(new Error('Database unavailable'));
      await expect(
        service.update(1, { partName: 'New' }, 'editor'),
      ).rejects.toThrow('Database unavailable');
    });
    it('does not enqueue unrelated/no-op edits', async () => {
      prismaService.material.update.mockResolvedValue({
        ...mockMaterial,
        Remark: 'changed',
      });
      await service.update(1, { remark: 'changed' }, 'editor');
      expect(enqueue).not.toHaveBeenCalled();
    });
    it('distinguishes delivered changes from item existence', async () => {
      prismaService.outboxEvent.findMany.mockResolvedValue([
        {
          ReferenceId: '1',
          Status: 'SUCCEEDED',
          LastErrorCode: 'SAP_MATERIAL_SYNCED',
          UpdatedAt: new Date(),
          Payload: {
            materialId: 1,
            itemCode: 'MAT-001',
            partName: 'Baut M8',
            minimumStock: 0,
            maximumStock: 0,
          },
        },
      ]);
      expect(await service.findOne(1)).toMatchObject({
        SAPUpdateStatus: 'SYNCED',
      });
      prismaService.material.findUnique.mockResolvedValue({
        ...mockMaterial,
        PartName: 'Newer',
      });
      expect(await service.findOne(1)).toMatchObject({
        SAPUpdateStatus: 'NOT_REQUESTED',
      });
    });
  });

  describe('update', () => {
    it('should reject direct Qty Rack or Qty Warehouse updates', async () => {
      await expect(
        service.update(1, { qtyRack: 999 } as never, 'admin'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update(1, { qtyWarehouse: 999 } as never, 'admin'),
      ).rejects.toThrow(BadRequestException);
      expect(prismaService.material.update).not.toHaveBeenCalled();
    });

    it('should update an existing material', async () => {
      const updateDto = { partName: 'Baut M12 Updated', qtyPerBox: 24 };
      const updatedMaterial = {
        ...mockMaterial,
        PartName: 'Baut M12 Updated',
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.material.findUnique.mockResolvedValue(mockMaterial);
      prismaService.material.update.mockResolvedValue(updatedMaterial);

      const result = await service.update(1, updateDto, 'admin');

      expect(result).toEqual(updatedMaterial);
      expect(prismaService.material.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ QtyPerBox: 24 }),
        }),
      );
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw ConflictException when changing to existing part number', async () => {
      const updateDto = { partNumber: 'MAT-EXISTING' };
      const existingMaterial = {
        ...mockMaterial,
        Id: 2,
        PartNumber: 'MAT-EXISTING',
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.inventoryLedger.count.mockResolvedValue(0);
      prismaService.material.findUnique
        .mockResolvedValueOnce(mockMaterial)
        .mockResolvedValueOnce(existingMaterial);

      await expect(service.update(1, updateDto, 'admin')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when changing part number with existing ledger history', async () => {
      const updateDto = { partNumber: 'MAT-NEW' };
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.material.findUnique.mockResolvedValueOnce(mockMaterial);
      prismaService.inventoryLedger.count.mockResolvedValue(5);

      await expect(service.update(1, updateDto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when updating non-existent material', async () => {
      const updateDto = { partName: 'Updated Name' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.material.findUnique.mockResolvedValue(null);

      await expect(service.update(999, updateDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete an existing material', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.material.findUnique.mockResolvedValue(mockMaterial);
      prismaService.material.delete.mockResolvedValue(mockMaterial);

      const result = await service.remove(1, 'admin');

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when deleting non-existent material', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.material.findUnique.mockResolvedValue(null);

      await expect(service.remove(999, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('transferStock', () => {
    it('should throw BadRequestException when source and target part numbers are identical', async () => {
      await expect(
        service.transferStock(
          {
            sourcePartNumber: 'MAT-001',
            targetPartNumber: 'MAT-001',
            location: 'WAREHOUSE' as any,
            qty: 10,
            reason: 'Test transfer',
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when qty is <= 0', async () => {
      await expect(
        service.transferStock(
          {
            sourcePartNumber: 'MAT-001',
            targetPartNumber: 'MAT-002',
            location: 'WAREHOUSE' as any,
            qty: 0,
            reason: 'Test transfer',
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
  describe('SAP part number', () => {
    beforeEach(() => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.material.create.mockResolvedValue(mockMaterial);
      prismaService.material.update.mockResolvedValue(mockMaterial);
    });

    it.each([undefined, null, '', '   ', '  SAP-001  '])(
      'normalizes create input %s',
      async (value) => {
        prismaService.material.findUnique.mockResolvedValue(null);
        await service.create(
          {
            partNumber: mockMaterial.PartNumber,
            partName: mockMaterial.PartName,
            partNumberSAP: value,
          },
          'tester',
        );
        expect(prismaService.material.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              PartNumberSAP:
                value === undefined ? undefined : value?.trim() || null,
            }),
          }),
        );
      },
    );

    it.each([undefined, null, '', '   ', '  SAP-002  '])(
      'normalizes update input %s without erasing omitted values',
      async (value) => {
        prismaService.material.findUnique.mockImplementation(({ where }) =>
          where.Id
            ? Promise.resolve({ ...mockMaterial, PartNumberSAP: 'OLD' })
            : Promise.resolve(null),
        );
        await service.update(
          mockMaterial.Id,
          { partNumberSAP: value },
          'tester',
        );
        expect(prismaService.material.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              PartNumberSAP:
                value === undefined ? undefined : value?.trim() || null,
            }),
          }),
        );
        expect(prismaService.inventoryLedger.create).not.toHaveBeenCalled();
      },
    );

    it('allows SAP to equal PartNumber', async () => {
      prismaService.material.findUnique.mockResolvedValue(null);
      await service.create(
        {
          partNumber: mockMaterial.PartNumber,
          partName: mockMaterial.PartName,
          partNumberSAP: mockMaterial.PartNumber,
        },
        'tester',
      );
      expect(prismaService.material.create).toHaveBeenCalled();
    });

    it('allows keeping the same SAP value on the same record', async () => {
      prismaService.material.findUnique.mockResolvedValue({
        ...mockMaterial,
        PartNumberSAP: 'SAP',
      });
      await service.update(mockMaterial.Id, { partNumberSAP: 'SAP' }, 'tester');
      expect(prismaService.material.update).toHaveBeenCalled();
    });

    it('rejects a duplicate on create and records failure', async () => {
      prismaService.material.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockMaterial, Id: 2 });
      await expect(
        service.create(
          { partNumber: 'NEW', partName: 'New', partNumberSAP: 'SAP' },
          'tester',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prismaService.material.create).not.toHaveBeenCalled();
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'FAILED',
      );
    });

    it('rejects a duplicate on update', async () => {
      prismaService.material.findUnique
        .mockResolvedValueOnce(mockMaterial)
        .mockResolvedValueOnce({ ...mockMaterial, Id: 2 });
      await expect(
        service.update(mockMaterial.Id, { partNumberSAP: 'SAP' }, 'tester'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prismaService.material.update).not.toHaveBeenCalled();
    });

    it('searches SAP consistently but excludes it from Excel cells', async () => {
      prismaService.material.count.mockResolvedValue(1);
      prismaService.material.findMany.mockResolvedValue([
        { ...mockMaterial, PartNumberSAP: 'SAP-ONLY-SECRET' },
      ]);
      await service.findAll({ page: 1, limit: 50, search: 'SAP-ONLY' });
      const listWhere = prismaService.material.findMany.mock.calls[0][0].where;
      expect(listWhere.OR).toContainEqual({
        PartNumberSAP: { contains: 'SAP-ONLY', mode: 'insensitive' },
      });
      const buffer = await service.exportExcel({
        page: 1,
        limit: 50,
        search: 'SAP-ONLY',
      });
      expect(prismaService.material.findMany.mock.calls[1][0].where).toEqual(
        listWhere,
      );
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(
        buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
      const cells = JSON.stringify(workbook.worksheets[0].getSheetValues());
      expect(cells).not.toContain('SAP');
      expect(cells).toContain(mockMaterial.PartNumber);
    });
  });
});
