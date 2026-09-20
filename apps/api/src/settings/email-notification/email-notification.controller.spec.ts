import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EmailNotificationController } from './email-notification.controller';
import { EmailNotificationService } from './email-notification.service';
import { ICurrentUser } from '../../auth/interfaces/current-user.interface';

describe('EmailNotificationController', () => {
  let controller: EmailNotificationController;
  let service: jest.Mocked<EmailNotificationService>;

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

  const mockEmailNotification = {
    Id: 1,
    Name: 'Admin User',
    Email: 'admin@example.com',
    Type: 'DEFAULT' as const,
  };

  beforeEach(async () => {
    const mockEmailNotificationService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailNotificationController],
      providers: [
        {
          provide: EmailNotificationService,
          useValue: mockEmailNotificationService,
        },
      ],
    }).compile();

    controller = module.get<EmailNotificationController>(
      EmailNotificationController,
    );
    service = module.get(EmailNotificationService);
  });

  describe('findAll', () => {
    it('should return all email notifications', async () => {
      const expected = [mockEmailNotification];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an email notification by id', async () => {
      service.findOne.mockResolvedValue(mockEmailNotification);

      const result = await controller.findOne(1, mockUser);

      expect(result).toEqual(mockEmailNotification);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(999, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return an email notification by email', async () => {
      service.findByEmail.mockResolvedValue(mockEmailNotification);

      const result = await controller.findByEmail(
        'admin@example.com',
        mockUser,
      );

      expect(result).toEqual(mockEmailNotification);
      expect(service.findByEmail).toHaveBeenCalledWith('admin@example.com');
    });
  });

  describe('create', () => {
    it('should create a new email notification', async () => {
      const createDto = { name: 'New User', email: 'new@example.com' };
      const created = { ...mockEmailNotification, ...createDto, Id: 2 };
      service.create.mockResolvedValue(created);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(created);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.username);
    });

    it('should throw ConflictException when email exists', async () => {
      const createDto = { name: 'New User', email: 'admin@example.com' };
      service.create.mockRejectedValue(new ConflictException());

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('should update an existing email notification', async () => {
      const updateDto = { name: 'Updated Name' };
      const updated = { ...mockEmailNotification, Name: 'Updated Name' };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(1, updateDto, mockUser);

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(
        1,
        updateDto,
        mockUser.username,
      );
    });
  });

  describe('remove', () => {
    it('should delete an email notification', async () => {
      service.remove.mockResolvedValue({ deleted: true, id: 1 });

      const result = await controller.remove(1, mockUser);

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(service.remove).toHaveBeenCalledWith(1, mockUser.username);
    });

    it('should throw NotFoundException when not found', async () => {
      service.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove(999, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
