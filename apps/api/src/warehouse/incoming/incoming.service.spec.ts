import { Test, TestingModule } from '@nestjs/testing';
import { IncomingService } from './incoming.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NasUploadService } from '../../common/utils/nas-upload.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('IncomingService', () => {
  let service: IncomingService;
  let prismaService: any;
  let logService: any;
  let nasUploadService: any;

  const mockLogProcess = {
    ProcessId: 'PR20260607123456123456',
    FunctionId: 'INCOMING_001',
    FunctionName: 'IncomingService.Create',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'testuser',
  };

  const mockMaterial = {
    Id: 1,
    PartNumber: 'MAT-001',
    PartName: 'Test Material',
    QtyWarehouse: 100,
    IsActive: true,
  };

  beforeEach(async () => {
    prismaService = {
      incoming: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      incomingMaterial: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      material: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      inventoryLedger: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaService)),
    };

    logService = {
      startProcess: jest.fn().mockResolvedValue(mockLogProcess),
      addLog: jest.fn().mockResolvedValue({}),
      completeProcess: jest.fn().mockResolvedValue(undefined),
    };

    nasUploadService = {
      uploadFile: jest
        .fn()
        .mockResolvedValue('https://nas.example.com/file.pdf'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncomingService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LogProcessService, useValue: logService },
        { provide: NasUploadService, useValue: nasUploadService },
      ],
    }).compile();

    service = module.get<IncomingService>(IncomingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all incomings', async () => {
      const mockIncomings = [
        {
          Id: 'uuid-1',
          PoId: 'PO-001',
          SupplierId: 1,
          SupplierData: { Id: 1, Name: 'Test Supplier' },
          IncomingMaterial: [],
        },
      ];
      prismaService.incoming.findMany.mockResolvedValue(mockIncomings);

      const result = await service.findAll();

      expect(result).toEqual(mockIncomings);
      expect(prismaService.incoming.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an incoming by id', async () => {
      const mockIncoming = {
        Id: 'uuid-1',
        PoId: 'PO-001',
        SupplierId: 1,
        SupplierData: { Id: 1, Name: 'Test Supplier' },
        IncomingMaterial: [],
      };
      prismaService.incoming.findUnique.mockResolvedValue(mockIncoming);

      const result = await service.findOne('uuid-1');

      expect(result).toEqual(mockIncoming);
    });

    it('should throw NotFoundException when not found', async () => {
      prismaService.incoming.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create incoming successfully', async () => {
      const createDto = {
        poId: 'PO-NEW',
        supplierId: 1,
        receivedBy: 'admin',
        materials: [{ materialId: 1, qty: 50 }],
      };

      const createdIncoming = {
        Id: 'uuid-new',
        ...createDto,
        Closed: false,
      };

      prismaService.incoming.findFirst.mockResolvedValue(null);
      prismaService.material.findMany.mockResolvedValue([mockMaterial]);
      prismaService.incoming.create.mockResolvedValue(createdIncoming);
      prismaService.incomingMaterial.createMany.mockResolvedValue({ count: 1 });
      prismaService.material.update.mockResolvedValue({});
      prismaService.inventoryLedger.create.mockResolvedValue({});

      const result = await service.create(createDto, 'admin');

      expect(result).toEqual(createdIncoming);
      expect(prismaService.incoming.create).toHaveBeenCalled();
    });

    it('should throw error when material not found', async () => {
      const createDto = {
        poId: 'PO-NEW',
        supplierId: 1,
        receivedBy: 'admin',
        materials: [{ materialId: 999, qty: 50 }],
      };

      prismaService.material.findMany.mockResolvedValue([]);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('check', () => {
    const mockIncomingWithMaterials = {
      Id: 'uuid-1',
      PoId: 'PO-001',
      Closed: false,
      ApprovedAt: null,
      ApprovedBy: null,
      IncomingMaterial: [
        {
          Id: 1,
          MaterialId: 1,
          Qty: 100,
          QtyChecked: 0,
          MaterialData: { PartNumber: 'MAT-001' },
        },
        {
          Id: 2,
          MaterialId: 2,
          Qty: 50,
          QtyChecked: 0,
          MaterialData: { PartNumber: 'MAT-002' },
        },
      ],
    };

    it('should check incoming materials successfully', async () => {
      prismaService.incoming.findUnique.mockResolvedValue(
        mockIncomingWithMaterials,
      );
      prismaService.incomingMaterial.update.mockResolvedValue({});

      const checkDto = {
        materials: [
          { incomingMaterialId: 1, qtyChecked: 100 },
          { incomingMaterialId: 2, qtyChecked: 50 },
        ],
      };

      const result = await service.check('uuid-1', checkDto, 'checker');

      expect(result.status).toBe('CHECKED');
      expect(result.totalItems).toBe(2);
      expect(result.checkedBy).toBe('checker');
      expect(prismaService.incomingMaterial.update).toHaveBeenCalledTimes(2);
    });

    it('should throw error when incoming not found', async () => {
      prismaService.incoming.findUnique.mockResolvedValue(null);

      const checkDto = {
        materials: [{ incomingMaterialId: 1, qtyChecked: 100 }],
      };

      await expect(
        service.check('invalid-id', checkDto, 'checker'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error when incoming already received', async () => {
      const receivedIncoming = {
        ...mockIncomingWithMaterials,
        Closed: true,
        ApprovedAt: new Date(),
        ApprovedBy: 'receiver',
      };
      prismaService.incoming.findUnique.mockResolvedValue(receivedIncoming);

      const checkDto = {
        materials: [{ incomingMaterialId: 1, qtyChecked: 100 }],
      };

      await expect(
        service.check('uuid-1', checkDto, 'checker'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when incoming material id not found', async () => {
      prismaService.incoming.findUnique.mockResolvedValue(
        mockIncomingWithMaterials,
      );

      const checkDto = {
        materials: [{ incomingMaterialId: 999, qtyChecked: 100 }],
      };

      await expect(
        service.check('uuid-1', checkDto, 'checker'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('receive', () => {
    const mockIncomingForReceive = {
      Id: 'uuid-1',
      PoId: 'PO-001',
      Closed: false,
      ApprovedAt: null,
      ApprovedBy: null,
      IncomingMaterial: [
        {
          Id: 1,
          MaterialId: 1,
          Qty: 100,
          QtyChecked: 100, // Equal - can receive
          MaterialData: { PartNumber: 'MAT-001' },
        },
      ],
    };

    it('should receive incoming successfully when QtyChecked equals Qty', async () => {
      prismaService.incoming.findUnique.mockResolvedValue(
        mockIncomingForReceive,
      );
      prismaService.material.findUnique.mockResolvedValue({
        ...mockMaterial,
        QtyWarehouse: 100,
      });
      prismaService.incoming.update.mockResolvedValue({});
      prismaService.material.update.mockResolvedValue({});
      prismaService.inventoryLedger.create.mockResolvedValue({});

      const result = await service.receive('uuid-1', 'receiver');

      expect(result.status).toBe('APPROVED');
      expect(result.totalQty).toBe(100);
    });

    it('should throw error when incoming already received', async () => {
      const receivedIncoming = {
        ...mockIncomingForReceive,
        Closed: true,
        ApprovedAt: new Date(),
        ApprovedBy: 'receiver',
      };
      prismaService.incoming.findUnique.mockResolvedValue(receivedIncoming);

      await expect(service.receive('uuid-1', 'receiver')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when QtyChecked does not match Qty', async () => {
      const unmatchedIncoming = {
        Id: 'uuid-1',
        PoId: 'PO-001',
        Closed: false,
        ApprovedAt: null,
        ApprovedBy: null,
        IncomingMaterial: [
          {
            Id: 1,
            MaterialId: 1,
            Qty: 100,
            QtyChecked: 95, // Does NOT match!
            MaterialData: { PartNumber: 'MAT-001' },
          },
        ],
      };
      prismaService.incoming.findUnique.mockResolvedValue(unmatchedIncoming);

      await expect(service.receive('uuid-1', 'receiver')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when incoming not found', async () => {
      prismaService.incoming.findUnique.mockResolvedValue(null);

      await expect(service.receive('invalid-id', 'receiver')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
