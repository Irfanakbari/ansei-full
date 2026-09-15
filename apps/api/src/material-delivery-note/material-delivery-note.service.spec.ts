import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MaterialDeliveryNoteService } from './material-delivery-note.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';
import { SmtpService } from '../common/utils/smtp.service';
import { DeliveryNoteStatus } from '../generated/prisma/enums';

describe('MaterialDeliveryNoteService', () => {
  let service: MaterialDeliveryNoteService;
  let prismaService: any;
  let logService: any;

  const mockLogProcess = {
    ProcessId: 'PR20260611123456123456',
    FunctionId: 'MAT_DEL_001',
    FunctionName: 'createMaterialDeliveryNote',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'testuser',
  };

  const mockMaterial = {
    PartNumber: 'MAT-001',
    PartName: 'Test Material',
    QtyWarehouse: 500,
    QtyRack: 100,
    IsActive: true,
  };

  const mockDeliveryNote = {
    Id: 'uuid-1234',
    DeliveryNoteNum: 'SJ-MAT/2026/06/0001',
    Destination: 'Gudang Subcont A',
    Status: DeliveryNoteStatus.DRAFT,
    Notes: 'Transfer untuk produksi',
    CreatedAt: new Date(),
    CreatedBy: 'admin',
    ShippedAt: null,
    ShippedBy: null,
    ReceivedAt: null,
    ReceivedBy: null,
    Details: [
      {
        Id: 1,
        DeliveryNoteId: 'uuid-1234',
        MaterialId: 'MAT-001',
        QtyRequested: 100,
        QtyPicking: 0,
        QtyReceived: null,
        MaterialData: mockMaterial,
      },
    ],
  };

  beforeEach(async () => {
    prismaService = {
      materialDeliveryNote: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      materialDeliveryNoteDetail: {
        createMany: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      material: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      inventoryLedger: {
        createMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaService)),
    };

    logService = {
      startProcess: jest.fn().mockResolvedValue(mockLogProcess),
      addLog: jest.fn().mockResolvedValue({}),
      completeProcess: jest.fn().mockResolvedValue(undefined),
    };

    const smtpService = {
      sendEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaterialDeliveryNoteService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
        { provide: SmtpService, useValue: smtpService },
      ],
    }).compile();

    service = module.get<MaterialDeliveryNoteService>(
      MaterialDeliveryNoteService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated delivery notes', async () => {
      const mockData = [mockDeliveryNote];
      prismaService.materialDeliveryNote.findMany.mockResolvedValue(mockData);
      prismaService.materialDeliveryNote.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual(mockData);
      expect(result.meta.totalItems).toBe(1);
      expect(prismaService.materialDeliveryNote.findMany).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      const mockData = [mockDeliveryNote];
      prismaService.materialDeliveryNote.findMany.mockResolvedValue(mockData);
      prismaService.materialDeliveryNote.count.mockResolvedValue(1);

      const result = await service.findAll({
        page: 1,
        limit: 20,
        status: DeliveryNoteStatus.DRAFT,
      });

      expect(result.data).toEqual(mockData);
      expect(prismaService.materialDeliveryNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { Status: DeliveryNoteStatus.DRAFT },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a delivery note by id', async () => {
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(
        mockDeliveryNote,
      );

      const result = await service.findOne('uuid-1234');

      expect(result).toEqual(mockDeliveryNote);
    });

    it('should throw NotFoundException when not found', async () => {
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDetails', () => {
    it('should return delivery note details', async () => {
      const details = mockDeliveryNote.Details;
      prismaService.materialDeliveryNoteDetail.findMany.mockResolvedValue(
        details,
      );

      const result = await service.getDetails('uuid-1234');

      expect(result).toEqual(details);
    });
  });

  describe('create', () => {
    it('should create a delivery note successfully', async () => {
      const createDto = {
        destination: 'Gudang Subcont A',
        notes: 'Transfer untuk produksi',
        items: [{ materialId: 'MAT-001', qtyRequested: 100 }],
      };

      prismaService.material.findMany.mockResolvedValue([mockMaterial]);
      prismaService.materialDeliveryNote.findFirst.mockResolvedValue(null);
      prismaService.materialDeliveryNote.create.mockResolvedValue(
        mockDeliveryNote,
      );
      prismaService.materialDeliveryNoteDetail.createMany.mockResolvedValue({
        count: 1,
      });

      // Mock findOne for return
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(
        mockDeliveryNote,
      );

      const result = await service.create(createDto, 'admin');

      expect(result).toEqual(mockDeliveryNote);
      expect(prismaService.materialDeliveryNote.create).toHaveBeenCalled();
      expect(
        prismaService.materialDeliveryNoteDetail.createMany,
      ).toHaveBeenCalled();
    });

    it('should throw NotFoundException when material not found', async () => {
      const createDto = {
        destination: 'Gudang Subcont A',
        notes: 'Transfer',
        items: [{ materialId: 'INVALID-MAT', qtyRequested: 100 }],
      };

      prismaService.material.findMany.mockResolvedValue([]);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update delivery note header (DRAFT only)', async () => {
      const updateDto = { destination: 'Gudang Subcont B', notes: 'Updated' };
      const updated = { ...mockDeliveryNote, ...updateDto };
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(
        mockDeliveryNote,
      );
      prismaService.materialDeliveryNote.update.mockResolvedValue(updated);
      // Mock findOne for return
      prismaService.materialDeliveryNote.findUnique
        .mockResolvedValueOnce(mockDeliveryNote) // First call for validation
        .mockResolvedValueOnce(updated); // Second call for return

      const result = await service.update('uuid-1234', updateDto, 'admin');

      expect(result).toEqual(updated);
    });

    it('should throw BadRequestException when not DRAFT', async () => {
      const shipped = {
        ...mockDeliveryNote,
        Status: DeliveryNoteStatus.SHIPPED,
      };
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(shipped);

      await expect(
        service.update('uuid-1234', { destination: 'New' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete delivery note (DRAFT only)', async () => {
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(
        mockDeliveryNote,
      );
      prismaService.materialDeliveryNote.delete.mockResolvedValue(
        mockDeliveryNote,
      );

      const result = await service.remove('uuid-1234');

      expect(result).toEqual({ deleted: true, id: 'uuid-1234' });
    });

    it('should throw BadRequestException when not DRAFT', async () => {
      const shipped = {
        ...mockDeliveryNote,
        Status: DeliveryNoteStatus.SHIPPED,
      };
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(shipped);

      await expect(service.remove('uuid-1234')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('pick', () => {
    it('should pick materials successfully', async () => {
      const pickDto = {
        items: [{ materialId: 'MAT-001', qtyPicking: 100 }],
      };
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(
        mockDeliveryNote,
      );
      prismaService.material.findUnique.mockResolvedValue(mockMaterial);
      prismaService.materialDeliveryNoteDetail.update.mockResolvedValue({
        ...mockDeliveryNote.Details[0],
        QtyPicking: 100,
      });
      // Mock findOne for return
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue({
        ...mockDeliveryNote,
        Details: [{ ...mockDeliveryNote.Details[0], QtyPicking: 100 }],
      });

      const result = await service.pick('uuid-1234', pickDto, 'operator');

      expect(
        prismaService.materialDeliveryNoteDetail.update,
      ).toHaveBeenCalled();
    });

    it('should throw BadRequestException when not DRAFT', async () => {
      const shipped = {
        ...mockDeliveryNote,
        Status: DeliveryNoteStatus.SHIPPED,
      };
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(shipped);

      await expect(
        service.pick('uuid-1234', { items: [] }, 'operator'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when QtyPicking > QtyRequested', async () => {
      const pickDto = {
        items: [{ materialId: 'MAT-001', qtyPicking: 200 }], // More than requested
      };
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(
        mockDeliveryNote,
      );

      await expect(
        service.pick('uuid-1234', pickDto, 'operator'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when stock insufficient', async () => {
      const pickDto = {
        items: [{ materialId: 'MAT-001', qtyPicking: 1000 }], // More than stock
      };
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(
        mockDeliveryNote,
      );
      prismaService.material.findUnique.mockResolvedValue({
        ...mockMaterial,
        QtyWarehouse: 500,
      });

      await expect(
        service.pick('uuid-1234', pickDto, 'operator'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('ship', () => {
    it('should ship delivery note and cut stock', async () => {
      const draftFullyPicked = {
        Id: 'uuid-1234',
        DeliveryNoteNum: 'SJ-MAT/2026/06/0001',
        Destination: 'Gudang Subcont A',
        Status: DeliveryNoteStatus.DRAFT, // Must be DRAFT to ship
        Notes: 'Transfer untuk produksi',
        CreatedAt: new Date(),
        CreatedBy: 'admin',
        ShippedAt: null,
        ShippedBy: null,
        ReceivedAt: null,
        ReceivedBy: null,
        Details: [
          {
            Id: 1,
            DeliveryNoteId: 'uuid-1234',
            MaterialId: 'MAT-001',
            QtyRequested: 100,
            QtyPicking: 100, // Fully picked
            QtyReceived: null,
            MaterialData: mockMaterial,
          },
        ],
      };

      const shippedResult = {
        ...draftFullyPicked,
        Status: DeliveryNoteStatus.SHIPPED,
      };

      // First call returns DRAFT for validation, second returns SHIPPED for findOne
      prismaService.materialDeliveryNote.findUnique
        .mockResolvedValueOnce(draftFullyPicked)
        .mockResolvedValueOnce(shippedResult);
      prismaService.material.findUnique.mockResolvedValue({
        ...mockMaterial,
        QtyWarehouse: 500,
      });
      prismaService.material.update.mockResolvedValue({});
      prismaService.inventoryLedger.createMany.mockResolvedValue({ count: 1 });
      prismaService.materialDeliveryNote.update.mockResolvedValue(
        shippedResult,
      );

      const result = await service.ship('uuid-1234', 'admin');

      expect(prismaService.material.update).toHaveBeenCalled();
      expect(prismaService.inventoryLedger.createMany).toHaveBeenCalled();
    });

    it('should throw BadRequestException when not fully picked', async () => {
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(
        mockDeliveryNote,
      ); // QtyPicking = 0

      await expect(service.ship('uuid-1234', 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when not DRAFT', async () => {
      const shipped = {
        ...mockDeliveryNote,
        Status: DeliveryNoteStatus.SHIPPED,
      };
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(shipped);

      await expect(service.ship('uuid-1234', 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('receive', () => {
    it('should confirm receipt', async () => {
      const shipped = {
        ...mockDeliveryNote,
        Status: DeliveryNoteStatus.SHIPPED,
        ShippedAt: new Date(),
      };

      const receivedResult = {
        ...shipped,
        Status: DeliveryNoteStatus.RECEIVED,
        ReceivedAt: new Date(),
      };

      // First call returns SHIPPED for validation, second returns RECEIVED for findOne
      prismaService.materialDeliveryNote.findUnique
        .mockResolvedValueOnce(shipped)
        .mockResolvedValueOnce(receivedResult);
      prismaService.materialDeliveryNote.update.mockResolvedValue(
        receivedResult,
      );

      const result = await service.receive('uuid-1234', 'receiver');

      expect(result).toBeDefined();
      expect(prismaService.materialDeliveryNote.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException when not SHIPPED', async () => {
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(
        mockDeliveryNote,
      );

      await expect(service.receive('uuid-1234', 'receiver')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel delivery note', async () => {
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(
        mockDeliveryNote,
      );
      prismaService.materialDeliveryNote.update.mockResolvedValue({
        ...mockDeliveryNote,
        Status: DeliveryNoteStatus.CANCELLED,
      });

      const result = await service.cancel('uuid-1234', 'admin');

      expect(result).toEqual({ cancelled: true, id: 'uuid-1234' });
    });

    it('should throw BadRequestException when not DRAFT', async () => {
      const shipped = {
        ...mockDeliveryNote,
        Status: DeliveryNoteStatus.SHIPPED,
      };
      prismaService.materialDeliveryNote.findUnique.mockResolvedValue(shipped);

      await expect(service.cancel('uuid-1234', 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
