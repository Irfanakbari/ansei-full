import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';

// Mock the PrismaService
jest.mock('../../prisma/prisma.service');
jest.mock('../../common/log-process/log-process.service');

describe('SupplierService', () => {
  let service: SupplierService;

  const mockSupplier = {
    Id: 1,
    Name: 'PT. Supplier ABC',
    CreatedAt: new Date(),
  };

  const mockLogProcess = {
    ProcessId: 'PR20260606120000123456',
    FunctionId: 'SUPPLIER_001',
    FunctionName: 'createSupplier',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'admin',
  };

  let prismaService: {
    supplier: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  let logService: {
    startProcess: jest.Mock;
    addLog: jest.Mock;
    completeProcess: jest.Mock;
  };

  beforeEach(async () => {
    prismaService = {
      supplier: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
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
        SupplierService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
      ],
    }).compile();

    service = module.get<SupplierService>(SupplierService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all suppliers', async () => {
      const expectedSuppliers = [mockSupplier];
      prismaService.supplier.count.mockResolvedValue(1);
      prismaService.supplier.findMany.mockResolvedValue(expectedSuppliers);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual(expectedSuppliers);
      expect(prismaService.supplier.findMany).toHaveBeenCalledWith({
        orderBy: [{ Id: 'asc' }],
        skip: 0,
        take: 50,
        where: {},
      });
    });

    it('should return empty array when no suppliers exist', async () => {
      prismaService.supplier.count.mockResolvedValue(0);
      prismaService.supplier.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a supplier by id', async () => {
      prismaService.supplier.findUnique.mockResolvedValue(mockSupplier);

      const result = await service.findOne(1);

      expect(result).toEqual(mockSupplier);
      expect(prismaService.supplier.findUnique).toHaveBeenCalledWith({
        where: { Id: 1 },
      });
    });

    it('should throw NotFoundException when supplier not found', async () => {
      prismaService.supplier.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new supplier', async () => {
      const createDto = { name: 'PT. New Supplier' };
      const createdSupplier = {
        Id: 3,
        Name: 'PT. New Supplier',
        CreatedAt: new Date(),
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.supplier.create.mockResolvedValue(createdSupplier);

      const result = await service.create(createDto, 'admin');

      expect(result).toEqual(createdSupplier);
      expect(logService.startProcess).toHaveBeenCalledWith({
        functionId: 'SUPPLIER_001',
        functionName: 'SupplierService.Create',
        createdBy: 'admin',
      });
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should log error and complete process as FAILED on exception', async () => {
      const createDto = { name: 'PT. New Supplier' };
      const error = new Error('Database error');

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.supplier.create.mockRejectedValue(error);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        'Database error',
      );
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'FAILED',
      );
    });
  });

  describe('update', () => {
    it('should update an existing supplier', async () => {
      const updateDto = { name: 'PT. Updated Supplier' };
      const updatedSupplier = {
        Id: 1,
        Name: 'PT. Updated Supplier',
        CreatedAt: new Date(),
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.supplier.findUnique.mockResolvedValue(mockSupplier);
      prismaService.supplier.update.mockResolvedValue(updatedSupplier);

      const result = await service.update(1, updateDto, 'admin');

      expect(result).toEqual(updatedSupplier);
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when updating non-existent supplier', async () => {
      const updateDto = { name: 'PT. Updated Supplier' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.supplier.findUnique.mockResolvedValue(null);

      await expect(service.update(999, updateDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete an existing supplier', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.supplier.findUnique.mockResolvedValue(mockSupplier);
      prismaService.supplier.delete.mockResolvedValue(mockSupplier);

      const result = await service.remove(1, 'admin');

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when deleting non-existent supplier', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.supplier.findUnique.mockResolvedValue(null);

      await expect(service.remove(999, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
