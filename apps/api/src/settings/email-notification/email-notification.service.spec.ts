import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EmailNotificationService } from './email-notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';

jest.mock('../../prisma/prisma.service');
jest.mock('../../common/log-process/log-process.service');

describe('EmailNotificationService', () => {
  let service: EmailNotificationService;

  const mockEmailNotification = {
    Id: 1,
    Name: 'Admin User',
    Email: 'admin@example.com',
    Type: 'DEFAULT' as const,
  };

  const mockLogProcess = {
    ProcessId: 'PR20260606120000123456',
    FunctionId: 'EMAIL_001',
    FunctionName: 'createEmailNotification',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'admin',
  };

  let prismaService: {
    emailNotification: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  let logService: {
    startProcess: jest.Mock;
    addLog: jest.Mock;
    completeProcess: jest.Mock;
  };

  beforeEach(async () => {
    prismaService = {
      emailNotification: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    logService = {
      startProcess: jest.fn(),
      addLog: jest.fn(),
      completeProcess: jest.fn(),
    };

    (PrismaService as unknown as jest.Mock).mockImplementation(
      () => prismaService,
    );
    (LogProcessService as unknown as jest.Mock).mockImplementation(
      () => logService,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailNotificationService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
      ],
    }).compile();

    service = module.get<EmailNotificationService>(EmailNotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all email notifications', async () => {
      const expected = [mockEmailNotification];
      prismaService.emailNotification.count.mockResolvedValue(1);
      prismaService.emailNotification.findMany.mockResolvedValue(expected);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual(expected);
      expect(prismaService.emailNotification.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { Id: 'asc' },
        skip: 0,
        take: 50,
      });
    });

    it('should return empty array when no records', async () => {
      prismaService.emailNotification.count.mockResolvedValue(0);
      prismaService.emailNotification.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return email notification by id', async () => {
      prismaService.emailNotification.findUnique.mockResolvedValue(
        mockEmailNotification,
      );

      const result = await service.findOne(1);

      expect(result).toEqual(mockEmailNotification);
      expect(prismaService.emailNotification.findUnique).toHaveBeenCalledWith({
        where: { Id: 1 },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prismaService.emailNotification.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return email notification by email', async () => {
      prismaService.emailNotification.findFirst.mockResolvedValue(
        mockEmailNotification,
      );

      const result = await service.findByEmail('admin@example.com');

      expect(result).toEqual(mockEmailNotification);
      expect(prismaService.emailNotification.findFirst).toHaveBeenCalledWith({
        where: { Email: 'admin@example.com' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prismaService.emailNotification.findFirst.mockResolvedValue(null);

      await expect(service.findByEmail('invalid@example.com')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create email notification', async () => {
      const createDto = { name: 'New User', email: 'new@example.com' };
      const created = { ...mockEmailNotification, ...createDto, Id: 2 };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.emailNotification.findFirst.mockResolvedValue(null);
      prismaService.emailNotification.create.mockResolvedValue(created);

      const result = await service.create(createDto);

      expect(result).toEqual(created);
      expect(logService.startProcess).toHaveBeenCalledWith({
        functionId: 'EMAIL_001',
        functionName: 'EmailNotificationService.Create',
      });
    });

    it('should throw ConflictException when email exists', async () => {
      const createDto = { name: 'New User', email: 'admin@example.com' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.emailNotification.findFirst.mockResolvedValue(
        mockEmailNotification,
      );

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('should update email notification', async () => {
      const updateDto = { name: 'Updated Name' };
      const updated = { ...mockEmailNotification, Name: 'Updated Name' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.emailNotification.findUnique.mockResolvedValue(
        mockEmailNotification,
      );
      prismaService.emailNotification.update.mockResolvedValue(updated);

      const result = await service.update(1, updateDto);

      expect(result).toEqual(updated);
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when not found', async () => {
      const updateDto = { name: 'Updated Name' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.emailNotification.findUnique.mockResolvedValue(null);

      await expect(service.update(999, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete email notification', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.emailNotification.findUnique.mockResolvedValue(
        mockEmailNotification,
      );
      prismaService.emailNotification.delete.mockResolvedValue(
        mockEmailNotification,
      );

      const result = await service.remove(1);

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when not found', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.emailNotification.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
