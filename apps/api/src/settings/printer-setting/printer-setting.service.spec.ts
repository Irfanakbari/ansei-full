import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PrinterSettingService } from './printer-setting.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';

// Mock the PrismaService
jest.mock('../../prisma/prisma.service');
jest.mock('../../common/log-process/log-process.service');

describe('PrinterSettingService', () => {
  let service: PrinterSettingService;

  const mockPrinterSetting = {
    Id: 'uuid-1234-5678',
    Name: 'Printer Gudang 1',
    IpAddress: '192.168.1.100',
    CreatedAt: new Date('2026-01-01'),
    UpdatedAt: new Date('2026-01-01'),
  };

  const mockLogProcess = {
    ProcessId: 'PR20260606120000123456',
    FunctionId: 'PRINTER_001',
    FunctionName: 'PrinterSettingService.Create',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'admin',
  };

  let prismaService: {
    printerSetting: {
      count: jest.Mock;
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
      printerSetting: {
        count: jest.fn(),
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
        PrinterSettingService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
      ],
    }).compile();

    service = module.get<PrinterSettingService>(PrinterSettingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all printer settings', async () => {
      const expected = [mockPrinterSetting];
      prismaService.printerSetting.count.mockResolvedValue(1);
      prismaService.printerSetting.findMany.mockResolvedValue(expected);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual(expected);
      expect(prismaService.printerSetting.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ CreatedAt: 'desc' }, { Id: 'desc' }],
        skip: 0,
        take: 50,
      });
    });

    it('should return empty array when no printer settings exist', async () => {
      prismaService.printerSetting.count.mockResolvedValue(0);
      prismaService.printerSetting.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a printer setting by id', async () => {
      prismaService.printerSetting.findUnique.mockResolvedValue(
        mockPrinterSetting,
      );

      const result = await service.findOne('uuid-1234-5678');

      expect(result).toEqual(mockPrinterSetting);
      expect(prismaService.printerSetting.findUnique).toHaveBeenCalledWith({
        where: { Id: 'uuid-1234-5678' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prismaService.printerSetting.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByIpAddress', () => {
    it('should return a printer setting by IP address', async () => {
      prismaService.printerSetting.findUnique.mockResolvedValue(
        mockPrinterSetting,
      );

      const result = await service.findByIpAddress('192.168.1.100');

      expect(result).toEqual(mockPrinterSetting);
      expect(prismaService.printerSetting.findUnique).toHaveBeenCalledWith({
        where: { IpAddress: '192.168.1.100' },
      });
    });

    it('should throw NotFoundException when IP address not found', async () => {
      prismaService.printerSetting.findUnique.mockResolvedValue(null);

      await expect(service.findByIpAddress('192.168.1.999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a new printer setting', async () => {
      const createDto = {
        name: 'Printer Gudang 1',
        ipAddress: '192.168.1.100',
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.printerSetting.findUnique.mockResolvedValue(null);
      prismaService.printerSetting.create.mockResolvedValue(mockPrinterSetting);

      const result = await service.create(createDto, 'admin');

      expect(result).toEqual(mockPrinterSetting);
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw ConflictException when IP address already exists', async () => {
      const createDto = {
        name: 'Printer Gudang 1',
        ipAddress: '192.168.1.100',
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.printerSetting.findUnique.mockResolvedValue(
        mockPrinterSetting,
      );

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('should update an existing printer setting', async () => {
      const updateDto = { name: 'Printer Gudang Updated' };
      const updated = {
        ...mockPrinterSetting,
        Name: 'Printer Gudang Updated',
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.printerSetting.findUnique.mockResolvedValue(
        mockPrinterSetting,
      );
      prismaService.printerSetting.update.mockResolvedValue(updated);

      const result = await service.update('uuid-1234-5678', updateDto, 'admin');

      expect(result).toEqual(updated);
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when updating non-existent setting', async () => {
      const updateDto = { name: 'Updated Name' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.printerSetting.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', updateDto, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when new IP address conflicts', async () => {
      const updateDto = { ipAddress: '192.168.1.200' };
      const existingOther = {
        ...mockPrinterSetting,
        Id: 'other-uuid',
        IpAddress: '192.168.1.200',
      };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.printerSetting.findUnique
        .mockResolvedValueOnce(mockPrinterSetting) // find existing
        .mockResolvedValueOnce(existingOther); // check new IP

      await expect(
        service.update('uuid-1234-5678', updateDto, 'admin'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete an existing printer setting', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.printerSetting.findUnique.mockResolvedValue(
        mockPrinterSetting,
      );
      prismaService.printerSetting.delete.mockResolvedValue(mockPrinterSetting);

      const result = await service.remove('uuid-1234-5678', 'admin');

      expect(result).toEqual({ deleted: true, id: 'uuid-1234-5678' });
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when deleting non-existent setting', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.printerSetting.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
