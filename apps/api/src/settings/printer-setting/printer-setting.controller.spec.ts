import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrinterSettingController } from './printer-setting.controller';
import { PrinterSettingService } from './printer-setting.service';
import type { ICurrentUser } from '../../../auth/interfaces/current-user.interface';

describe('PrinterSettingController', () => {
  let controller: PrinterSettingController;
  let service: jest.Mocked<PrinterSettingService>;

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

  const mockPrinterSetting = {
    Id: 'uuid-1234-5678',
    Name: 'Printer Gudang 1',
    IpAddress: '192.168.1.100',
    CreatedAt: new Date('2026-01-01'),
    UpdatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const mockPrinterSettingService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByIpAddress: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrinterSettingController],
      providers: [
        {
          provide: PrinterSettingService,
          useValue: mockPrinterSettingService,
        },
      ],
    }).compile();

    controller = module.get(PrinterSettingController);
    service = module.get(PrinterSettingService);
  });

  describe('findAll', () => {
    it('should return all printer settings', async () => {
      const expected = [mockPrinterSetting];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a printer setting by id', async () => {
      service.findOne.mockResolvedValue(mockPrinterSetting);

      const result = await controller.findOne('uuid-1234-5678', mockUser);

      expect(result).toEqual(mockPrinterSetting);
      expect(service.findOne).toHaveBeenCalledWith('uuid-1234-5678');
    });

    it('should throw NotFoundException when not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        controller.findOne('non-existent-id', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByIpAddress', () => {
    it('should return a printer setting by IP address', async () => {
      service.findByIpAddress.mockResolvedValue(mockPrinterSetting);

      const result = await controller.findByIpAddress(
        '192.168.1.100',
        mockUser,
      );

      expect(result).toEqual(mockPrinterSetting);
      expect(service.findByIpAddress).toHaveBeenCalledWith('192.168.1.100');
    });
  });

  describe('create', () => {
    it('should create a new printer setting', async () => {
      const createDto = {
        name: 'Printer Gudang 1',
        ipAddress: '192.168.1.100',
      };
      service.create.mockResolvedValue(mockPrinterSetting);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(mockPrinterSetting);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.username);
    });
  });

  describe('update', () => {
    it('should update an existing printer setting', async () => {
      const updateDto = { name: 'Updated Printer Name' };
      const updated = {
        ...mockPrinterSetting,
        Name: 'Updated Printer Name',
      };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(
        'uuid-1234-5678',
        updateDto,
        mockUser,
      );

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(
        'uuid-1234-5678',
        updateDto,
        mockUser.username,
      );
    });
  });

  describe('remove', () => {
    it('should delete a printer setting', async () => {
      const expected = { deleted: true, id: 'uuid-1234-5678' };
      service.remove.mockResolvedValue(expected);

      const result = await controller.remove('uuid-1234-5678', mockUser);

      expect(result).toEqual(expected);
      expect(service.remove).toHaveBeenCalledWith(
        'uuid-1234-5678',
        mockUser.username,
      );
    });
  });
});
