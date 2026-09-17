import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DisplayConfigService } from './display-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NasUploadService } from '../../common/utils/nas-upload.service';

// Mock the PrismaService
jest.mock('../../prisma/prisma.service');
jest.mock('../../common/log-process/log-process.service');

describe('DisplayConfigService', () => {
  let service: DisplayConfigService;

  const mockDisplayConfig = {
    Id: 1,
    Description: 'Display Utama Gudang',
    Url: 'https://display.example.com/screen/1',
    IsOpen: false,
    Loop: true,
    CreatedAt: new Date('2026-01-01'),
    UpdatedAt: new Date('2026-01-01'),
  };

  const mockLogProcess = {
    ProcessId: 'PR20260606120000123456',
    FunctionId: 'DISPLAY_001',
    FunctionName: 'DisplayConfigService.Create',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'admin',
  };

  let prismaService: {
    displayConfig: {
      count: jest.Mock;
      findMany: jest.Mock;
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
      displayConfig: {
        count: jest.fn(),
        findMany: jest.fn(),
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
        DisplayConfigService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
        {
          provide: NasUploadService,
          useValue: { uploadFile: jest.fn(), deleteFile: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<DisplayConfigService>(DisplayConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all display configs', async () => {
      const expected = [mockDisplayConfig];
      prismaService.displayConfig.count.mockResolvedValue(1);
      prismaService.displayConfig.findMany.mockResolvedValue(expected);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual(expected);
      expect(prismaService.displayConfig.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ CreatedAt: 'desc' }, { Id: 'desc' }],
        skip: 0,
        take: 50,
      });
    });

    it('should return empty array when no display configs exist', async () => {
      prismaService.displayConfig.count.mockResolvedValue(0);
      prismaService.displayConfig.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual([]);
    });
  });

  describe('findActive', () => {
    it('should return the most recently created open display config', async () => {
      prismaService.displayConfig.findFirst.mockResolvedValue(
        mockDisplayConfig,
      );

      const result = await service.findActive();

      expect(result).toEqual(mockDisplayConfig);
      expect(prismaService.displayConfig.findFirst).toHaveBeenCalledWith({
        where: { IsOpen: true, OR: [{ Line: null }, { Line: '' }] },
        orderBy: { CreatedAt: 'desc' },
      });
    });

    it('should return null when no display config is active', async () => {
      prismaService.displayConfig.findFirst.mockResolvedValue(null);

      await expect(service.findActive()).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new display config with isOpen = false', async () => {
      const createDto = {
        description: 'Display Utama Gudang',
        url: 'https://display.example.com/screen/1',
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.displayConfig.create.mockResolvedValue(mockDisplayConfig);

      const result = await service.create(createDto, 'admin');

      expect(result).toEqual(mockDisplayConfig);
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should create with isOpen = true and close other open displays (mutex)', async () => {
      const createDto = {
        description: 'Display Utama Gudang',
        url: 'https://display.example.com/screen/1',
        isOpen: true,
      };

      const existingOpenConfig = {
        ...mockDisplayConfig,
        Id: 2,
        Description: 'Display Lain',
        IsOpen: true,
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.displayConfig.findFirst.mockResolvedValue(
        existingOpenConfig,
      );
      prismaService.displayConfig.update.mockResolvedValue({
        ...existingOpenConfig,
        IsOpen: false,
      });
      prismaService.displayConfig.create.mockResolvedValue({
        ...mockDisplayConfig,
        IsOpen: true,
      });

      const result = await service.create(createDto, 'admin');

      expect(result.IsOpen).toBe(true);
      expect(prismaService.displayConfig.findFirst).toHaveBeenCalledWith({
        where: { IsOpen: true, OR: [{ Line: null }, { Line: '' }] },
      });
      expect(prismaService.displayConfig.update).toHaveBeenCalledWith({
        where: { Id: 2 },
        data: { IsOpen: false },
      });
    });
  });

  describe('update', () => {
    it('should update an existing display config', async () => {
      const updateDto = { description: 'Updated Description' };
      const updated = {
        ...mockDisplayConfig,
        Description: 'Updated Description',
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.displayConfig.findUnique = jest
        .fn()
        .mockResolvedValue(mockDisplayConfig);
      prismaService.displayConfig.update.mockResolvedValue(updated);

      const result = await service.update(1, updateDto, 'admin');

      expect(result).toEqual(updated);
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when updating non-existent config', async () => {
      const updateDto = { description: 'Updated Description' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.displayConfig.findUnique = jest
        .fn()
        .mockResolvedValue(null);

      await expect(service.update(999, updateDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should set isOpen = true and close other open displays (mutex)', async () => {
      const updateDto = { isOpen: true };
      const existingOpenConfig = {
        ...mockDisplayConfig,
        Id: 2,
        Description: 'Display Lain',
        IsOpen: true,
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.displayConfig.findUnique = jest
        .fn()
        .mockResolvedValue(mockDisplayConfig);
      prismaService.displayConfig.findFirst.mockResolvedValue(
        existingOpenConfig,
      );
      prismaService.displayConfig.update.mockResolvedValue({
        ...mockDisplayConfig,
        IsOpen: true,
      });

      const result = await service.update(1, updateDto, 'admin');

      expect(result.IsOpen).toBe(true);
      expect(prismaService.displayConfig.findFirst).toHaveBeenCalledWith({
        where: {
          IsOpen: true,
          OR: [{ Line: null }, { Line: '' }],
          Id: { not: 1 },
        },
      });
      expect(prismaService.displayConfig.update).toHaveBeenCalledWith({
        where: { Id: 2 },
        data: { IsOpen: false },
      });
    });

    it('should not close other displays when setting isOpen = false', async () => {
      const updateDto = { isOpen: false };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.displayConfig.findUnique = jest
        .fn()
        .mockResolvedValue(mockDisplayConfig);
      prismaService.displayConfig.update.mockResolvedValue({
        ...mockDisplayConfig,
        IsOpen: false,
      });

      await service.update(1, updateDto, 'admin');

      expect(prismaService.displayConfig.findFirst).not.toHaveBeenCalled();
    });

    it('should not close other displays when isOpen remains unchanged', async () => {
      const updateDto = { description: 'Updated Description' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.displayConfig.findUnique = jest
        .fn()
        .mockResolvedValue(mockDisplayConfig);
      prismaService.displayConfig.update.mockResolvedValue({
        ...mockDisplayConfig,
        Description: 'Updated Description',
      });

      await service.update(1, updateDto, 'admin');

      expect(prismaService.displayConfig.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete an existing display config', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.displayConfig.findUnique = jest
        .fn()
        .mockResolvedValue(mockDisplayConfig);
      prismaService.displayConfig.delete.mockResolvedValue(mockDisplayConfig);

      const result = await service.remove(1, 'admin');

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when deleting non-existent config', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.displayConfig.findUnique = jest
        .fn()
        .mockResolvedValue(null);

      await expect(service.remove(999, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
