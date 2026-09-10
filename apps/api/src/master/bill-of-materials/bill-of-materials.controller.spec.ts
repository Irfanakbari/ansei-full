import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { BillOfMaterialsController } from './bill-of-materials.controller';
import { BillOfMaterialsService } from './bill-of-materials.service';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

describe('BillOfMaterialsController', () => {
  let controller: BillOfMaterialsController;
  let service: jest.Mocked<BillOfMaterialsService>;

  const mockUser: ICurrentUser = {
    username: 'admin',
    name: 'Admin User',
    email: 'admin@example.com',
    roleId: 1,
    roleName: 'ADMIN',
    sessionId: 'session-123',
    permissions: [
      'MASTER_READ',
      'MASTER_CREATE',
      'MASTER_UPDATE',
      'MASTER_DELETE',
    ],
    departments: ['IT'],
  };

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

  beforeEach(async () => {
    const mockBillOfMaterialsService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByFinishGoodId: jest.fn(),
      findByMaterialId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillOfMaterialsController],
      providers: [
        {
          provide: BillOfMaterialsService,
          useValue: mockBillOfMaterialsService,
        },
      ],
    }).compile();

    controller = module.get<BillOfMaterialsController>(
      BillOfMaterialsController,
    );
    service = module.get(BillOfMaterialsService);
  });

  describe('findAll', () => {
    it('should return all BOM records', async () => {
      const expected = [mockBOM];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findByFinishGoodId', () => {
    it('should return BOM records by finish good id', async () => {
      const expected = [mockBOM];
      service.findByFinishGoodId.mockResolvedValue(expected);

      const result = await controller.findByFinishGoodId(1, mockUser);

      expect(result).toEqual(expected);
      expect(service.findByFinishGoodId).toHaveBeenCalledWith(1);
    });
  });

  describe('findByMaterialId', () => {
    it('should return BOM records by material id', async () => {
      const expected = [mockBOM];
      service.findByMaterialId.mockResolvedValue(expected);

      const result = await controller.findByMaterialId(1, mockUser);

      expect(result).toEqual(expected);
      expect(service.findByMaterialId).toHaveBeenCalledWith(1);
    });
  });

  describe('create', () => {
    it('should create a new BOM record', async () => {
      const createDto = { materialId: 1, finishGoodId: 1, qty: 10 };
      const created = { ...mockBOM };
      service.create.mockResolvedValue(created);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(created);
      expect(service.create).toHaveBeenCalledWith(createDto, 'admin');
    });

    it('should throw ConflictException when BOM already exists', async () => {
      const createDto = { materialId: 1, finishGoodId: 1, qty: 10 };
      service.create.mockRejectedValue(new ConflictException());

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('should update an existing BOM record', async () => {
      const updateDto = { qty: 20 };
      const updated = { ...mockBOM, Qty: 20 };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(1, updateDto, mockUser);

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(1, updateDto, 'admin');
    });
  });

  describe('remove', () => {
    it('should delete an existing BOM record', async () => {
      service.remove.mockResolvedValue({ deleted: true, id: 1 });

      const result = await controller.remove(1, mockUser);

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(service.remove).toHaveBeenCalledWith(1, 'admin');
    });
  });
});
