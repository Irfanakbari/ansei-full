import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { MaterialController } from './material.controller';
import { MaterialService } from './material.service';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import type { MaterialModel, SatuanModel } from '../../generated/prisma/models';

describe('MaterialController', () => {
  let controller: MaterialController;
  let service: jest.Mocked<MaterialService>;

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

  const mockSatuan: SatuanModel = { Id: 1, Name: 'Pcs' };

  const mockMaterial: MaterialModel = {
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
    // SatuanData: mockSatuan,
    // BillOfMaterials: [],
    // IncomingMaterial: [],
    // MaterialNG: [],
    // Shopping: [],
    // InventoryLedger: [],
    // StockOpnameDetail: [],
    // _count: {
    //   BillOfMaterials: 0,
    //   IncomingMaterial: 0,
    //   MaterialNG: 0,
    //   Shopping: 0,
    //   InventoryLedger: 0,
    //   StockOpnameDetail: 0,
    // },
  };

  beforeEach(async () => {
    const mockMaterialService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByPartNumber: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaterialController],
      providers: [{ provide: MaterialService, useValue: mockMaterialService }],
    }).compile();

    controller = module.get<MaterialController>(MaterialController);
    service = module.get(MaterialService);
  });

  describe('findAll', () => {
    it('should return all materials', async () => {
      const expected = [mockMaterial];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a material by id', async () => {
      service.findOne.mockResolvedValue(mockMaterial);

      const result = await controller.findOne(1, mockUser);

      expect(result).toEqual(mockMaterial);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when material not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(999, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByPartNumber', () => {
    it('should return a material by part number', async () => {
      service.findByPartNumber.mockResolvedValue(mockMaterial);

      const result = await controller.findByPartNumber('MAT-001', mockUser);

      expect(result).toEqual(mockMaterial);
      expect(service.findByPartNumber).toHaveBeenCalledWith('MAT-001');
    });

    it('should throw NotFoundException when material with part number not found', async () => {
      service.findByPartNumber.mockRejectedValue(new NotFoundException());

      await expect(
        controller.findByPartNumber('INVALID', mockUser),
      ).rejects.toThrow(NotFoundException);
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
      const created = { ...mockMaterial, Id: 2, PartNumber: 'MAT-002' };
      service.create.mockResolvedValue(created);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(created);
      expect(service.create).toHaveBeenCalledWith(createDto, 'admin');
    });

    it('should throw ConflictException when part number already exists', async () => {
      const createDto = {
        partNumber: 'MAT-001',
        partName: 'Baut M10',
      };
      service.create.mockRejectedValue(new ConflictException());

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('should update an existing material', async () => {
      const updateDto = { partName: 'Baut M12 Updated' };
      const updated = { ...mockMaterial, PartName: 'Baut M12 Updated' };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(1, updateDto, mockUser);

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(1, updateDto, 'admin');
    });
  });

  describe('remove', () => {
    it('should delete an existing material', async () => {
      service.remove.mockResolvedValue({ deleted: true, id: 1 });

      const result = await controller.remove(1, mockUser);

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(service.remove).toHaveBeenCalledWith(1, 'admin');
    });
  });
});
