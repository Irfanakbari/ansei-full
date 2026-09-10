import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ManPowerController } from './man-power.controller';
import { ManPowerService } from './man-power.service';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

describe('ManPowerController', () => {
  let controller: ManPowerController;
  let service: jest.Mocked<ManPowerService>;

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

  const mockManPower = {
    Uid: '550e8400-e29b-41d4-a716-446655440000',
    Nik: 'EMP001',
    Name: 'John Doe',
    CreatedAt: new Date(),
    Status: true,
    Line: 'Line A',
    ProductionReport: [],
  };

  beforeEach(async () => {
    const mockManPowerService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByNik: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManPowerController],
      providers: [{ provide: ManPowerService, useValue: mockManPowerService }],
    }).compile();

    controller = module.get<ManPowerController>(ManPowerController);
    service = module.get(ManPowerService);
  });

  describe('findAll', () => {
    it('should return all man power records', async () => {
      const expected = [mockManPower];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a man power by uid', async () => {
      service.findOne.mockResolvedValue(mockManPower);

      const result = await controller.findOne(mockManPower.Uid, mockUser);

      expect(result).toEqual(mockManPower);
      expect(service.findOne).toHaveBeenCalledWith(mockManPower.Uid);
    });

    it('should throw NotFoundException when record not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('INVALID', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByNik', () => {
    it('should return a man power by nik', async () => {
      service.findByNik.mockResolvedValue(mockManPower);

      const result = await controller.findByNik('EMP001', mockUser);

      expect(result).toEqual(mockManPower);
      expect(service.findByNik).toHaveBeenCalledWith('EMP001');
    });

    it('should throw NotFoundException when record not found', async () => {
      service.findByNik.mockRejectedValue(new NotFoundException());

      await expect(controller.findByNik('INVALID', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a new man power record', async () => {
      const createDto = { nik: 'EMP002', name: 'Jane Doe', line: 'Line B' };
      const created = { ...mockManPower, Nik: 'EMP002', Name: 'Jane Doe' };
      service.create.mockResolvedValue(created);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(created);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it('should throw ConflictException when nik already exists', async () => {
      const createDto = { nik: 'EMP001', name: 'Jane Doe' };
      service.create.mockRejectedValue(new ConflictException());

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('should update an existing man power record', async () => {
      const updateDto = { name: 'John Updated' };
      const updated = { ...mockManPower, Name: 'John Updated' };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(
        mockManPower.Uid,
        updateDto,
        mockUser,
      );

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(mockManPower.Uid, updateDto);
    });
  });

  describe('remove', () => {
    it('should delete an existing man power record', async () => {
      service.remove.mockResolvedValue({
        deleted: true,
        uid: mockManPower.Uid,
      });

      const result = await controller.remove(mockManPower.Uid, mockUser);

      expect(result).toEqual({ deleted: true, uid: mockManPower.Uid });
      expect(service.remove).toHaveBeenCalledWith(mockManPower.Uid);
    });
  });
});
