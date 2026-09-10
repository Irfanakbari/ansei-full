import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DashboardSettingService } from './dashboard-setting.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';

// Mock the PrismaService
jest.mock('../../prisma/prisma.service');
jest.mock('../../common/log-process/log-process.service');

describe('DashboardSettingService', () => {
  let service: DashboardSettingService;

  const mockDashboardSetting = {
    Id: 1,
    StartDate: new Date('2026-01-01'),
    EndDate: new Date('2026-12-31'),
    UpdatedAt: new Date('2026-01-01'),
  };

  const mockLogProcess = {
    ProcessId: 'PR20260606120000123456',
    FunctionId: 'DASHBOARD_002',
    FunctionName: 'updateDashboardSetting',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'admin',
  };

  let prismaService: {
    dashboardSetting: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  let logService: {
    startProcess: jest.Mock;
    addLog: jest.Mock;
    completeProcess: jest.Mock;
  };

  beforeEach(async () => {
    prismaService = {
      dashboardSetting: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
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
        DashboardSettingService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
      ],
    }).compile();

    service = module.get<DashboardSettingService>(DashboardSettingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all dashboard settings', async () => {
      const expected = [mockDashboardSetting];
      prismaService.dashboardSetting.findMany.mockResolvedValue(expected);

      const result = await service.findAll();

      expect(result).toEqual(expected);
      expect(prismaService.dashboardSetting.findMany).toHaveBeenCalledWith({
        orderBy: { Id: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a dashboard setting by id', async () => {
      prismaService.dashboardSetting.findUnique.mockResolvedValue(
        mockDashboardSetting,
      );

      const result = await service.findOne(1);

      expect(result).toEqual(mockDashboardSetting);
      expect(prismaService.dashboardSetting.findUnique).toHaveBeenCalledWith({
        where: { Id: 1 },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prismaService.dashboardSetting.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findLatest', () => {
    it('should return the latest dashboard setting', async () => {
      prismaService.dashboardSetting.findFirst.mockResolvedValue(
        mockDashboardSetting,
      );

      const result = await service.findLatest();

      expect(result).toEqual(mockDashboardSetting);
      expect(prismaService.dashboardSetting.findFirst).toHaveBeenCalledWith({
        orderBy: { Id: 'desc' },
      });
    });

    it('should throw NotFoundException when no settings exist', async () => {
      prismaService.dashboardSetting.findFirst.mockResolvedValue(null);

      await expect(service.findLatest()).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an existing dashboard setting', async () => {
      const updateDto = { startDate: '2026-06-01T00:00:00.000Z' };
      const updated = {
        ...mockDashboardSetting,
        StartDate: new Date('2026-06-01'),
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.dashboardSetting.findUnique.mockResolvedValue(
        mockDashboardSetting,
      );
      prismaService.dashboardSetting.update.mockResolvedValue(updated);

      const result = await service.update(1, updateDto);

      expect(result).toEqual(updated);
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when updating non-existent setting', async () => {
      const updateDto = { startDate: '2026-06-01T00:00:00.000Z' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.dashboardSetting.findUnique.mockResolvedValue(null);

      await expect(service.update(999, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
