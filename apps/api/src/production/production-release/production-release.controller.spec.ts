import { Test, TestingModule } from '@nestjs/testing';
import { ProductionReleaseController } from './production-release.controller';
import { ProductionReleaseService } from './production-release.service';
import {
  CreateProductionReleaseDto,
  UploadProductionAttachmentDto,
} from './dto';
import type { ProductionReleaseModel } from '../../generated/prisma/models';
import { ProductionStatus } from '../../generated/prisma/enums';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

describe('ProductionReleaseController', () => {
  let controller: ProductionReleaseController;
  let service: any;

  const mockUser: ICurrentUser = {
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    roleId: 1,
    roleName: 'Admin',
    sessionId: 'session-123',
    permissions: [
      'PRODUCTION_RELEASE_READ',
      'PRODUCTION_RELEASE_CREATE',
      'PRODUCTION_RELEASE_UPDATE',
      'PRODUCTION_RELEASE_DELETE',
    ],
    departments: ['Production'],
  };

  const mockProductionRelease: ProductionReleaseModel = {
    Id: 'uuid-1234',
    ReleaseNumber: 'PR-2026-001',
    PlanDate: new Date('2026-06-10'),
    Status: ProductionStatus.DRAFT,
    Notes: 'Test release',
    TotalTargetQty: 1000,
    TotalGoodQty: 0,
    TotalNgQty: 0,
    IsNoAttachment: false,
    CreatedAt: new Date(),
    CreatedBy: 'testuser',
    UpdatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByReleaseNumber: jest.fn(),
      getLabels: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      uploadAttachment: jest.fn(),
      getAttachments: jest.fn(),
      deleteAttachment: jest.fn(),
      replaceAttachment: jest.fn(),
      downloadAttachment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductionReleaseController],
      providers: [{ provide: ProductionReleaseService, useValue: mockService }],
    }).compile();

    controller = module.get<ProductionReleaseController>(
      ProductionReleaseController,
    );
    service = module.get(ProductionReleaseService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all production releases', async () => {
      const mockReleases = [mockProductionRelease];
      service.findAll.mockResolvedValue(mockReleases);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(mockReleases);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a production release by id', async () => {
      service.findOne.mockResolvedValue(mockProductionRelease);

      const result = await controller.findOne('uuid-1234', mockUser);

      expect(result).toEqual(mockProductionRelease);
      expect(service.findOne).toHaveBeenCalledWith('uuid-1234');
    });
  });

  describe('findByReleaseNumber', () => {
    it('should return a production release by release number', async () => {
      service.findByReleaseNumber.mockResolvedValue(mockProductionRelease);

      const result = await controller.findByReleaseNumber(
        'PR-2026-001',
        mockUser,
      );

      expect(result).toEqual(mockProductionRelease);
      expect(service.findByReleaseNumber).toHaveBeenCalledWith('PR-2026-001');
    });
  });

  describe('getLabels', () => {
    it('should return labels for a production release', async () => {
      const mockLabels = [
        { Id: 1, LabelNumber: 'PO-00100100010', FinishGoodId: 'FG001' },
      ];
      service.getLabels.mockResolvedValue(mockLabels);

      const result = await controller.getLabels('uuid-1234', mockUser);

      expect(result).toEqual(mockLabels);
      expect(service.getLabels).toHaveBeenCalledWith('uuid-1234');
    });
  });

  describe('create', () => {
    it('should create a new production release with isNoAttachment', async () => {
      const createDto: CreateProductionReleaseDto = {
        releaseNumber: 'PR-2026-001',
        planDate: new Date('2026-06-10'),
        notes: 'Test release',
        forecastIds: ['PO-001', 'PO-002'],
        isNoAttachment: true,
      };
      service.create.mockResolvedValue({
        ...mockProductionRelease,
        IsNoAttachment: true,
      });

      const result = await controller.create(createDto, mockUser);

      expect(result.IsNoAttachment).toBe(true);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.username);
    });
  });

  describe('update', () => {
    it('should update a production release', async () => {
      const updateDto = { status: 'RELEASED', isNoAttachment: false };
      const updatedRelease = {
        ...mockProductionRelease,
        Status: ProductionStatus.RELEASED,
        IsNoAttachment: false,
      };
      service.update.mockResolvedValue(updatedRelease);

      const result = await controller.update('uuid-1234', updateDto, mockUser);

      expect(result).toEqual(updatedRelease);
      expect(service.update).toHaveBeenCalledWith(
        'uuid-1234',
        updateDto,
        mockUser.username,
      );
    });
  });

  describe('remove', () => {
    it('should delete a production release', async () => {
      service.remove.mockResolvedValue({ deleted: true, id: 'uuid-1234' });

      const result = await controller.remove('uuid-1234', mockUser);

      expect(result).toEqual({ deleted: true, id: 'uuid-1234' });
      expect(service.remove).toHaveBeenCalledWith(
        'uuid-1234',
        mockUser.username,
      );
    });
  });

  describe('uploadAttachment', () => {
    it('should upload an attachment', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const uploadDto: UploadProductionAttachmentDto = {
        productionReleaseId: 'uuid-1234',
      };

      const mockAttachment = {
        id: 1,
        FileName: 'test.pdf',
        FilePath: 'http://nas/test.pdf',
        ProductionReleaseId: 'uuid-1234',
      };

      service.uploadAttachment.mockResolvedValue(mockAttachment);

      const result = await controller.uploadAttachment(
        'uuid-1234',
        [mockFile],
        mockUser,
      );

      expect(result).toEqual(mockAttachment);
      expect(service.uploadAttachment).toHaveBeenCalledWith(
        { ...uploadDto, productionReleaseId: 'uuid-1234' },
        [mockFile],
        mockUser.username,
      );
    });
  });

  describe('getAttachments', () => {
    it('should return attachments for a production release', async () => {
      const mockAttachments = [
        { id: 1, FileName: 'test.pdf', ProductionReleaseId: 'uuid-1234' },
      ];
      service.getAttachments.mockResolvedValue(mockAttachments);

      const result = await controller.getAttachments('uuid-1234', mockUser);

      expect(result).toEqual(mockAttachments);
      expect(service.getAttachments).toHaveBeenCalledWith('uuid-1234');
    });
  });

  describe('deleteAttachment', () => {
    it('should delete an attachment', async () => {
      service.deleteAttachment.mockResolvedValue({ deleted: true, id: 1 });

      const result = await controller.deleteAttachment(
        'uuid-1234',
        1,
        mockUser,
      );

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(service.deleteAttachment).toHaveBeenCalledWith(
        'uuid-1234',
        1,
        mockUser.username,
      );
    });
  });
});
