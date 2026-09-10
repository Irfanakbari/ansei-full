import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SatuanService } from './satuan.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';

// Mock the PrismaService
jest.mock('../../prisma/prisma.service');
jest.mock('../../common/log-process/log-process.service');

describe('SatuanService', () => {
  let service: SatuanService;

  const mockSatuan = {
    Id: 1,
    Name: 'Pcs',
  };

  const mockLogProcess = {
    ProcessId: 'PR20260606120000123456',
    FunctionId: 'SATUAN_001',
    FunctionName: 'createSatuan',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'admin',
  };

  let prismaService: {
    satuan: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
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
      satuan: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
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
        SatuanService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
      ],
    }).compile();

    service = module.get<SatuanService>(SatuanService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all satuans', async () => {
      const expectedSatuans = [mockSatuan];
      prismaService.satuan.findMany.mockResolvedValue(expectedSatuans);

      const result = await service.findAll();

      expect(result).toEqual(expectedSatuans);
      expect(prismaService.satuan.findMany).toHaveBeenCalledWith({
        orderBy: { Id: 'asc' },
      });
    });

    it('should return empty array when no satuans exist', async () => {
      prismaService.satuan.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a satuan by id', async () => {
      prismaService.satuan.findUnique.mockResolvedValue(mockSatuan);

      const result = await service.findOne(1);

      expect(result).toEqual(mockSatuan);
      expect(prismaService.satuan.findUnique).toHaveBeenCalledWith({
        where: { Id: 1 },
      });
    });

    it('should throw NotFoundException when satuan not found', async () => {
      prismaService.satuan.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new satuan', async () => {
      const createDto = { name: 'Meter' };
      const createdSatuan = { Id: 3, Name: 'Meter' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.satuan.create.mockResolvedValue(createdSatuan);

      const result = await service.create(createDto, 'admin');

      expect(result).toEqual(createdSatuan);
      expect(logService.startProcess).toHaveBeenCalledWith({
        functionId: 'SATUAN_001',
        functionName: 'SatuanService.Create',
        createdBy: 'admin',
      });
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should log error and complete process as FAILED on exception', async () => {
      const createDto = { name: 'Meter' };
      const error = new Error('Database error');

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.satuan.create.mockRejectedValue(error);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        'Database error',
      );
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'FAILED',
      );
    });
  });

  describe('update', () => {
    it('should update an existing satuan', async () => {
      const updateDto = { name: 'Liter' };
      const updatedSatuan = { Id: 1, Name: 'Liter' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.satuan.findUnique.mockResolvedValue(mockSatuan);
      prismaService.satuan.update.mockResolvedValue(updatedSatuan);

      const result = await service.update(1, updateDto, 'admin');

      expect(result).toEqual(updatedSatuan);
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when updating non-existent satuan', async () => {
      const updateDto = { name: 'Liter' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.satuan.findUnique.mockResolvedValue(null);

      await expect(service.update(999, updateDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete an existing satuan', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.satuan.findUnique.mockResolvedValue(mockSatuan);
      prismaService.satuan.delete.mockResolvedValue(mockSatuan);

      const result = await service.remove(1, 'admin');

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when deleting non-existent satuan', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.satuan.findUnique.mockResolvedValue(null);

      await expect(service.remove(999, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
