import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SupplierController } from './supplier.controller';
import { SupplierService } from './supplier.service';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import type { SupplierModel } from '../../generated/prisma/models';

describe('SupplierController', () => {
  let controller: SupplierController;
  let service: jest.Mocked<SupplierService>;

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

  const mockSupplier: SupplierModel = {
    Id: 1,
    Name: 'PT. Supplier ABC',
    CreatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockSupplierService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getBarcodeFormat: jest.fn(),
      upsertBarcodeFormat: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupplierController],
      providers: [{ provide: SupplierService, useValue: mockSupplierService }],
    }).compile();

    controller = module.get<SupplierController>(SupplierController);
    service = module.get(SupplierService);
  });

  describe('findAll', () => {
    it('should return all suppliers', async () => {
      const expected = [mockSupplier];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a supplier by id', async () => {
      service.findOne.mockResolvedValue(mockSupplier);

      const result = await controller.findOne(1, mockUser);

      expect(result).toEqual(mockSupplier);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when supplier not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(999, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('barcode format', () => {
    it('should return the supplier barcode format', async () => {
      const format = {
        Id: 1,
        SupplierId: 1,
        Delimiter: '#',
        Fields: ['PART_NUMBER', 'QUANTITY'],
      };
      service.getBarcodeFormat.mockResolvedValue(format as never);

      await expect(controller.getBarcodeFormat(1, mockUser)).resolves.toEqual(
        format,
      );
      expect(service.getBarcodeFormat).toHaveBeenCalledWith(1);
    });

    it('should upsert the supplier barcode format with the actor', async () => {
      const dto = {
        delimiter: '#',
        fields: ['PART_NUMBER', 'QUANTITY'],
      };
      service.upsertBarcodeFormat.mockResolvedValue({});

      await controller.upsertBarcodeFormat(1, dto as never, mockUser);

      expect(service.upsertBarcodeFormat).toHaveBeenCalledWith(1, dto, 'admin');
    });
  });

  describe('create', () => {
    it('should create a new supplier', async () => {
      const createDto = { name: 'PT. New Supplier' };
      const created = {
        Id: 2,
        Name: 'PT. New Supplier',
        CreatedAt: new Date(),
      };
      service.create.mockResolvedValue(created);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(created);
      expect(service.create).toHaveBeenCalledWith(createDto, 'admin');
    });
  });

  describe('update', () => {
    it('should update an existing supplier', async () => {
      const updateDto = { name: 'PT. Updated Supplier' };
      const updated = {
        Id: 1,
        Name: 'PT. Updated Supplier',
        CreatedAt: new Date(),
      };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(1, updateDto, mockUser);

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(1, updateDto, 'admin');
    });
  });

  describe('remove', () => {
    it('should delete an existing supplier', async () => {
      service.remove.mockResolvedValue({ deleted: true, id: 1 });

      const result = await controller.remove(1, mockUser);

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(service.remove).toHaveBeenCalledWith(1, 'admin');
    });
  });
});
