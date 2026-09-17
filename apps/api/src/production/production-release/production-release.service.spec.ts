import { Test, TestingModule } from '@nestjs/testing';
import { ProductionReleaseService } from './production-release.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NasUploadService } from '../../common/utils/nas-upload.service';
import {
  BadRequestException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ProductionStatus } from '../../generated/prisma/enums';

describe('ProductionReleaseService', () => {
  let service: ProductionReleaseService;
  let prismaService: any;
  let logService: any;
  let nasUploadService: any;

  beforeEach(async () => {
    prismaService = {
      productionRelease: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      forecast: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      finishGood: {
        findMany: jest.fn(),
      },
      billOfMaterials: {
        findMany: jest.fn(),
      },
      labelData: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
        createMany: jest.fn(),
      },
      boxQTY: {
        findUnique: jest.fn(),
      },
      deliveryHistory: {
        findMany: jest.fn(),
      },
      deliveryAttachment: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionReleaseService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
        { provide: NasUploadService, useValue: nasUploadService },
      ],
    }).compile();

    service = module.get<ProductionReleaseService>(ProductionReleaseService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all production releases with progress', async () => {
      const mockReleases = [
        {
          Id: 'rel-1',
          ReleaseNumber: 'PR-001',
          Status: 'RELEASED',
          IsNoAttachment: false,
          Forecasts: [
            {
              PoId: 'PO-001',
              FinishGoodId: 'FG-001',
              Qty: 10,
              Shopping: [{ QtyPick: 20 }],
            },
          ],
          _count: { LabelDatas: 2, Forecasts: 1 },
        },
      ];

      prismaService.productionRelease.findMany.mockResolvedValue(mockReleases);
      prismaService.productionRelease.count.mockResolvedValue(1);
      prismaService.billOfMaterials.findMany.mockResolvedValue([]);
      prismaService.finishGood.findMany.mockResolvedValue([]);
      prismaService.labelData.findMany.mockResolvedValue([]);
      prismaService.deliveryHistory.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual(expect.any(Array));
      expect(result.meta).toEqual({
        page: 1,
        limit: 50,
        totalItems: 1,
        totalPages: 1,
      });
      expect(prismaService.productionRelease.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a release by id', async () => {
      const mockRelease = {
        Id: 'rel-1',
        ReleaseNumber: 'PR-001',
        Status: 'RELEASED',
        IsNoAttachment: false,
      };

      prismaService.productionRelease.findUnique.mockResolvedValue(mockRelease);

      const result = await service.findOne('rel-1');

      expect(result.ReleaseNumber).toBe('PR-001');
    });

    it('should throw NotFoundException when not found', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('should create a production release with isNoAttachment', async () => {
      const createDto = {
        releaseNumber: 'PR-2026-001',
        planDate: new Date('2026-06-10'),
        forecastIds: ['PO-001'],
        isNoAttachment: true,
      };

      const mockRelease = {
        Id: 'rel-1',
        ReleaseNumber: 'PR-2026-001',
        Status: ProductionStatus.DRAFT,
        IsNoAttachment: true,
      };

      logService.startProcess.mockResolvedValue({
        ProcessId: 'PR123456',
        FunctionId: 'PROD_RELEASE_001',
        FunctionName: 'ProductionReleaseService.Create',
        ProcessStatus: 'STARTED',
      });

      prismaService.productionRelease.findFirst.mockResolvedValue(null);
      prismaService.productionRelease.create.mockResolvedValue(mockRelease);
      prismaService.forecast.findMany.mockResolvedValue([{ Qty: 10 }]);
      prismaService.productionRelease.findUnique.mockResolvedValue(mockRelease);

      const result = await service.create(createDto, 'testuser');

      expect(prismaService.productionRelease.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ReleaseNumber: 'PR-2026-001',
          IsNoAttachment: true,
        }),
      });
    });
  });

  describe('update', () => {
    const existingRelease = {
      Id: 'rel-1',
      ReleaseNumber: 'PR-001',
      Status: ProductionStatus.DRAFT,
      IsNoAttachment: false,
      TotalTargetQty: 10,
    };

    beforeEach(() => {
      logService.startProcess.mockResolvedValue({
        ProcessId: 'PR123456',
        FunctionId: 'PROD_RELEASE_002',
        FunctionName: 'ProductionReleaseService.Update',
        ProcessStatus: 'STARTED',
      });
    });

    it('should update isNoAttachment field', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(
        existingRelease,
      );
      prismaService.forecast.findMany.mockResolvedValue([{ Qty: 10 }]);
      prismaService.productionRelease.update.mockResolvedValue({
        ...existingRelease,
        IsNoAttachment: true,
      });

      await service.update('rel-1', { isNoAttachment: true }, 'testuser');

      expect(prismaService.productionRelease.update).toHaveBeenCalledWith({
        where: { Id: 'rel-1' },
        data: expect.objectContaining({
          IsNoAttachment: true,
        }),
      });
    });

    it('should reject RELEASED when a linked finish good has no Box Qty', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(
        existingRelease,
      );
      prismaService.productionRelease.findFirst.mockResolvedValue(null);
      prismaService.forecast.findMany.mockResolvedValue([
        {
          PoId: 'PO-001',
          FinishGoodId: 'FG-001',
          PartData: { PartName: 'Finish Good A', BoxQTY: null },
        },
      ]);

      await expect(
        service.update(
          'rel-1',
          { status: ProductionStatus.RELEASED },
          'testuser',
        ),
      ).rejects.toThrow('Box Qty must be configured');
      expect(prismaService.labelData.createMany).not.toHaveBeenCalled();
      expect(prismaService.productionRelease.update).not.toHaveBeenCalled();
    });

    it('should reject RELEASED when Box Qty is zero', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(
        existingRelease,
      );
      prismaService.productionRelease.findFirst.mockResolvedValue(null);
      prismaService.forecast.findMany.mockResolvedValue([
        {
          PoId: 'PO-001',
          FinishGoodId: 'FG-001',
          PartData: { PartName: 'Finish Good A', BoxQTY: { Qty: 0 } },
        },
      ]);

      await expect(
        service.update(
          'rel-1',
          { status: ProductionStatus.RELEASED },
          'testuser',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaService.labelData.createMany).not.toHaveBeenCalled();
    });

    it('should reject COMPLETED while scanned label quantity is below target', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue({
        ...existingRelease,
        Status: ProductionStatus.RELEASED,
      });
      prismaService.forecast.findMany.mockResolvedValue([{ Qty: 100 }]);
      prismaService.labelData.findMany.mockResolvedValue([{ QtyThisBox: 40 }]);

      await expect(
        service.update(
          'rel-1',
          { status: ProductionStatus.COMPLETED },
          'testuser',
        ),
      ).rejects.toThrow('remaining 60');
      expect(prismaService.productionRelease.update).not.toHaveBeenCalled();
    });

    it('should allow COMPLETED when scanned label quantity reaches target', async () => {
      const released = {
        ...existingRelease,
        Status: ProductionStatus.RELEASED,
      };
      prismaService.productionRelease.findUnique
        .mockResolvedValueOnce(released)
        .mockResolvedValueOnce({ ...released, LabelDatas: [] });
      prismaService.forecast.findMany.mockResolvedValue([{ Qty: 100 }]);
      prismaService.labelData.findMany.mockResolvedValue([
        { QtyThisBox: 60 },
        { QtyThisBox: 40 },
      ]);
      prismaService.productionRelease.update.mockResolvedValue({
        ...released,
        Status: ProductionStatus.COMPLETED,
      });

      await service.update(
        'rel-1',
        { status: ProductionStatus.COMPLETED },
        'testuser',
      );

      expect(prismaService.productionRelease.update).toHaveBeenCalledWith({
        where: { Id: 'rel-1' },
        data: expect.objectContaining({
          Status: ProductionStatus.COMPLETED,
          TotalTargetQty: 100,
        }),
      });
    });
  });

  describe('uploadAttachment', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024 * 1024, // 1MB
      buffer: Buffer.from('test content'),
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const mockRelease = {
      Id: 'rel-1',
      ReleaseNumber: 'PR-001',
      Status: ProductionStatus.DRAFT,
      IsNoAttachment: false,
    };

    beforeEach(() => {
      logService.startProcess.mockResolvedValue({
        ProcessId: 'PR123456',
        FunctionId: 'PROD_RELEASE_ATTACH_001',
        FunctionName: 'ProductionReleaseService.UploadAttachment',
        ProcessStatus: 'STARTED',
      });
    });

    it('should upload attachment successfully', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(mockRelease);
      nasUploadService.uploadFile.mockResolvedValue('http://nas/file.pdf');
      prismaService.deliveryAttachment.create.mockResolvedValue({
        id: 1,
        FileName: 'test.pdf',
        FilePath: 'http://nas/file.pdf',
        ProductionReleaseId: 'rel-1',
      });

      const result = await service.uploadAttachment(
        { productionReleaseId: 'rel-1' },
        mockFile,
        'testuser',
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].FileName).toBe('test.pdf');
      expect(nasUploadService.uploadFile).toHaveBeenCalled();
    });

    it('should reject invalid file extension', async () => {
      const invalidFile = {
        ...mockFile,
        originalname: 'test.exe',
      };

      await expect(
        service.uploadAttachment(
          { productionReleaseId: 'rel-1' },
          invalidFile,
          'testuser',
        ),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('should reject file larger than 10MB', async () => {
      const largeFile = {
        ...mockFile,
        size: 11 * 1024 * 1024, // 11MB
      };

      await expect(
        service.uploadAttachment(
          { productionReleaseId: 'rel-1' },
          largeFile,
          'testuser',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject upload when IsNoAttachment is true (Pokayoke)', async () => {
      const noAttachmentRelease = {
        ...mockRelease,
        IsNoAttachment: true,
      };
      prismaService.productionRelease.findUnique.mockResolvedValue(
        noAttachmentRelease,
      );

      await expect(
        service.uploadAttachment(
          { productionReleaseId: 'rel-1' },
          mockFile,
          'testuser',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject upload when production release not found', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadAttachment(
          { productionReleaseId: 'invalid-id' },
          mockFile,
          'testuser',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject upload when status is COMPLETED (Pokayoke)', async () => {
      const completedRelease = {
        ...mockRelease,
        Status: ProductionStatus.COMPLETED,
      };
      prismaService.productionRelease.findUnique.mockResolvedValue(
        completedRelease,
      );

      await expect(
        service.uploadAttachment(
          { productionReleaseId: 'rel-1' },
          mockFile,
          'testuser',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create one attachment per PoNumber group (all forecasts with same PoNumber share this attachment)', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(mockRelease);
      prismaService.forecast.findUnique.mockResolvedValue({
        PoId: 'PO-001',
        PoNumber: 'PO-2026-001',
        ProductionReleaseId: 'rel-1',
      });
      prismaService.forecast.findMany.mockResolvedValue([
        { PoId: 'PO-001' },
        { PoId: 'PO-002' },
        { PoId: 'PO-003' },
      ]);
      nasUploadService.uploadFile.mockResolvedValue('http://nas/file.pdf');
      prismaService.deliveryAttachment.create.mockResolvedValue({
        id: 1,
        FileName: 'test.pdf',
        FilePath: 'http://nas/file.pdf',
        ProductionReleaseId: 'rel-1',
      });
      prismaService.forecast.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.uploadAttachment(
        { productionReleaseId: 'rel-1', forecastId: 'PO-001' },
        mockFile,
        'testuser',
      );

      // Verify forecast was found by PoId
      expect(prismaService.forecast.findUnique).toHaveBeenCalledWith({
        where: { PoId: 'PO-001' },
      });

      // Verify all forecasts with same PoNumber were found
      expect(prismaService.forecast.findMany).toHaveBeenCalledWith({
        where: { PoNumber: 'PO-2026-001' },
        select: { PoId: true },
      });

      // Verify ONLY ONE attachment was created (shared by all forecasts with same PoNumber)
      expect(prismaService.deliveryAttachment.create).toHaveBeenCalledTimes(1);

      // Verify all related forecasts were linked to this attachment
      expect(prismaService.forecast.updateMany).toHaveBeenCalledWith({
        where: { PoId: { in: ['PO-001', 'PO-002', 'PO-003'] } },
        data: { AttachmentDeliveryId: 1 },
      });

      // Verify the single attachment points to the file
      expect(result).toHaveLength(1);
      expect(result[0].FilePath).toBe('http://nas/file.pdf');
    });

    it('should reject if forecastId is not linked to production release (Pokayoke)', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(mockRelease);
      prismaService.forecast.findUnique.mockResolvedValue({
        PoId: 'PO-001',
        ProductionReleaseId: 'other-release',
      });

      await expect(
        service.uploadAttachment(
          { productionReleaseId: 'rel-1', forecastId: 'PO-001' },
          mockFile,
          'testuser',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAttachments', () => {
    it('should return attachments for a production release', async () => {
      const mockAttachments = [
        { id: 1, FileName: 'test.pdf', ProductionReleaseId: 'rel-1' },
        { id: 2, FileName: 'image.jpg', ProductionReleaseId: 'rel-1' },
      ];

      prismaService.productionRelease.findUnique.mockResolvedValue({
        Id: 'rel-1',
      });
      prismaService.deliveryAttachment.findMany.mockResolvedValue(
        mockAttachments,
      );

      const result = await service.getAttachments('rel-1');

      expect(result).toHaveLength(2);
      expect(prismaService.deliveryAttachment.findMany).toHaveBeenCalledWith({
        where: { ProductionReleaseId: 'rel-1' },
        orderBy: { CreatedAt: 'desc' },
      });
    });

    it('should throw NotFoundException when production release not found', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(null);

      await expect(service.getAttachments('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteAttachment', () => {
    it('should delete attachment and file from NAS', async () => {
      const mockAttachment = {
        id: 1,
        FileName: 'test.pdf',
        FilePath: 'http://nas/test.pdf',
        ProductionReleaseId: 'rel-1',
      };

      logService.startProcess.mockResolvedValue({
        ProcessId: 'PR123456',
        FunctionId: 'PROD_RELEASE_ATTACH_002',
        FunctionName: 'ProductionReleaseService.DeleteAttachment',
        ProcessStatus: 'STARTED',
      });

      prismaService.deliveryAttachment.findUnique.mockResolvedValue(
        mockAttachment,
      );
      nasUploadService.deleteFile.mockResolvedValue(undefined);
      prismaService.deliveryAttachment.delete.mockResolvedValue(mockAttachment);

      const result = await service.deleteAttachment(1, 'testuser');

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(nasUploadService.deleteFile).toHaveBeenCalledWith(
        'http://nas/test.pdf',
      );
    });

    it('should throw NotFoundException when attachment not found', async () => {
      logService.startProcess.mockResolvedValue({
        ProcessId: 'PR123456',
        FunctionId: 'PROD_RELEASE_ATTACH_002',
        FunctionName: 'ProductionReleaseService.DeleteAttachment',
        ProcessStatus: 'STARTED',
      });

      prismaService.deliveryAttachment.findUnique.mockResolvedValue(null);

      await expect(service.deleteAttachment(999, 'testuser')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
