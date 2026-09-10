import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { FinishGoodController } from './finish-good.controller';
import { FinishGoodService } from './finish-good.service';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

describe('FinishGoodController', () => {
  let controller: FinishGoodController;
  let service: jest.Mocked<FinishGoodService>;

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

  beforeEach(async () => {
    const mockFinishGoodService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByPartNumber: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinishGoodController],
      providers: [
        { provide: FinishGoodService, useValue: mockFinishGoodService },
      ],
    }).compile();

    controller = module.get<FinishGoodController>(FinishGoodController);
    service = module.get(FinishGoodService);
  });

  describe('findAll', () => {
    it('should return all finish goods', async () => {
      const expected = [mockFinishGood];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a finish good by id', async () => {
      service.findOne.mockResolvedValue(mockFinishGood);

      const result = await controller.findOne(1, mockUser);

      expect(result).toEqual(mockFinishGood);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when finish good not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(999, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByPartNumber', () => {
    it('should return a finish good by part number', async () => {
      service.findByPartNumber.mockResolvedValue(mockFinishGood);

      const result = await controller.findByPartNumber('FG-001', mockUser);

      expect(result).toEqual(mockFinishGood);
      expect(service.findByPartNumber).toHaveBeenCalledWith('FG-001');
    });

    it('should throw NotFoundException when finish good with part number not found', async () => {
      service.findByPartNumber.mockRejectedValue(new NotFoundException());

      await expect(
        controller.findByPartNumber('INVALID', mockUser),
      ).rejects.toThrow(NotFoundException);
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
      const created = { ...mockFinishGood, Id: 2, PartNumber: 'FG-002' };
      service.create.mockResolvedValue(created);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(created);
      expect(service.create).toHaveBeenCalledWith(createDto, 'admin');
    });

    it('should throw ConflictException when part number already exists', async () => {
      const createDto = {
        partNumber: 'FG-001',
        partName: 'Product B',
      };
      service.create.mockRejectedValue(new ConflictException());

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('should update an existing finish good', async () => {
      const updateDto = { partName: 'Product B Updated', price: 20000 };
      const updated = {
        ...mockFinishGood,
        PartName: 'Product B Updated',
        Price: 20000,
      };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(1, updateDto, mockUser);

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(1, updateDto, 'admin');
    });
  });

  describe('remove', () => {
    it('should delete an existing finish good', async () => {
      service.remove.mockResolvedValue({ deleted: true, id: 1 });

      const result = await controller.remove(1, mockUser);

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(service.remove).toHaveBeenCalledWith(1, 'admin');
    });
  });
});
