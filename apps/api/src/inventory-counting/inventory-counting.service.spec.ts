import { Test, TestingModule } from '@nestjs/testing';
import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InventoryCountingService } from './inventory-counting.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';
import { NasUploadService } from '../common/utils/nas-upload.service';
import { ItemCategory, OpnameStatus } from '../generated/prisma/enums';

describe('InventoryCountingService', () => {
  let service: InventoryCountingService;
  let prismaService: any;
  let logService: any;

  const mockLogProcess = {
    ProcessId: 'PR202506110000001',
    FunctionId: 'INV_COUNT_001',
    FunctionName: 'Test',
    ProcessStatus: 'SUCCESS',
    ProcessStart: new Date(),
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'test',
  };

  beforeEach(async () => {
    const mockPrismaService = {
      stockOpname: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      stockOpnameDetail: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        createMany: jest.fn(),
      },
      stockOpnameAttachment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      material: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      finishGood: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockLogProcessService = {
      startProcess: jest.fn().mockResolvedValue(mockLogProcess),
      addLog: jest.fn().mockResolvedValue({}),
      completeProcess: jest.fn().mockResolvedValue(undefined),
      resetCounter: jest.fn(),
    };

    const mockNasUploadService = {
      uploadFile: jest.fn(),
      downloadFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryCountingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LogProcessService, useValue: mockLogProcessService },
        { provide: NasUploadService, useValue: mockNasUploadService },
      ],
    }).compile();

    service = module.get<InventoryCountingService>(InventoryCountingService);
    prismaService = module.get(PrismaService);
    logService = module.get(LogProcessService);
    prismaService.$transaction.mockImplementation(
      (callback: (tx: typeof prismaService) => unknown) =>
        callback(prismaService),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      opnameNumber: 'INV-2025-001',
      category: ItemCategory.MATERIAL,
      notes: 'Test notes',
    };

    it('should create inventory counting successfully', async () => {
      const mockResult = {
        Id: '123',
        OpnameNumber: createDto.opnameNumber,
        Category: createDto.category,
        Status: OpnameStatus.DRAFT,
        CreatedAt: new Date(),
        CreatedBy: 'test',
        Notes: createDto.notes,
      };

      prismaService.stockOpname.findUnique.mockResolvedValue(null);
      prismaService.stockOpname.create.mockResolvedValue(mockResult);

      const result = await service.create(createDto, 'test');

      expect(result.success).toBe(true);
      expect(result.processId).toBe(mockLogProcess.ProcessId);
      expect(result.data.OpnameNumber).toBe(createDto.opnameNumber);
      expect(prismaService.stockOpname.create).toHaveBeenCalledWith({
        data: {
          OpnameNumber: createDto.opnameNumber,
          Category: createDto.category,
          Status: OpnameStatus.DRAFT,
          Notes: createDto.notes,
          Tolerance: 0,
          CreatedBy: 'test',
        },
      });
      expect(logService.startProcess).toHaveBeenCalled();
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
        'Inventory counting created successfully',
      );
    });

    it('should throw BadRequestException for duplicate opnameNumber', async () => {
      prismaService.stockOpname.findUnique.mockResolvedValue({
        Id: '123',
        OpnameNumber: createDto.opnameNumber,
      });

      await expect(service.create(createDto, 'test')).rejects.toThrow(
        BadRequestException,
      );
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'FAILED',
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated inventory counting list', async () => {
      const mockList = [
        {
          Id: '1',
          OpnameNumber: 'INV-001',
          Category: ItemCategory.MATERIAL,
          Status: OpnameStatus.DRAFT,
          CreatedAt: new Date(),
          CreatedBy: 'test',
          StartedAt: null,
          CompletedAt: null,
          CompletedBy: null,
          Notes: null,
          Details: [],
        },
      ];

      prismaService.stockOpname.count.mockResolvedValue(1);
      prismaService.stockOpname.findMany.mockResolvedValue(mockList);

      const result = await service.findAll({});

      expect(result.meta.totalItems).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].TotalItems).toBe(0);
      expect(result.data[0].CompletedItems).toBe(0);
    });

    it('should filter by status', async () => {
      prismaService.stockOpname.count.mockResolvedValue(0);
      prismaService.stockOpname.findMany.mockResolvedValue([]);

      await service.findAll({ status: OpnameStatus.IN_PROGRESS });

      expect(prismaService.stockOpname.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { Status: OpnameStatus.IN_PROGRESS },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return inventory counting with details', async () => {
      const mockResult = {
        Id: '123',
        OpnameNumber: 'INV-001',
        Category: ItemCategory.MATERIAL,
        Status: OpnameStatus.DRAFT,
        CreatedAt: new Date(),
        CreatedBy: 'test',
        StartedAt: null,
        CompletedAt: null,
        CompletedBy: null,
        Notes: null,
        Details: [
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
        ],
      };

      prismaService.stockOpname.findUnique.mockResolvedValue(mockResult);

      const result = await service.findOne('123');

      expect(result.Id).toBe('123');
      expect(result.TotalItems).toBe(1);
      expect(result.CompletedItems).toBe(0);
    });

    it('should throw NotFoundException when not found', async () => {
      prismaService.stockOpname.findUnique.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update notes successfully', async () => {
      const mockExisting = {
        Id: '123',
        OpnameNumber: 'INV-001',
        Status: OpnameStatus.DRAFT,
      };

      const mockUpdated = {
        ...mockExisting,
        Notes: 'Updated notes',
      };

      prismaService.stockOpname.findUnique.mockResolvedValue(mockExisting);
      prismaService.stockOpname.update.mockResolvedValue(mockUpdated);

      const result = await service.update(
        '123',
        { notes: 'Updated notes' },
        'test',
      );

      expect(result.success).toBe(true);
      expect(result.data.Notes).toBe('Updated notes');
    });

    it('should throw NotFoundException when not found', async () => {
      prismaService.stockOpname.findUnique.mockResolvedValue(null);

      await expect(
        service.update('999', { notes: 'test' }, 'test'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete DRAFT inventory counting', async () => {
      const mockExisting = {
        Id: '123',
        OpnameNumber: 'INV-001',
        Status: OpnameStatus.DRAFT,
        _count: { Details: 0 },
      };

      prismaService.stockOpname.findUnique.mockResolvedValue(mockExisting);
      prismaService.stockOpname.delete.mockResolvedValue(mockExisting);

      const result = await service.remove('123');

      expect(result.success).toBe(true);
      expect(prismaService.stockOpname.delete).toHaveBeenCalledWith({
        where: { Id: '123' },
      });
    });

    it('should throw BadRequestException when deleting non-DRAFT', async () => {
      const mockExisting = {
        Id: '123',
        OpnameNumber: 'INV-001',
        Status: OpnameStatus.COMPLETED,
        _count: { Details: 0 },
      };

      prismaService.stockOpname.findUnique.mockResolvedValue(mockExisting);

      await expect(service.remove('123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('start', () => {
    it('should start DRAFT inventory counting', async () => {
      const mockExisting = {
        Id: '123',
        OpnameNumber: 'INV-001',
        Status: OpnameStatus.DRAFT,
        Category: ItemCategory.MATERIAL,
        Details: [],
      };

      const mockStarted = {
        ...mockExisting,
        Status: OpnameStatus.IN_PROGRESS,
        StartedAt: new Date(),
      };

      const mockMaterials = [{ PartNumber: 'MAT-001', PartName: 'Material 1' }];

      prismaService.stockOpname.findUnique
        .mockResolvedValueOnce(mockExisting) // First call in start method
        .mockResolvedValueOnce(mockStarted); // Second call in findOne (return from start)

      prismaService.material.findMany.mockResolvedValue(mockMaterials);
      prismaService.stockOpnameDetail.createMany.mockResolvedValue({
        count: 1,
      });
      prismaService.stockOpnameDetail.findMany.mockResolvedValue([
        { Id: 1, MaterialId: 'MAT-001', Location: 'WAREHOUSE' },
      ]);

      prismaService.$transaction.mockImplementation((callback: any) => {
        const tx = {
          material: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ QtyWarehouse: 50, QtyRack: 100 }),
          },
          finishGood: {
            findUnique: jest.fn(),
          },
          stockOpnameDetail: {
            update: jest.fn().mockResolvedValue({}),
          },
          stockOpname: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            update: jest.fn().mockResolvedValue(mockStarted),
          },
        };
        return callback(tx);
      });

      const result = await service.start('123', 'test');

      expect(result.success).toBe(true);
      expect(result.data.Status).toBe(OpnameStatus.IN_PROGRESS);
    });

    it('should throw BadRequestException when starting non-DRAFT', async () => {
      const mockExisting = {
        Id: '123',
        OpnameNumber: 'INV-001',
        Status: OpnameStatus.COMPLETED,
        Category: ItemCategory.MATERIAL,
        Details: [],
      };

      prismaService.stockOpname.findUnique.mockResolvedValue(mockExisting);

      await expect(service.start('123', 'test')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('generateCutOff', () => {
    it('should generate cut-off items for MATERIAL', async () => {
      const mockExisting = {
        Id: '123',
        OpnameNumber: 'INV-001',
        Status: OpnameStatus.DRAFT,
        Details: [],
      };

      const mockMaterials = [
        {
          PartNumber: 'MAT-001',
          PartName: 'Material 1',
          QtyRack: 100,
          QtyWarehouse: 50,
        },
        {
          PartNumber: 'MAT-002',
          PartName: 'Material 2',
          QtyRack: 200,
          QtyWarehouse: 0,
        },
      ];

      prismaService.stockOpname.findUnique.mockResolvedValue(mockExisting);
      prismaService.material.findMany.mockResolvedValue(mockMaterials);
      prismaService.stockOpnameDetail.findMany.mockResolvedValue([]);
      prismaService.stockOpnameDetail.createMany.mockResolvedValue({
        count: 2,
      });
      prismaService.stockOpname.updateMany.mockResolvedValue({ count: 1 });
      prismaService.stockOpname.update.mockResolvedValue({
        ...mockExisting,
        Status: OpnameStatus.IN_PROGRESS,
      });

      const result = await service.generateCutOff(
        {
          inventoryCountingId: '123',
          itemCategory: 'MATERIAL',
          location: 'WAREHOUSE',
        },
        'test',
      );

      expect(result.success).toBe(true);
      expect(result.data.count).toBe(2);
      expect(prismaService.stockOpnameDetail.createMany).toHaveBeenCalled();
    });

    it('should reject cut-off generation for IN_PROGRESS counting', async () => {
      const mockExisting = {
        Id: '123',
        OpnameNumber: 'INV-001',
        Status: OpnameStatus.IN_PROGRESS,
        Details: [],
      };

      prismaService.stockOpname.findUnique.mockResolvedValue(mockExisting);

      await expect(
        service.generateCutOff(
          {
            inventoryCountingId: '123',
            itemCategory: 'FINISH_GOOD',
          },
          'test',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaService.stockOpnameDetail.createMany).not.toHaveBeenCalled();
    });
  });

  describe('updateActualStock', () => {
    it('should update actual stock and calculate diff', async () => {
      const mockDetail = {
        Id: 1,
        OpnameId: '123',
        MaterialId: 'MAT-001',
        FinishGoodId: null,
        Location: 'WAREHOUSE',
        SystemQty: 100,
        ActualQty: null,
        DiffQty: null,
        Notes: null,
        OpnameData: {
          Status: OpnameStatus.IN_PROGRESS,
        },
      };

      const mockUpdated = {
        ...mockDetail,
        ActualQty: 95,
        DiffQty: -5,
      };

      prismaService.stockOpnameDetail.findUnique.mockResolvedValue(mockDetail);
      prismaService.stockOpnameDetail.update.mockResolvedValue(mockUpdated);

      const result = await service.updateActualStock(
        '123',
        1,
        { actualQty: 95 },
        'test',
      );

      expect(result.success).toBe(true);
      expect(result.data.ActualQty).toBe(95);
      expect(result.data.DiffQty).toBe(-5);
    });

    it('should throw BadRequestException when parent is not IN_PROGRESS', async () => {
      const mockDetail = {
        Id: 1,
        OpnameId: '123',
        OpnameData: { Status: OpnameStatus.COMPLETED },
      };

      prismaService.stockOpnameDetail.findUnique.mockResolvedValue(mockDetail);

      await expect(
        service.updateActualStock('123', 1, { actualQty: 100 }, 'test'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a detail owned by another inventory counting', async () => {
      prismaService.stockOpnameDetail.findUnique.mockResolvedValue({
        Id: 1,
        OpnameId: 'another-opname',
        OpnameData: { Status: OpnameStatus.IN_PROGRESS },
      });

      await expect(
        service.updateActualStock('123', 1, { actualQty: 100 }, 'test'),
      ).rejects.toThrow(NotFoundException);
      expect(prismaService.stockOpnameDetail.update).not.toHaveBeenCalled();
    });
  });

  describe('batchUpdateActualStock', () => {
    it('should atomically update all count values and synchronize a material rack row', async () => {
      prismaService.stockOpname.findUnique.mockResolvedValue({
        Id: '123',
        Status: OpnameStatus.IN_PROGRESS,
      });
      prismaService.stockOpnameDetail.findMany.mockResolvedValue([
        {
          Id: 1,
          OpnameId: '123',
          MaterialId: 'MAT-001',
          Location: 'WAREHOUSE',
          SystemQty: 10,
          SystemQtyRack: 0,
          Notes: null,
        },
        {
          Id: 3,
          OpnameId: '123',
          MaterialId: null,
          Location: 'FINISH_GOOD_AREA',
          SystemQty: 20,
          SystemQtyRack: 0,
          Notes: null,
        },
      ]);
      prismaService.stockOpnameDetail.findFirst.mockResolvedValue({
        Id: 2,
        SystemQty: 4,
        SystemQtyRack: 4,
      });
      prismaService.stockOpnameDetail.update
        .mockResolvedValueOnce({ Id: 1, ActualQty: 9, DiffQty: -1 })
        .mockResolvedValueOnce({ Id: 2, ActualQty: 5, DiffQty: 1 })
        .mockResolvedValueOnce({ Id: 3, ActualQty: 22, DiffQty: 2 });

      const result = await service.batchUpdateActualStock(
        '123',
        {
          items: [
            { detailId: 1, actualQty: 9, actualQtyRack: 5 },
            { detailId: 3, actualQty: 22 },
          ],
        },
        'test',
      );

      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaService.stockOpnameDetail.update).toHaveBeenNthCalledWith(
        2,
        {
          where: { Id: 2 },
          data: {
            ActualQty: 5,
            ActualQtyRack: 5,
            DiffQty: 1,
            DiffQtyRack: 1,
          },
        },
      );
      expect(result.data).toHaveLength(2);
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should reject the whole batch when a detail does not belong to the counting', async () => {
      prismaService.stockOpname.findUnique.mockResolvedValue({
        Id: '123',
        Status: OpnameStatus.IN_PROGRESS,
      });
      prismaService.stockOpnameDetail.findMany.mockResolvedValue([]);

      await expect(
        service.batchUpdateActualStock(
          '123',
          { items: [{ detailId: 99, actualQty: 1 }] },
          'test',
        ),
      ).rejects.toThrow(NotFoundException);

      expect(prismaService.stockOpnameDetail.update).not.toHaveBeenCalled();
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'FAILED',
      );
    });

    it('should preserve the IN_PROGRESS status validation', async () => {
      prismaService.stockOpname.findUnique.mockResolvedValue({
        Id: '123',
        Status: OpnameStatus.COMPLETED,
      });

      await expect(
        service.batchUpdateActualStock(
          '123',
          { items: [{ detailId: 1, actualQty: 1 }] },
          'test',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaService.stockOpnameDetail.findMany).not.toHaveBeenCalled();
      expect(prismaService.stockOpnameDetail.update).not.toHaveBeenCalled();
    });
  });

  describe('audit attachments', () => {
    it('should return audit attachments for an existing inventory counting', async () => {
      prismaService.stockOpname.findUnique.mockResolvedValue({ Id: '123' });
      prismaService.stockOpnameAttachment.findMany.mockResolvedValue([
        {
          Id: 7,
          OriginalFileName: 'sto-rack.pdf',
          FileSize: 2048,
          MimeType: 'application/pdf',
          CreatedAt: new Date('2026-09-22T00:00:00.000Z'),
          CreatedBy: 'test',
        },
      ]);

      const result = await service.getAttachments('123');

      expect(result).toEqual([
        expect.objectContaining({ Id: 7, FileName: 'sto-rack.pdf' }),
      ]);
      expect(prismaService.stockOpnameAttachment.findMany).toHaveBeenCalledWith(
        {
          where: { OpnameId: '123' },
          orderBy: { CreatedAt: 'desc' },
        },
      );
    });
  });

  describe('OCR file validation', () => {
    it('should suggest a unique STO part number for a one-character OCR typo', () => {
      const items = service['buildOcrPreviewItems'](
        [
          {
            partNumber: 'DNM-MAT-001',
            location: 'RACK',
            actualQty: 12,
          },
        ],
        [
          {
            Id: 11,
            Location: 'RACK',
            MaterialId: 'DM-MAT-001',
            FinishGoodId: null,
          },
        ],
      );

      expect(items).toEqual([
        {
          partNumber: 'DNM-MAT-001',
          location: 'RACK',
          actualQty: 12,
          detailId: 11,
          matchedPartNumber: 'DM-MAT-001',
          status: 'SUGGESTED',
        },
      ]);
    });

    it('should not suggest a fuzzy match when two STO parts are equally close', () => {
      const items = service['buildOcrPreviewItems'](
        [
          {
            partNumber: 'DM-MAT-001',
            location: 'RACK',
            actualQty: 12,
          },
        ],
        [
          {
            Id: 11,
            Location: 'RACK',
            MaterialId: 'DN-MAT-001',
            FinishGoodId: null,
          },
          {
            Id: 12,
            Location: 'RACK',
            MaterialId: 'DX-MAT-001',
            FinishGoodId: null,
          },
        ],
      );

      expect(items[0]).toMatchObject({
        detailId: null,
        matchedPartNumber: null,
        status: 'NOT_FOUND',
      });
    });

    it('should reject a PDF larger than 5MB', () => {
      const buffer = Buffer.alloc(5 * 1024 * 1024 + 1);
      buffer.write('%PDF-1.7');
      const file = {
        originalname: 'worksheet.pdf',
        mimetype: 'application/pdf',
        buffer,
        size: buffer.length,
      } as Express.Multer.File;

      expect(() => service['validateOcrFile'](file)).toThrow(
        'PDF too large. Maximum size is 5MB.',
      );
    });

    it('should omit unsupported input-file detail and surface a safe provider rejection', async () => {
      const previousApiKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: 'invalid_request_error' } }),
            { status: 400 },
          ),
        );
      const file = {
        originalname: 'worksheet.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7'),
        size: 8,
      } as Express.Multer.File;

      try {
        await expect(service['extractOcrItems'](file)).rejects.toThrow(
          BadGatewayException,
        );
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const request = JSON.parse(
          fetchSpy.mock.calls[0][1]?.body as string,
        ) as {
          input: Array<{ content: Array<Record<string, unknown>> }>;
        };
        const inputFile = request.input[0].content[0];
        expect(inputFile).not.toHaveProperty('detail');
        expect(inputFile.file_data).toBe(
          `data:application/pdf;base64,${file.buffer.toString('base64')}`,
        );
      } finally {
        fetchSpy.mockRestore();
        if (previousApiKey === undefined) {
          delete process.env.OPENAI_API_KEY;
        } else {
          process.env.OPENAI_API_KEY = previousApiKey;
        }
      }
    });

    it('should read structured OCR JSON from the Responses REST output content', async () => {
      const previousApiKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            output: [
              {
                content: [
                  {
                    type: 'output_text',
                    text: JSON.stringify({
                      items: [
                        {
                          partNumber: 'MAT-001',
                          location: 'RACK',
                          actualQty: 12,
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      );
      const file = {
        originalname: 'worksheet.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7'),
        size: 8,
      } as Express.Multer.File;

      try {
        await expect(
          service['extractOcrItems'](file, [
            { partNumber: 'DM-MAT-001', location: 'RACK' },
          ]),
        ).resolves.toEqual([
          { partNumber: 'MAT-001', location: 'RACK', actualQty: 12 },
        ]);
        const request = JSON.parse(
          fetchSpy.mock.calls[0][1]?.body as string,
        ) as {
          input: Array<{ content: Array<{ text?: string }> }>;
        };
        expect(request.input[0].content[1].text).toContain('RACK: DM-MAT-001');
      } finally {
        fetchSpy.mockRestore();
        if (previousApiKey === undefined) {
          delete process.env.OPENAI_API_KEY;
        } else {
          process.env.OPENAI_API_KEY = previousApiKey;
        }
      }
    });
  });

  describe('applyOcrResults', () => {
    it('should apply a validated RACK result to both rack actual fields', async () => {
      prismaService.stockOpname.findUnique.mockResolvedValue({
        Id: '123',
        Status: OpnameStatus.IN_PROGRESS,
        Details: [
          {
            Id: 5,
            MaterialId: 'MAT-001',
            FinishGoodId: null,
            Location: 'RACK',
            SystemQty: 100,
            SystemQtyRack: 100,
          },
        ],
      });
      prismaService.stockOpnameDetail.update.mockResolvedValue({ Id: 5 });

      const result = await service.applyOcrResults(
        '123',
        {
          results: [
            {
              detailId: 5,
              partNumber: 'MAT-001',
              location: 'RACK',
              actualQty: 95,
            },
          ],
        },
        'test',
      );

      expect(result).toEqual({ success: true, updatedCount: 1 });
      expect(prismaService.stockOpnameDetail.update).toHaveBeenCalledWith({
        where: { Id: 5 },
        data: {
          ActualQty: 95,
          ActualQtyRack: 95,
          DiffQty: -5,
          DiffQtyRack: -5,
        },
      });
    });
  });

  describe('close', () => {
    it('should close inventory counting and adjust stock', async () => {
      const mockExisting = {
        Id: '123',
        OpnameNumber: 'INV-001',
        Status: OpnameStatus.IN_PROGRESS,
        Details: [
          {
            Id: 1,
            MaterialId: 'MAT-001',
            FinishGoodId: null,
            Location: 'RACK',
            SystemQty: 100,
            ActualQty: 95,
            DiffQty: -5,
          },
        ],
      };

      const mockMaterial = {
        PartNumber: 'MAT-001',
        QtyRack: 100,
        QtyWarehouse: 0,
      };

      const mockUpdatedOpname = {
        ...mockExisting,
        Status: OpnameStatus.COMPLETED,
        CompletedAt: new Date(),
        CompletedBy: 'test',
      };

      prismaService.stockOpname.findUnique
        .mockResolvedValueOnce(mockExisting)
        .mockResolvedValueOnce(mockUpdatedOpname);

      prismaService.$transaction.mockImplementation((callback: any) => {
        const tx = {
          material: {
            findUnique: jest.fn().mockResolvedValue(mockMaterial),
            update: jest
              .fn()
              .mockResolvedValue({ ...mockMaterial, QtyRack: 95 }),
          },
          stockOpname: {
            findUnique: jest.fn().mockResolvedValue(mockExisting),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            update: jest.fn().mockResolvedValue(mockUpdatedOpname),
          },
          stockOpnameDetail: {
            update: jest.fn().mockResolvedValue({}),
          },
          inventoryLedger: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return callback(tx);
      });

      const result = await service.close('123', 'test');

      expect(result.success).toBe(true);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when confirmedCheck is false', async () => {
      await expect(
        service.close({ id: '123', confirmedCheck: false }, 'test'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when items have null ActualQty', async () => {
      const mockExisting = {
        Id: '123',
        OpnameNumber: 'INV-001',
        Status: OpnameStatus.IN_PROGRESS,
        Details: [
          {
            Id: 1,
            MaterialId: 'MAT-001',
            ActualQty: null,
          },
        ],
      };

      prismaService.stockOpname.findUnique.mockResolvedValue(mockExisting);

      await expect(service.close('123', 'test')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject duplicate close without applying stock changes', async () => {
      prismaService.stockOpname.findUnique.mockResolvedValue({
        Id: '123',
        Status: OpnameStatus.COMPLETED,
        Category: ItemCategory.MATERIAL,
        Details: [],
      });

      await expect(service.close('123', 'test')).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaService.$transaction).not.toHaveBeenCalled();
      expect(prismaService.material.update).not.toHaveBeenCalled();
    });

    it('should roll back close when the conditional status update loses the race', async () => {
      const counting = {
        Id: '123',
        OpnameNumber: 'INV-001',
        Status: OpnameStatus.IN_PROGRESS,
        Category: ItemCategory.MATERIAL,
        Details: [],
      };
      prismaService.stockOpname.findUnique.mockResolvedValue(counting);
      prismaService.stockOpname.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.close('123', 'test')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancel', () => {
    it('should reject duplicate cancellation', async () => {
      prismaService.stockOpname.findUnique.mockResolvedValue({
        Id: '123',
        Status: OpnameStatus.CANCELLED,
        Category: ItemCategory.MATERIAL,
      });

      await expect(service.cancel('123', 'test')).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should roll back cancellation when the conditional update loses the race', async () => {
      prismaService.stockOpname.findUnique.mockResolvedValue({
        Id: '123',
        Status: OpnameStatus.IN_PROGRESS,
        Category: ItemCategory.MATERIAL,
      });
      prismaService.stockOpname.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.cancel('123', 'test')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('generateWorksheet', () => {
    it('should generate worksheet with printTitlesRow set to include table header row (1:18)', async () => {
      const mockOpname = {
        Id: '123',
        OpnameNumber: 'INV-001',
        Category: ItemCategory.MATERIAL,
        Status: OpnameStatus.IN_PROGRESS,
        CreatedAt: new Date(),
        CreatedBy: 'test',
        Details: [],
      };
      const mockDetails = [
        {
          Id: 1,
          OpnameId: '123',
          MaterialId: 'MAT-001',
          FinishGoodId: null,
          Location: 'RACK',
          SystemQty: 0,
          SystemQtyRack: 10,
          ActualQty: null,
          ActualQtyRack: null,
        },
      ];

      prismaService.stockOpname.findUnique.mockResolvedValue(mockOpname);
      prismaService.stockOpnameDetail.findMany.mockResolvedValue(mockDetails);
      prismaService.material.findMany.mockResolvedValue([
        { PartNumber: 'MAT-001', PartName: 'Bracket Part' },
      ]);
      prismaService.finishGood.findMany.mockResolvedValue([]);

      const buffer = await service.generateWorksheet('123');
      expect(buffer).toBeDefined();

      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.getWorksheet('RACK');
      expect(ws).toBeDefined();
      expect(ws.pageSetup.printTitlesRow).toBe('1:18');
      expect(ws.getRow(18).values).toContain('Rack System Qty');
      expect(ws.getRow(18).values).toContain('CHECK');
    });
  });

  describe('generateSnapshot', () => {
    it('should generate snapshot with printTitlesRow set to include table header row (1:14)', async () => {
      const mockOpname = {
        Id: '123',
        OpnameNumber: 'INV-001',
        Category: ItemCategory.MATERIAL,
        Status: OpnameStatus.IN_PROGRESS,
        CreatedAt: new Date(),
        CreatedBy: 'test',
        Details: [],
      };
      const mockDetails = [
        {
          Id: 1,
          OpnameId: '123',
          MaterialId: 'MAT-001',
          FinishGoodId: null,
          Location: 'RACK',
          SystemQty: 0,
          SystemQtyRack: 10,
          ActualQty: null,
          ActualQtyRack: null,
        },
      ];

      prismaService.stockOpname.findUnique.mockResolvedValue(mockOpname);
      prismaService.stockOpnameDetail.findMany.mockResolvedValue(mockDetails);
      prismaService.material.findMany.mockResolvedValue([
        { PartNumber: 'MAT-001', PartName: 'Bracket Part' },
      ]);
      prismaService.finishGood.findMany.mockResolvedValue([]);

      const buffer = await service.generateSnapshot('123');
      expect(buffer).toBeDefined();

      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.getWorksheet('Snapshot');
      expect(ws).toBeDefined();
      expect(ws.pageSetup.printTitlesRow).toBe('1:14');
      expect(ws.getRow(14).values).toContain('Rack Sys Qty');
    });
  });
});
