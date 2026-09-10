import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DashboardSettingController } from './dashboard-setting.controller';
import { DashboardSettingService } from './dashboard-setting.service';
import type { ICurrentUser } from '../../../auth/interfaces/current-user.interface';

describe('DashboardSettingController', () => {
  let controller: DashboardSettingController;
  let service: jest.Mocked<DashboardSettingService>;

  const mockUser: ICurrentUser = {
    username: 'admin',
    name: 'Admin User',
    email: 'admin@example.com',
    roleId: 1,
    roleName: 'ADMIN',
    sessionId: 'session-123',
    permissions: ['MASTER_READ', 'MASTER_UPDATE'],
    departments: ['IT'],
  };

  const mockDashboardSetting = {
    Id: 1,
    StartDate: new Date('2026-01-01'),
    EndDate: new Date('2026-12-31'),
    UpdatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const mockDashboardSettingService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findLatest: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardSettingController],
      providers: [
        {
          provide: DashboardSettingService,
          useValue: mockDashboardSettingService,
        },
      ],
    }).compile();

    controller = module.get(DashboardSettingController);
    service = module.get(DashboardSettingService);
  });

  describe('findAll', () => {
    it('should return all dashboard settings', async () => {
      const expected = [mockDashboardSetting];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findLatest', () => {
    it('should return the latest dashboard setting', async () => {
      service.findLatest.mockResolvedValue(mockDashboardSetting);

      const result = await controller.findLatest(mockUser);

      expect(result).toEqual(mockDashboardSetting);
      expect(service.findLatest).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a dashboard setting by id', async () => {
      service.findOne.mockResolvedValue(mockDashboardSetting);

      const result = await controller.findOne(1, mockUser);

      expect(result).toEqual(mockDashboardSetting);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(999, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update an existing dashboard setting', async () => {
      const updateDto = { startDate: '2026-06-01T00:00:00.000Z' };
      const updated = {
        ...mockDashboardSetting,
        StartDate: new Date('2026-06-01'),
      };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(1, updateDto, mockUser);

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
    });
  });
});
