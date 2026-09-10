import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { BoxQtyService } from './box-qty.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LogProcessService } from '../../../common/log-process/log-process.service';

// Mock the PrismaService
jest.mock('../../../prisma/prisma.service');
jest.mock('../../../common/log-process/log-process.service');

describe('BoxQtyService', () => {
  let service: BoxQtyService;

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

  const mockBoxQty = {
    Id: 1,
    PartNumber: 'FG-001',
    Qty: 12,
    PartData: mockFinishGood,
  };

  const mockLogProcess = {
    ProcessId: 'PR20260606120000123456',
    FunctionId: 'BOXQTY_001',
    FunctionName: 'createBoxQty',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'admin',
  };

  let prismaService: {
    boxQTY: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    finishGood: {
      findUnique: jest.Mock;
    };
  };

  let logService: {
    startProcess: jest.Mock;
    addLog: jest.Mock;
    completeProcess: jest.Mock;
  };

  beforeEach(async () => {
    prismaService = {
      boxQTY: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      finishGood: {
        findUnique: jest.fn(),
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
        BoxQtyService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
      ],
    }).compile();

    service = module.get<BoxQtyService>(BoxQtyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all box qty records', async () => {
      const expected = [mockBoxQty];
      prismaService.boxQTY.findMany.mockResolvedValue(expected);

      const result = await service.findAll();

      expect(result).toEqual(expected);
      expect(prismaService.boxQTY.findMany).toHaveBeenCalledWith({
        include: { PartData: true },
        orderBy: { Id: 'asc' },
      });
    });

    it('should return empty array when no records exist', async () => {
      prismaService.boxQTY.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a box qty by id', async () => {
      prismaService.boxQTY.findUnique.mockResolvedValue(mockBoxQty);

      const result = await service.findOne(1);

      expect(result).toEqual(mockBoxQty);
      expect(prismaService.boxQTY.findUnique).toHaveBeenCalledWith({
        where: { Id: 1 },
        include: { PartData: true },
      });
    });

    it('should throw NotFoundException when record not found', async () => {
      prismaService.boxQTY.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPartNumber', () => {
    it('should return a box qty by part number', async () => {
      prismaService.boxQTY.findUnique.mockResolvedValue(mockBoxQty);

      const result = await service.findByPartNumber('FG-001');

      expect(result).toEqual(mockBoxQty);
      expect(prismaService.boxQTY.findUnique).toHaveBeenCalledWith({
        where: { PartNumber: 'FG-001' },
        include: { PartData: true },
      });
    });

    it('should throw NotFoundException when record not found', async () => {
      prismaService.boxQTY.findUnique.mockResolvedValue(null);

      await expect(service.findByPartNumber('INVALID')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a new box qty record', async () => {
      const createDto = { partNumber: 'FG-001', qty: 24 };
      const created = { ...mockBoxQty, Qty: 24 };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.boxQTY.findUnique.mockResolvedValue(null);
      prismaService.finishGood.findUnique.mockResolvedValue(mockFinishGood);
      prismaService.boxQTY.create.mockResolvedValue(created);

      const result = await service.create(createDto, 'admin');

      expect(result).toEqual(created);
      expect(logService.startProcess).toHaveBeenCalledWith({
        functionId: 'BOXQTY_001',
        functionName: 'BoxQtyService.Create',
        createdBy: 'admin',
      });
    });

    it('should throw ConflictException when part number already exists', async () => {
      const createDto = { partNumber: 'FG-001', qty: 24 };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.boxQTY.findUnique.mockResolvedValue(mockBoxQty);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException when FinishGood not found', async () => {
      const createDto = { partNumber: 'FG-001', qty: 24 };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.boxQTY.findUnique.mockResolvedValue(null);
      prismaService.finishGood.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update an existing box qty record', async () => {
      const updateDto = { qty: 36 };
      const updated = { ...mockBoxQty, Qty: 36 };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.boxQTY.findUnique.mockResolvedValue(mockBoxQty);
      prismaService.boxQTY.update.mockResolvedValue(updated);

      const result = await service.update(1, updateDto, 'admin');

      expect(result).toEqual(updated);
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when updating non-existent record', async () => {
      const updateDto = { qty: 36 };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.boxQTY.findUnique.mockResolvedValue(null);

      await expect(service.update(999, updateDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete an existing box qty record', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.boxQTY.findUnique.mockResolvedValue(mockBoxQty);
      prismaService.boxQTY.delete.mockResolvedValue(mockBoxQty);

      const result = await service.remove(1, 'admin');

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when deleting non-existent record', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.boxQTY.findUnique.mockResolvedValue(null);

      await expect(service.remove(999, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
