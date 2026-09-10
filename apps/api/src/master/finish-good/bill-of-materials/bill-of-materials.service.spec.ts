import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { BillOfMaterialsService } from './bill-of-materials.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LogProcessService } from '../../../common/log-process/log-process.service';

// Mock the PrismaService
jest.mock('../../../prisma/prisma.service');
jest.mock('../../../common/log-process/log-process.service');

describe('BillOfMaterialsService', () => {
  let service: BillOfMaterialsService;

  const mockMaterial = {
    Id: 1,
    PartNumber: 'MAT-001',
    PartName: 'Baut M8',
    CreatedAt: new Date(),
    CreatedBy: 'admin',
    UpdatedAt: new Date(),
    Supplier: 'PT. Supplier ABC',
    SatuanId: 1,
    RackLocation: 'RACK-A1',
    QtyRack: 100,
    QtyWarehouse: 500,
    SatuanData: { Id: 1, Name: 'Pcs' },
    BillOfMaterials: [],
    IncomingMaterial: [],
    MaterialNG: [],
    Shopping: [],
    InventoryLedger: [],
    StockOpnameDetail: [],
    _count: {
      BillOfMaterials: 0,
      IncomingMaterial: 0,
      MaterialNG: 0,
      Shopping: 0,
      InventoryLedger: 0,
      StockOpnameDetail: 0,
    },
  };

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

  const mockBOM = {
    Id: 1,
    MaterialId: 1,
    FinishGoodId: 1,
    Qty: 10,
    FGData: mockFinishGood,
    MaterialData: mockMaterial,
  };

  const mockLogProcess = {
    ProcessId: 'PR20260606120000123456',
    FunctionId: 'BOM_001',
    FunctionName: 'createBillOfMaterials',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'admin',
  };

  let prismaService: {
    billOfMaterials: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    material: {
      findUnique: jest.Mock;
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
      billOfMaterials: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      material: {
        findUnique: jest.fn(),
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
        BillOfMaterialsService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
      ],
    }).compile();

    service = module.get<BillOfMaterialsService>(BillOfMaterialsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all BOM records', async () => {
      const expected = [mockBOM];
      prismaService.billOfMaterials.findMany.mockResolvedValue(expected);

      const result = await service.findAll();

      expect(result).toEqual(expected);
      expect(prismaService.billOfMaterials.findMany).toHaveBeenCalledWith({
        include: { FGData: true, MaterialData: true },
        orderBy: { Id: 'asc' },
      });
    });

    it('should return empty array when no records exist', async () => {
      prismaService.billOfMaterials.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findByFinishGoodId', () => {
    it('should return BOM records by finish good id', async () => {
      const expected = [mockBOM];
      prismaService.billOfMaterials.findMany.mockResolvedValue(expected);

      const result = await service.findByFinishGoodId(1);

      expect(result).toEqual(expected);
      expect(prismaService.billOfMaterials.findMany).toHaveBeenCalledWith({
        where: { FinishGoodId: 1 },
        include: { FGData: true, MaterialData: true },
        orderBy: { Id: 'asc' },
      });
    });
  });

  describe('findByMaterialId', () => {
    it('should return BOM records by material id', async () => {
      const expected = [mockBOM];
      prismaService.billOfMaterials.findMany.mockResolvedValue(expected);

      const result = await service.findByMaterialId(1);

      expect(result).toEqual(expected);
      expect(prismaService.billOfMaterials.findMany).toHaveBeenCalledWith({
        where: { MaterialId: 1 },
        include: { FGData: true, MaterialData: true },
        orderBy: { Id: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('should create a new BOM record', async () => {
      const createDto = { materialId: 1, finishGoodId: 1, qty: 10 };
      const created = { ...mockBOM };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.material.findUnique.mockResolvedValue(mockMaterial);
      prismaService.finishGood.findUnique.mockResolvedValue(mockFinishGood);
      prismaService.billOfMaterials.findFirst.mockResolvedValue(null);
      prismaService.billOfMaterials.create.mockResolvedValue(created);

      const result = await service.create(createDto, 'admin');

      expect(result).toEqual(created);
      expect(logService.startProcess).toHaveBeenCalledWith({
        functionId: 'BOM_001',
        functionName: 'BillOfMaterialsService.Create',
        createdBy: 'admin',
      });
    });

    it('should throw NotFoundException when Material not found', async () => {
      const createDto = { materialId: 999, finishGoodId: 1, qty: 10 };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.material.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when FinishGood not found', async () => {
      const createDto = { materialId: 1, finishGoodId: 999, qty: 10 };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.material.findUnique.mockResolvedValue(mockMaterial);
      prismaService.finishGood.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when BOM already exists', async () => {
      const createDto = { materialId: 1, finishGoodId: 1, qty: 10 };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.material.findUnique.mockResolvedValue(mockMaterial);
      prismaService.finishGood.findUnique.mockResolvedValue(mockFinishGood);
      prismaService.billOfMaterials.findFirst.mockResolvedValue(mockBOM);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('should update an existing BOM record', async () => {
      const updateDto = { qty: 20 };
      const updated = { ...mockBOM, Qty: 20 };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.billOfMaterials.findUnique.mockResolvedValue(mockBOM);
      prismaService.billOfMaterials.update.mockResolvedValue(updated);

      const result = await service.update(1, updateDto, 'admin');

      expect(result).toEqual(updated);
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when updating non-existent record', async () => {
      const updateDto = { qty: 20 };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.billOfMaterials.findUnique.mockResolvedValue(null);

      await expect(service.update(999, updateDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete an existing BOM record', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.billOfMaterials.findUnique.mockResolvedValue(mockBOM);
      prismaService.billOfMaterials.delete.mockResolvedValue(mockBOM);

      const result = await service.remove(1, 'admin');

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when deleting non-existent record', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.billOfMaterials.findUnique.mockResolvedValue(null);

      await expect(service.remove(999, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
