import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ManPowerService } from './man-power.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NasUploadService } from '../../common/utils/nas-upload.service';

// Mock the PrismaService
jest.mock('../../prisma/prisma.service');
jest.mock('../../common/log-process/log-process.service');
jest.mock('../../common/utils/nas-upload.service');

describe('ManPowerService', () => {
  let service: ManPowerService;

  const mockManPower = {
    Uid: '550e8400-e29b-41d4-a716-446655440000',
    Nik: 'EMP001',
    Name: 'John Doe',
    CreatedAt: new Date(),
    Status: true,
    Line: 'Line A',
    ProductionReport: [],
  };

  const mockLogProcess = {
    ProcessId: 'PR20260606120000123456',
    FunctionId: 'MANPOWER_001',
    FunctionName: 'createManPower',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'admin',
  };

  let prismaService: {
    manPower: {
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

  let nasUploadService: {
    uploadFile: jest.Mock;
    deleteFile: jest.Mock;
  };

  beforeEach(async () => {
    prismaService = {
      manPower: {
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

    nasUploadService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    (PrismaService as unknown as jest.Mock).mockImplementation(
      () => prismaService,
    );
    (LogProcessService as unknown as jest.Mock).mockImplementation(
      () => logService,
    );
    (NasUploadService as unknown as jest.Mock).mockImplementation(
      () => nasUploadService,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManPowerService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
        { provide: NasUploadService, useValue: nasUploadService },
      ],
    }).compile();

    service = module.get<ManPowerService>(ManPowerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all man power records', async () => {
      const expected = [mockManPower];
      prismaService.manPower.count.mockResolvedValue(1);
      prismaService.manPower.findMany.mockResolvedValue(expected);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual(expected);
      expect(prismaService.manPower.findMany).toHaveBeenCalledWith({
        where: {},
        include: { SkillMatrix: true },
        orderBy: [{ CreatedAt: 'desc' }, { Uid: 'asc' }],
        skip: 0,
        take: 50,
      });
    });

    it('should return empty array when no records exist', async () => {
      prismaService.manPower.findMany.mockResolvedValue([]);

      prismaService.manPower.count.mockResolvedValue(0);
      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a man power by uid', async () => {
      prismaService.manPower.findUnique.mockResolvedValue(mockManPower);

      const result = await service.findOne(mockManPower.Uid);

      expect(result).toEqual(mockManPower);
      expect(prismaService.manPower.findUnique).toHaveBeenCalledWith({
        where: { Uid: mockManPower.Uid },
        include: { SkillMatrix: true },
      });
    });

    it('should throw NotFoundException when record not found', async () => {
      prismaService.manPower.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-uid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByNik', () => {
    it('should return a man power by nik', async () => {
      prismaService.manPower.findUnique.mockResolvedValue(mockManPower);

      const result = await service.findByNik('EMP001');

      expect(result).toEqual(mockManPower);
      expect(prismaService.manPower.findUnique).toHaveBeenCalledWith({
        where: { Nik: 'EMP001' },
        include: { SkillMatrix: true },
      });
    });

    it('should throw NotFoundException when record not found', async () => {
      prismaService.manPower.findUnique.mockResolvedValue(null);

      await expect(service.findByNik('INVALID')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a new man power record', async () => {
      const createDto = { nik: 'EMP002', name: 'Jane Doe', line: 'Line B' };
      const created = { ...mockManPower, Nik: 'EMP002', Name: 'Jane Doe' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.manPower.findUnique.mockResolvedValue(null);
      prismaService.manPower.create.mockResolvedValue(created);

      const result = await service.create(createDto);

      expect(result).toEqual(created);
      expect(logService.startProcess).toHaveBeenCalledWith({
        functionId: 'MANPOWER_001',
        functionName: 'ManPowerService.Create',
      });
    });

    it('should throw ConflictException when nik already exists', async () => {
      const createDto = { nik: 'EMP001', name: 'Jane Doe' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.manPower.findUnique.mockResolvedValue(mockManPower);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('should update an existing man power record', async () => {
      const updateDto = { name: 'John Updated' };
      const updated = { ...mockManPower, Name: 'John Updated' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.manPower.findUnique.mockResolvedValue(mockManPower);
      prismaService.manPower.update.mockResolvedValue(updated);

      const result = await service.update(mockManPower.Uid, updateDto);

      expect(result).toEqual(updated);
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should throw NotFoundException when updating non-existent record', async () => {
      const updateDto = { name: 'Updated Name' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.manPower.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent-uid', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when changing to existing nik', async () => {
      const updateDto = { nik: 'EMP002' };
      const existingManPower = { ...mockManPower, Nik: 'EMP002' };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.manPower.findUnique
        .mockResolvedValueOnce(mockManPower)
        .mockResolvedValueOnce(existingManPower);

      await expect(service.update(mockManPower.Uid, updateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('should delete an existing man power record', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.manPower.findUnique.mockResolvedValue(mockManPower);
      prismaService.manPower.delete.mockResolvedValue(mockManPower);

      const result = await service.remove(mockManPower.Uid);

      expect(result).toEqual({ deleted: true, uid: mockManPower.Uid });
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should delete picture from NAS if PicturePath exists when removing', async () => {
      const manPowerWithPic = {
        ...mockManPower,
        PicturePath: 'http://192.168.1.15:8080/Ansei_Asset/manpower/EMP001.jpg',
      };
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      nasUploadService.deleteFile.mockResolvedValue(undefined);
      prismaService.manPower.findUnique.mockResolvedValue(manPowerWithPic);
      prismaService.manPower.delete.mockResolvedValue(manPowerWithPic);

      const result = await service.remove(manPowerWithPic.Uid);

      expect(result).toEqual({ deleted: true, uid: manPowerWithPic.Uid });
      expect(nasUploadService.deleteFile).toHaveBeenCalledWith(
        manPowerWithPic.PicturePath,
      );
    });

    it('should throw NotFoundException when deleting non-existent record', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.manPower.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-uid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('uploadPicture', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'profile.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 1024 * 1024, // 1MB
      buffer: Buffer.from('fake image content'),
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    it('should upload picture to NAS and update PicturePath', async () => {
      const expectedUrl =
        'http://192.168.1.15:8080/Ansei_Asset/manpower/EMP001_123.png';
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.manPower.findUnique.mockResolvedValue(mockManPower);
      nasUploadService.uploadFile.mockResolvedValue(expectedUrl);
      prismaService.manPower.update.mockResolvedValue({
        ...mockManPower,
        PicturePath: expectedUrl,
      });

      const result = await service.uploadPicture(
        mockManPower.Uid,
        mockFile,
        'admin',
      );

      expect(result.PicturePath).toBe(expectedUrl);
      expect(nasUploadService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          subFolder: 'manpower',
          fileBuffer: mockFile.buffer,
        }),
      );
      expect(prismaService.manPower.update).toHaveBeenCalledWith({
        where: { Uid: mockManPower.Uid },
        data: { PicturePath: expectedUrl },
      });
    });

    it('should delete old picture from NAS if one already exists', async () => {
      const oldPicUrl =
        'http://192.168.1.15:8080/Ansei_Asset/manpower/EMP001_old.jpg';
      const existingWithPic = { ...mockManPower, PicturePath: oldPicUrl };
      const newPicUrl =
        'http://192.168.1.15:8080/Ansei_Asset/manpower/EMP001_new.png';

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.manPower.findUnique.mockResolvedValue(existingWithPic);
      nasUploadService.deleteFile.mockResolvedValue(undefined);
      nasUploadService.uploadFile.mockResolvedValue(newPicUrl);
      prismaService.manPower.update.mockResolvedValue({
        ...existingWithPic,
        PicturePath: newPicUrl,
      });

      const result = await service.uploadPicture(
        existingWithPic.Uid,
        mockFile,
        'admin',
      );

      expect(nasUploadService.deleteFile).toHaveBeenCalledWith(oldPicUrl);
      expect(result.PicturePath).toBe(newPicUrl);
    });

    it('should throw UnsupportedMediaTypeException for invalid file extension', async () => {
      const invalidFile = {
        ...mockFile,
        originalname: 'script.exe',
      };
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);

      await expect(
        service.uploadPicture(mockManPower.Uid, invalidFile),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('should throw BadRequestException when file size exceeds 5MB', async () => {
      const largeFile = {
        ...mockFile,
        size: 6 * 1024 * 1024, // 6MB
      };
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);

      await expect(
        service.uploadPicture(mockManPower.Uid, largeFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when man power does not exist', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.manPower.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadPicture('non-existent-uid', mockFile),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePicture', () => {
    it('should delete picture from NAS and set PicturePath to null', async () => {
      const picUrl = 'http://192.168.1.15:8080/Ansei_Asset/manpower/EMP001.jpg';
      const manPowerWithPic = { ...mockManPower, PicturePath: picUrl };

      logService.startProcess.mockResolvedValue(mockLogProcess);
      logService.addLog.mockResolvedValue({} as any);
      logService.completeProcess.mockResolvedValue(undefined);
      prismaService.manPower.findUnique.mockResolvedValue(manPowerWithPic);
      nasUploadService.deleteFile.mockResolvedValue(undefined);
      prismaService.manPower.update.mockResolvedValue({
        ...manPowerWithPic,
        PicturePath: null,
      });

      const result = await service.deletePicture(manPowerWithPic.Uid, 'admin');

      expect(result.PicturePath).toBeNull();
      expect(nasUploadService.deleteFile).toHaveBeenCalledWith(picUrl);
      expect(prismaService.manPower.update).toHaveBeenCalledWith({
        where: { Uid: manPowerWithPic.Uid },
        data: { PicturePath: null },
      });
    });

    it('should throw NotFoundException when man power does not exist', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.manPower.findUnique.mockResolvedValue(null);

      await expect(service.deletePicture('non-existent-uid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when man power has no picture', async () => {
      logService.startProcess.mockResolvedValue(mockLogProcess);
      prismaService.manPower.findUnique.mockResolvedValue(mockManPower); // PicturePath is null/undefined

      await expect(service.deletePicture(mockManPower.Uid)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
