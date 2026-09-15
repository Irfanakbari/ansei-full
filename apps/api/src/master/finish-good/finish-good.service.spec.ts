import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { FinishGoodService } from './finish-good.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';

// Mock the PrismaService
jest.mock('../../prisma/prisma.service');
jest.mock('../../common/log-process/log-process.service');

describe('FinishGoodService', () => {
  let service: FinishGoodService;

  const mockFinishGood = {
    Id: 1,
    PartNumber: 'FG-001',
    PartName: 'Product A',
    Price: 10000,
    CreatedAt: new Date(),
    CreatedBy: 'admin',
    UpdatedAt: new Date(),
    Qty: 50,
    BoxQTY: null,
    BillOfMaterials: [],
    Forecast: [],
    LabelData: [],
    LineStatus: [],
    ProductionReport: [],
    InventoryLedger: [],
    StockOpnameDetail: [],
    _count: {
      BillOfMaterials: 0,
      Forecast: 0,
      LabelData: 0,
      LineStatus: 0,
      ProductionReport: 0,
      InventoryLedger: 0,
      StockOpnameDetail: 0,
    },
  };

  const mockLogProcess = {
    ProcessId: 'PR20260606120000123456',
    FunctionId: 'FINISHGOOD_001',
    FunctionName: 'createFinishGood',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'admin',
  };

  let prismaService: {
    finishGood: {
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
      finishGood: {
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
        FinishGoodService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
      ],
    }).compile();

    service = module.get<FinishGoodService>(FinishGoodService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all finish goods', async () => {
      const expectedFinishGoods = [mockFinishGood];
      prismaService.finishGood.count.mockResolvedValue(1);
      prismaService.finishGood.findMany.mockResolvedValue(expectedFinishGoods);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual(expectedFinishGoods);
      expect(prismaService.finishGood.findMany).toHaveBeenCalledWith({
        orderBy: [{ Id: 'asc' }],
        skip: 0,
        take: 50,
        where: {},
      });
    });

    it('should return empty array when no finish goods exist', async () => {
      prismaService.finishGood.count.mockResolvedValue(0);
      prismaService.finishGood.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a finish good by id', async () => {
      prismaService.finishGood.findUnique.mockResolvedValue(mockFinishGood);

      const result = await service.findOne(1);

      expect(result).toEqual(mockFinishGood);
      expect(prismaService.finishGood.findUnique).toHaveBeenCalledWith({
        where: { Id: 1 },
      });
    });

    it('should throw NotFoundException when finish good not found', async () => {
      prismaService.finishGood.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPartNumber', () => {
    it('should return a finish good by part number', async () => {
      prismaService.finishGood.findUnique.mockResolvedValue(mockFinishGood);

      const result = await service.findByPartNumber('FG-001');

      expect(result).toEqual(mockFinishGood);
      expect(prismaService.finishGood.findUnique).toHaveBeenCalledWith({
        where: { PartNumber: 'FG-001' },
      });
    });

    it('should throw NotFoundException when finish good with part number not found', async () => {
      prismaService.finishGood.findUnique.mockResolvedValue(null);

      await expect(service.findByPartNumber('INVALID')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a new finish good', async () => {
      const createDto = {
        partNumber: 'FG-002',
        partName: 'Product B',
        price: 15000,
        qty: 100,
      };

      const createdFinishGood = {
        ...mockFinishGood,
        Id: 2,
        PartNumber: 'FG-002',
        PartName: 'Product B',
        Price: 15000,
        Qty: 100,
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.finishGood.findUnique.mockResolvedValue(null);
      prismaService.finishGood.create.mockResolvedValue(createdFinishGood);

      const result = await service.create(createDto, 'admin');

      expect(result).toEqual(createdFinishGood);
      expect(logService.startProcess).toHaveBeenCalledWith({
        functionId: 'FINISHGOOD_001',
        functionName: 'FinishGoodService.Create',
        createdBy: 'admin',
      });
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw ConflictException when part number already exists', async () => {
      const createDto = {
        partNumber: 'FG-001',
        partName: 'Product B',
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.finishGood.findUnique.mockResolvedValue(mockFinishGood);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should log error and complete process as FAILED on exception', async () => {
      const createDto = {
        partNumber: 'FG-002',
        partName: 'Product B',
      };
      const error = new Error('Database error');

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.finishGood.findUnique.mockResolvedValue(null);
      prismaService.finishGood.create.mockRejectedValue(error);

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
    it('should update an existing finish good', async () => {
      const updateDto = { partName: 'Product B Updated', price: 20000 };
      const updatedFinishGood = {
        ...mockFinishGood,
        PartName: 'Product B Updated',
        Price: 20000,
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.finishGood.findUnique.mockResolvedValue(mockFinishGood);
      prismaService.finishGood.update.mockResolvedValue(updatedFinishGood);

      const result = await service.update(1, updateDto, 'admin');

      expect(result).toEqual(updatedFinishGood);
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw ConflictException when changing to existing part number', async () => {
      const updateDto = { partNumber: 'FG-EXISTING' };
      const existingFinishGood = {
        ...mockFinishGood,
        Id: 2,
        PartNumber: 'FG-EXISTING',
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.finishGood.findUnique
        .mockResolvedValueOnce(mockFinishGood)
        .mockResolvedValueOnce(existingFinishGood);

      await expect(service.update(1, updateDto, 'admin')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException when updating non-existent finish good', async () => {
      const updateDto = { partName: 'Updated Name' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.finishGood.findUnique.mockResolvedValue(null);

      await expect(service.update(999, updateDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete an existing finish good', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.finishGood.findUnique.mockResolvedValue(mockFinishGood);
      prismaService.finishGood.delete.mockResolvedValue(mockFinishGood);

      const result = await service.remove(1, 'admin');

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when deleting non-existent finish good', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.finishGood.findUnique.mockResolvedValue(null);

      await expect(service.remove(999, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
