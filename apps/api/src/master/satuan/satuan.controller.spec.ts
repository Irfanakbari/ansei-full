import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SatuanController } from './satuan.controller';
import { SatuanService } from './satuan.service';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import type { SatuanModel } from '../../generated/prisma/models';

describe('SatuanController', () => {
  let controller: SatuanController;
  let service: jest.Mocked<SatuanService>;

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

  beforeEach(async () => {
    const mockSatuanService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SatuanController],
      providers: [{ provide: SatuanService, useValue: mockSatuanService }],
    }).compile();

    controller = module.get<SatuanController>(SatuanController);
    service = module.get(SatuanService);
  });

  describe('findAll', () => {
    it('should return all satuans', async () => {
      const expected = [mockSatuan];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a satuan by id', async () => {
      service.findOne.mockResolvedValue(mockSatuan);

      const result = await controller.findOne(1, mockUser);

      expect(result).toEqual(mockSatuan);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when satuan not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(999, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a new satuan', async () => {
      const createDto = { name: 'Meter' };
      const created = { Id: 2, Name: 'Meter' };
      service.create.mockResolvedValue(created);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(created);
      expect(service.create).toHaveBeenCalledWith(createDto, 'admin');
    });
  });

  describe('update', () => {
    it('should update an existing satuan', async () => {
      const updateDto = { name: 'Liter' };
      const updated = { Id: 1, Name: 'Liter' };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(1, updateDto, mockUser);

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(1, updateDto, 'admin');
    });
  });

  describe('remove', () => {
    it('should delete an existing satuan', async () => {
      service.remove.mockResolvedValue({ deleted: true, id: 1 });

      const result = await controller.remove(1, mockUser);

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(service.remove).toHaveBeenCalledWith(1, 'admin');
    });
  });
});
