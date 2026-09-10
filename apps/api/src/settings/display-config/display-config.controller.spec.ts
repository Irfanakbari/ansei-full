import { Test, TestingModule } from '@nestjs/testing';
import { DisplayConfigController } from './display-config.controller';
import { DisplayConfigService } from './display-config.service';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

describe('DisplayConfigController', () => {
  let controller: DisplayConfigController;
  let service: jest.Mocked<DisplayConfigService>;

  const mockUser: ICurrentUser = {
    username: 'admin',
    name: 'Admin User',
    email: 'admin@example.com',
    roleId: 1,
    roleName: 'ADMIN',
    sessionId: 'session-123',
    permissions: [
      'DISPLAY_CONFIG_READ',
      'DISPLAY_CONFIG_CREATE',
      'DISPLAY_CONFIG_UPDATE',
      'DISPLAY_CONFIG_DELETE',
    ],
    departments: ['IT'],
  };

  const mockDisplayConfig = {
    Id: 1,
    Description: 'Display Utama Gudang',
    Url: 'https://display.example.com/screen/1',
    IsOpen: false,
    Loop: true,
    CreatedAt: new Date('2026-01-01'),
    UpdatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const mockDisplayConfigService = {
      findAll: jest.fn(),
      findActive: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisplayConfigController],
      providers: [
        {
          provide: DisplayConfigService,
          useValue: mockDisplayConfigService,
        },
      ],
    }).compile();

    controller = module.get(DisplayConfigController);
    service = module.get(DisplayConfigService);
  });

  describe('findActive', () => {
    it('should return the active display config', async () => {
      service.findActive.mockResolvedValue(mockDisplayConfig);

      const result = await controller.findActive();

      expect(result).toEqual(mockDisplayConfig);
      expect(service.findActive).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all display configs', async () => {
      const expected = [mockDisplayConfig];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a new display config', async () => {
      const createDto = {
        description: 'Display Utama Gudang',
        url: 'https://display.example.com/screen/1',
      };
      service.create.mockResolvedValue(mockDisplayConfig);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(mockDisplayConfig);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.username);
    });
  });

  describe('update', () => {
    it('should update an existing display config', async () => {
      const updateDto = { description: 'Updated Display Name' };
      const updated = {
        ...mockDisplayConfig,
        Description: 'Updated Display Name',
      };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(1, updateDto, mockUser);

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(
        1,
        updateDto,
        mockUser.username,
      );
    });

    it('should update isOpen to true', async () => {
      const updateDto = { isOpen: true };
      const updated = {
        ...mockDisplayConfig,
        IsOpen: true,
      };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(1, updateDto, mockUser);

      expect(result.IsOpen).toBe(true);
      expect(service.update).toHaveBeenCalledWith(
        1,
        updateDto,
        mockUser.username,
      );
    });
  });

  describe('remove', () => {
    it('should delete a display config', async () => {
      const expected = { deleted: true, id: 1 };
      service.remove.mockResolvedValue(expected);

      const result = await controller.remove(1, mockUser);

      expect(result).toEqual(expected);
      expect(service.remove).toHaveBeenCalledWith(1, mockUser.username);
    });
  });
});
