import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { BoxQtyController } from './box-qty.controller';
import { BoxQtyService } from './box-qty.service';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

describe('BoxQtyController', () => {
  let controller: BoxQtyController;
  let service: jest.Mocked<BoxQtyService>;

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

  const mockBoxQty = {
    Id: 1,
    PartNumber: 'FG-001',
    Qty: 12,
    PartData: mockFinishGood,
  };

  beforeEach(async () => {
    const mockBoxQtyService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByPartNumber: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoxQtyController],
      providers: [{ provide: BoxQtyService, useValue: mockBoxQtyService }],
    }).compile();

    controller = module.get<BoxQtyController>(BoxQtyController);
    service = module.get(BoxQtyService);
  });

  describe('findAll', () => {
    it('should return all box qty records', async () => {
      const expected = [mockBoxQty];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a box qty by id', async () => {
      service.findOne.mockResolvedValue(mockBoxQty);

      const result = await controller.findOne(1, mockUser);

      expect(result).toEqual(mockBoxQty);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when record not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(999, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByPartNumber', () => {
    it('should return a box qty by part number', async () => {
      service.findByPartNumber.mockResolvedValue(mockBoxQty);

      const result = await controller.findByPartNumber('FG-001', mockUser);

      expect(result).toEqual(mockBoxQty);
      expect(service.findByPartNumber).toHaveBeenCalledWith('FG-001');
    });
  });

  describe('create', () => {
    it('should create a new box qty record', async () => {
      const createDto = { partNumber: 'FG-001', qty: 24 };
      const created = { ...mockBoxQty, Qty: 24 };
      service.create.mockResolvedValue(created);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(created);
      expect(service.create).toHaveBeenCalledWith(createDto, 'admin');
    });

    it('should throw ConflictException when part number already exists', async () => {
      const createDto = { partNumber: 'FG-001', qty: 24 };
      service.create.mockRejectedValue(new ConflictException());

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('should update an existing box qty record', async () => {
      const updateDto = { qty: 36 };
      const updated = { ...mockBoxQty, Qty: 36 };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(1, updateDto, mockUser);

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(1, updateDto, 'admin');
    });
  });

  describe('remove', () => {
    it('should delete an existing box qty record', async () => {
      service.remove.mockResolvedValue({ deleted: true, id: 1 });

      const result = await controller.remove(1, mockUser);

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(service.remove).toHaveBeenCalledWith(1, 'admin');
    });
  });
});
