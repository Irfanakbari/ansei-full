import { Test, TestingModule } from '@nestjs/testing';
import { InventoryCountingController } from './inventory-counting.controller';
import { InventoryCountingService } from './inventory-counting.service';
import { CreateInventoryCountingDto, UpdateInventoryCountingDto } from './dto';
import { ItemCategory, OpnameStatus } from '../generated/prisma/enums';
import type { ICurrentUser } from '../auth/interfaces/current-user.interface';

describe('InventoryCountingController', () => {
  let controller: InventoryCountingController;
  let service: any;

  const mockUser: ICurrentUser = {
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    roleId: 1,
    roleName: 'Admin',
    sessionId: 'sess-123',
    permissions: ['INVENTORY_COUNTING_CREATE', 'INVENTORY_COUNTING_READ'],
    departments: ['WAREHOUSE'],
  };

  const mockProcessId = 'PR202506110000001';

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getDetails: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      start: jest.fn(),
      generateCutOff: jest.fn(),
      updateActualStock: jest.fn(),
      batchUpdateActualStock: jest.fn(),
      uploadAttachments: jest.fn(),
      getAttachments: jest.fn(),
      downloadAttachment: jest.fn(),
      deleteAttachment: jest.fn(),
      previewOcr: jest.fn(),
      applyOcrResults: jest.fn(),
      close: jest.fn(),
      generateFinalReport: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryCountingController],
      providers: [{ provide: InventoryCountingService, useValue: mockService }],
    }).compile();

    controller = module.get<InventoryCountingController>(
      InventoryCountingController,
    );
    service = module.get(InventoryCountingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create inventory counting', async () => {
      const createDto: CreateInventoryCountingDto = {
        opnameNumber: 'INV-2025-001',
        category: ItemCategory.MATERIAL,
        notes: 'Test notes',
      };

      const mockResult = {
        success: true,
        processId: mockProcessId,
        data: {
          Id: '123',
          OpnameNumber: createDto.opnameNumber,
          Category: createDto.category,
          Status: OpnameStatus.DRAFT,
          CreatedAt: new Date(),
          CreatedBy: 'testuser',
          Notes: createDto.notes,
          StartedAt: null,
          CompletedAt: null,
          CompletedBy: null,
        },
      };

      service.create.mockResolvedValue(mockResult);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(mockResult);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.username);
    });
  });

  describe('findAll', () => {
    it('should return paginated inventory counting list', async () => {
      const mockResult = {
        data: [
          {
            id: '123',
            opnameNumber: 'INV-001',
            category: ItemCategory.MATERIAL,
            status: OpnameStatus.DRAFT,
            createdAt: new Date(),
            createdBy: 'testuser',
            startedAt: null,
            completedAt: null,
            completedBy: null,
            notes: null,
            details: [],
            totalItems: 0,
            completedItems: 0,
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };

      service.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll({});

      expect(result).toEqual(mockResult);
      expect(service.findAll).toHaveBeenCalledWith({});
    });
  });

  describe('findOne', () => {
    it('should return inventory counting by id', async () => {
      const mockResult = {
        Id: '123',
        OpnameNumber: 'INV-001',
        Category: ItemCategory.MATERIAL,
        Status: OpnameStatus.DRAFT,
        CreatedAt: new Date(),
        CreatedBy: 'testuser',
        StartedAt: null,
        CompletedAt: null,
        CompletedBy: null,
        Notes: null,
        Details: [],
        totalItems: 10,
        completedItems: 5,
      };

      service.findOne.mockResolvedValue(mockResult);

      const result = await controller.findOne('123');

      expect(result).toEqual(mockResult);
      expect(service.findOne).toHaveBeenCalledWith('123');
    });
  });

  describe('getDetails', () => {
    it('should return details for inventory counting', async () => {
      const mockResult = [
        {
          Id: 1,
          OpnameId: '123',
          MaterialId: 'MAT-001',
          FinishGoodId: null,
          Location: 'WAREHOUSE',
          SystemQty: 100,
          ActualQty: null,
          DiffQty: null,
          Notes: null,
        },
      ];

      service.getDetails.mockResolvedValue(mockResult);

      const result = await controller.getDetails('123');

      expect(result).toEqual(mockResult);
      expect(service.getDetails).toHaveBeenCalledWith('123');
    });
  });

  describe('update', () => {
    it('should update inventory counting notes', async () => {
      const updateDto: UpdateInventoryCountingDto = {
        notes: 'Updated notes',
      };

      const mockResult = {
        success: true,
        processId: mockProcessId,
        data: {
          Id: '123',
          OpnameNumber: 'INV-001',
          Category: ItemCategory.MATERIAL,
          Status: OpnameStatus.DRAFT,
          CreatedAt: new Date(),
          CreatedBy: 'testuser',
          Notes: 'Updated notes',
          StartedAt: null,
          CompletedAt: null,
          CompletedBy: null,
        },
      };

      service.update.mockResolvedValue(mockResult);

      const result = await controller.update('123', updateDto, mockUser);

      expect(result).toEqual(mockResult);
      expect(service.update).toHaveBeenCalledWith(
        '123',
        updateDto,
        mockUser.username,
      );
    });
  });

  describe('remove', () => {
    it('should delete inventory counting', async () => {
      const mockResult = {
        success: true,
        processId: mockProcessId,
        message: 'Inventory counting #123 deleted',
      };

      service.remove.mockResolvedValue(mockResult);

      const result = await controller.remove('123');

      expect(result).toEqual(mockResult);
      expect(service.remove).toHaveBeenCalledWith('123');
    });
  });

  describe('start', () => {
    it('should start inventory counting', async () => {
      const mockResult = {
        success: true,
        processId: mockProcessId,
        data: {
          Id: '123',
          OpnameNumber: 'INV-001',
          Category: ItemCategory.MATERIAL,
          Status: OpnameStatus.IN_PROGRESS,
          CreatedAt: new Date(),
          CreatedBy: 'testuser',
          Notes: null,
          StartedAt: new Date(),
          CompletedAt: null,
          CompletedBy: null,
        },
      };

      service.start.mockResolvedValue(mockResult);

      const result = await controller.start('123', mockUser);

      expect(result).toEqual(mockResult);
      expect(service.start).toHaveBeenCalledWith('123', mockUser.username);
    });
  });

  describe('generateCutOff', () => {
    it('should generate cut-off items', async () => {
      const mockDto = {
        inventoryCountingId: '123',
        itemCategory: 'MATERIAL' as const,
        location: 'WAREHOUSE',
      };

      const mockResult = {
        success: true,
        processId: mockProcessId,
        data: {
          inventoryCountingId: '123',
          count: 10,
        },
      };

      service.generateCutOff.mockResolvedValue(mockResult);

      const result = await controller.generateCutOff(mockDto, mockUser);

      expect(result).toEqual(mockResult);
      expect(service.generateCutOff).toHaveBeenCalledWith(
        mockDto,
        mockUser.username,
      );
    });
  });

  describe('updateActualStock', () => {
    it('should update actual stock for detail', async () => {
      const mockDto = {
        actualQty: 95,
        notes: 'Counted manually',
      };

      const mockResult = {
        success: true,
        processId: mockProcessId,
        data: {
          Id: 1,
          OpnameId: '123',
          MaterialId: 'MAT-001',
          FinishGoodId: null,
          Location: 'WAREHOUSE',
          SystemQty: 100,
          ActualQty: 95,
          DiffQty: -5,
          Notes: 'Counted manually',
        },
      };

      service.updateActualStock.mockResolvedValue(mockResult);

      const result = await controller.updateActualStock(
        '123',
        1,
        mockDto,
        mockUser,
      );

      expect(result).toEqual(mockResult);
      expect(service.updateActualStock).toHaveBeenCalledWith(
        '123',
        1,
        mockDto,
        mockUser.username,
      );
    });
  });

  describe('batchUpdateActualStock', () => {
    it('should update a batch using the authenticated actor', async () => {
      const dto = { items: [{ detailId: 1, actualQty: 95 }] };
      const mockResult = { success: true, data: [{ Id: 1 }] };
      service.batchUpdateActualStock.mockResolvedValue(mockResult);

      const result = await controller.batchUpdateActualStock(
        '123',
        dto,
        mockUser,
      );

      expect(result).toEqual(mockResult);
      expect(service.batchUpdateActualStock).toHaveBeenCalledWith(
        '123',
        dto,
        mockUser.username,
      );
    });
  });

  describe('OCR preview', () => {
    it('should request an OCR preview and save the source document by default', async () => {
      const file = { originalname: 'sto.pdf' } as Express.Multer.File;
      const mockResult = { attachment: null, items: [] };
      service.previewOcr.mockResolvedValue(mockResult);

      const result = await controller.previewOcr(
        '123',
        file,
        undefined,
        mockUser,
      );

      expect(result).toEqual(mockResult);
      expect(service.previewOcr).toHaveBeenCalledWith(
        '123',
        file,
        true,
        mockUser.username,
      );
    });
  });

  describe('close', () => {
    it('should close inventory counting', async () => {
      const mockDto = {
        id: '123',
        confirmedCheck: true,
      };

      const mockResult = {
        success: true,
        processId: mockProcessId,
        data: {
          Id: '123',
          OpnameNumber: 'INV-001',
          Category: ItemCategory.MATERIAL,
          Status: OpnameStatus.COMPLETED,
          CreatedAt: new Date(),
          CreatedBy: 'testuser',
          Notes: null,
          StartedAt: new Date(),
          CompletedAt: new Date(),
          CompletedBy: 'testuser',
          Details: [],
          totalItems: 10,
          completedItems: 10,
        },
      };

      service.close.mockResolvedValue(mockResult);

      const result = await controller.close(mockDto, mockUser);

      expect(result).toEqual(mockResult);
      expect(service.close).toHaveBeenCalledWith(mockDto, mockUser.username);
    });

    it('should approve inventory counting via approve alias', async () => {
      const mockDto = {
        id: '123',
        confirmedCheck: true,
      };

      const mockResult = {
        success: true,
        processId: mockProcessId,
        data: {
          Id: '123',
          OpnameNumber: 'INV-001',
          Category: ItemCategory.MATERIAL,
          Status: OpnameStatus.COMPLETED,
          CreatedAt: new Date(),
          CreatedBy: 'testuser',
          Notes: null,
          StartedAt: new Date(),
          CompletedAt: new Date(),
          CompletedBy: 'testuser',
          Details: [],
          totalItems: 10,
          completedItems: 10,
        },
      };

      service.close.mockResolvedValue(mockResult);

      const result = await controller.approve(mockDto, mockUser);

      expect(result).toEqual(mockResult);
      expect(service.close).toHaveBeenCalledWith(mockDto, mockUser.username);
    });
  });

  describe('generateFinalReport', () => {
    it('should send the approved final report as an Excel attachment', async () => {
      const buffer = Buffer.from('final-report');
      const response = {
        set: jest.fn(),
        send: jest.fn(),
      };
      service.generateFinalReport.mockResolvedValue(buffer);

      await controller.generateFinalReport({ id: '123' }, response as never);

      expect(service.generateFinalReport).toHaveBeenCalledWith('123');
      expect(response.set).toHaveBeenCalledWith({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename=Inventory_Final_Report_123.xlsx',
        'Content-Length': buffer.length,
      });
      expect(response.send).toHaveBeenCalledWith(buffer);
    });
  });
});
