import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { BillOfMaterialsService } from './bill-of-materials.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';

// Mock the PrismaService
jest.mock('../../prisma/prisma.service');
jest.mock('../../common/log-process/log-process.service');

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
      count: jest.Mock;
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
        count: jest.fn(),
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
      prismaService.billOfMaterials.count.mockResolvedValue(1);
      prismaService.billOfMaterials.findMany.mockResolvedValue(expected);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual(expected);
      expect(prismaService.billOfMaterials.findMany).toHaveBeenCalledWith({
        include: { FGData: true, MaterialData: true },
        orderBy: [{ Id: 'asc' }],
        skip: 0,
        take: 50,
        where: { FGData: { ActiveBomRevisionId: { not: null } } },
      });
    });

    it('should return empty array when no records exist', async () => {
      prismaService.billOfMaterials.findMany.mockResolvedValue([]);

      prismaService.billOfMaterials.count.mockResolvedValue(0);
      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual([]);
    });
  });

  describe('findByFinishGoodId', () => {
    it('should return BOM records by finish good id', async () => {
      const expected = [mockBOM];
      prismaService.billOfMaterials.findMany.mockResolvedValue(expected);

      const result = await service.findByFinishGoodId(1);

      expect(result).toEqual(expected);
      expect(prismaService.billOfMaterials.findMany).toHaveBeenCalledWith({
        where: {
          FinishGoodId: 1,
          FGData: { ActiveBomRevisionId: { not: null } },
        },
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
        where: {
          MaterialId: 1,
          FGData: { ActiveBomRevisionId: { not: null } },
        },
        include: { FGData: true, MaterialData: true },
        orderBy: { Id: 'asc' },
      });
    });
  });

  describe('retired mutation contract', () => {
    it('rejects create, update and delete without writing', () => {
      expect(() =>
        service.create({ materialId: 1, finishGoodId: 1, qty: 2 }, 'operator'),
      ).toThrow(ConflictException);
      expect(() => service.update(1, { qty: 2 }, 'operator')).toThrow(
        ConflictException,
      );
      expect(() => service.remove(1, 'operator')).toThrow(ConflictException);
      expect(prismaService.billOfMaterials.create).not.toHaveBeenCalled();
      expect(prismaService.billOfMaterials.update).not.toHaveBeenCalled();
      expect(prismaService.billOfMaterials.delete).not.toHaveBeenCalled();
    });
  });
});
