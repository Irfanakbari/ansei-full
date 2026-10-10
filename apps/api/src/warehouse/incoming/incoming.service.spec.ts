import { Test, TestingModule } from '@nestjs/testing';
import { IncomingService } from './incoming.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NasUploadService } from '../../common/utils/nas-upload.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { auditContext } from '../../common/helpers/audit-context.helper';
import { commandFingerprint } from '../../common/helpers/business-command.helper';

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
    SupplierId: 1,
  };

  beforeEach(async () => {
    prismaService = {
      incoming: {
        count: jest.fn(),
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
        findMany: jest.fn().mockResolvedValue([]),
      },
      sapTransaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      businessCommand: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      actionAuditEvent: {
        create: jest.fn(),
      },
      $executeRaw: jest.fn(),
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

  describe('supplier boundary', () => {
    const dto = {
      poId: 'PO-TEST',
      supplierId: 1,
      receivedBy: 'tester',
      materials: [
        { materialId: 1, qty: 5 },
        { materialId: 2, qty: 5 },
      ],
    };
    const openIncoming = {
      Id: 'incoming-1',
      PoId: 'PO-TEST',
      SupplierId: 1,
      Closed: false,
      ApprovedAt: null,
      IncomingMaterial: [
        {
          Id: 1,
          MaterialId: 1,
          Qty: 5,
          QtyChecked: 5,
          MaterialData: { ...mockMaterial, SupplierId: 2 },
        },
      ],
    };

    it.each([2, null])(
      'rejects creation with material supplier %s before any header is saved',
      async (supplierId) => {
        prismaService.material.findMany.mockResolvedValue([
          mockMaterial,
          { ...mockMaterial, Id: 2, SupplierId: supplierId },
        ]);
        await expect(service.create(dto, 'tester')).rejects.toThrow(
          'All materials must belong',
        );
        expect(prismaService.incoming.create).not.toHaveBeenCalled();
        expect(
          prismaService.incomingMaterial.createMany,
        ).not.toHaveBeenCalled();
      },
    );

    it('accepts multiple materials from the header supplier', async () => {
      prismaService.material.findMany.mockResolvedValue([
        mockMaterial,
        { ...mockMaterial, Id: 2 },
      ]);
      prismaService.incoming.create.mockResolvedValue({ Id: 'new' });
      await expect(service.create(dto, 'tester')).resolves.toEqual({
        Id: 'new',
      });
      expect(prismaService.incomingMaterial.createMany).toHaveBeenCalledWith({
        data: [
          { IncomingId: 'new', MaterialId: 1, Qty: 5, QtyChecked: 0 },
          { IncomingId: 'new', MaterialId: 2, Qty: 5, QtyChecked: 0 },
        ],
      });
    });

    it('rejects changing only the header supplier when retained materials do not match', async () => {
      prismaService.incoming.findUnique.mockResolvedValue(openIncoming);
      prismaService.material.findMany.mockResolvedValue([mockMaterial]);
      await expect(
        service.update('incoming-1', { supplierId: 2 }, 'tester'),
      ).rejects.toThrow('All materials must belong');
      expect(prismaService.incoming.update).not.toHaveBeenCalled();
      expect(prismaService.incomingMaterial.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects replacing materials with a different supplier without changing the header', async () => {
      prismaService.incoming.findUnique.mockResolvedValue(openIncoming);
      prismaService.material.findMany.mockResolvedValue([
        { ...mockMaterial, SupplierId: 2 },
      ]);
      await expect(
        service.update(
          'incoming-1',
          { materials: [{ materialId: 1, qty: 5 }] },
          'tester',
        ),
      ).rejects.toThrow('All materials must belong');
      expect(prismaService.incoming.update).not.toHaveBeenCalled();
    });

    it('allows changing header and all materials to the same supplier together', async () => {
      prismaService.incoming.findUnique.mockResolvedValue(openIncoming);
      prismaService.material.findMany.mockResolvedValue([
        { ...mockMaterial, SupplierId: 2 },
      ]);
      prismaService.incoming.update.mockResolvedValue({
        ...openIncoming,
        SupplierId: 2,
      });
      await expect(
        service.update(
          'incoming-1',
          { supplierId: 2, materials: [{ materialId: 1, qty: 5 }] },
          'tester',
        ),
      ).resolves.toMatchObject({ SupplierId: 2 });
      expect(prismaService.incomingMaterial.createMany).toHaveBeenCalled();
    });

    it('rejects checking existing mixed-supplier records without updating quantities', async () => {
      prismaService.incoming.findUnique.mockResolvedValue(openIncoming);
      await expect(
        service.check(
          'incoming-1',
          { materials: [{ incomingMaterialId: 1, qtyChecked: 5 }] },
          'tester',
        ),
      ).rejects.toThrow('All materials must belong');
      expect(prismaService.incomingMaterial.update).not.toHaveBeenCalled();
    });

    it.each([openIncoming.IncomingMaterial[0].MaterialData, null])(
      'rejects receipt of mismatched or missing material before stock and SAP capture',
      async (material) => {
        prismaService.incoming.findUnique.mockResolvedValue({
          ...openIncoming,
          IncomingMaterial: [
            { ...openIncoming.IncomingMaterial[0], MaterialData: material },
          ],
        });
        await expect(service.receive('incoming-1', 'tester')).rejects.toThrow(
          'All materials must belong',
        );
        expect(prismaService.incoming.update).not.toHaveBeenCalled();
        expect(prismaService.inventoryLedger.create).not.toHaveBeenCalled();
        expect(prismaService.material.update).not.toHaveBeenCalled();
      },
    );
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
      prismaService.incoming.count.mockResolvedValue(1);
      prismaService.incoming.findMany.mockResolvedValue(mockIncomings);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].Id).toBe('uuid-1');
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

      expect(result).toEqual({
        ...mockIncoming,
        SAPIntegration: { status: 'NOT_CAPTURED', events: [] },
        SAPDocuments: [],
      });
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
      SupplierId: 1,
      Closed: false,
      ApprovedAt: null,
      ApprovedBy: null,
      IncomingMaterial: [
        {
          Id: 1,
          MaterialId: 1,
          Qty: 100,
          QtyChecked: 0,
          MaterialData: { PartNumber: 'MAT-001', SupplierId: 1 },
        },
        {
          Id: 2,
          MaterialId: 2,
          Qty: 50,
          QtyChecked: 0,
          MaterialData: { PartNumber: 'MAT-002', SupplierId: 1 },
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
      SupplierId: 1,
      Closed: false,
      ApprovedAt: null,
      ApprovedBy: null,
      IncomingMaterial: [
        {
          Id: 1,
          MaterialId: 1,
          Qty: 100,
          QtyChecked: 100, // Equal - can receive
          MaterialData: { PartNumber: 'MAT-001', SupplierId: 1 },
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

    it('replays the committed command when status changes after the fast lookup', async () => {
      const requestId = '7850b873-3cf3-498b-9c65-e8d66e58a587';
      const result = {
        id: 'uuid-1',
        poId: 'PO-001',
        status: 'APPROVED',
        totalItems: 1,
        totalQty: 100,
        inventoryUpdated: true,
      };
      prismaService.businessCommand.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          Id: 'command-1',
          Scope: 'INCOMING_RECEIVE',
          RequestId: requestId,
          Fingerprint: commandFingerprint({ id: 'uuid-1' }),
          Actor: 'receiver',
          Result: result,
        });
      prismaService.incoming.findUnique.mockResolvedValue({
        ...mockIncomingForReceive,
        Closed: true,
        ApprovedAt: new Date(),
      });

      await expect(
        auditContext.run(
          {
            requestId: 'http-request',
            idempotencyKey: requestId,
            processId: mockLogProcess.ProcessId,
            actor: 'receiver',
          },
          () => service.receive('uuid-1', 'receiver'),
        ),
      ).resolves.toEqual(result);
      expect(prismaService.inventoryLedger.create).not.toHaveBeenCalled();
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
