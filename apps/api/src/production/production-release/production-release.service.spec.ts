// Snapshot transaction invariants are exercised against PostgreSQL in phase-one.database.spec.ts.
jest.mock('../../common/helpers/bom-snapshot.helper', () => ({
  snapshotRelease: jest.fn().mockResolvedValue(undefined),
  latestSnapshot: () => Promise.resolve(null),
}));
import { Test, TestingModule } from '@nestjs/testing';
import { ProductionReleaseService } from './production-release.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NasUploadService } from '../../common/utils/nas-upload.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ProductionStatus } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';
import { snapshotRelease } from '../../common/helpers/bom-snapshot.helper';

describe('ProductionReleaseService', () => {
  let service: ProductionReleaseService;
  let prismaService: any;
  let logService: any;
  let nasUploadService: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaService = {
      productionTraceEvent: { createMany: jest.fn() },
      $executeRaw: jest.fn(),
      assemblySession: { count: jest.fn().mockResolvedValue(0) },
      productionRelease: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      productionOrder: {
        count: jest.fn(),
        aggregate: jest.fn(),
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
        deleteMany: jest.fn(),
      },
      boxQTY: {
        findUnique: jest.fn(),
      },
      deliveryHistory: {
        findMany: jest.fn(),
      },
      inventoryLedger: {
        findFirst: jest.fn(),
      },
      stockOpname: {
        findFirst: jest.fn(),
      },
      productionReleaseAttachment: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prismaService.productionDemand = {
      updateMany: prismaService.productionOrder.updateMany,
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
    prismaService.$transaction.mockImplementation((callback) =>
      callback(prismaService),
    );
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

    it('aggregates actual stages and includes assembly only when required', async () => {
      prismaService.productionRelease.findMany.mockResolvedValue([
        {
          Id: 'rel-1',
          Status: 'RELEASED',
          Forecasts: [
            {
              PoId: 'PO-001',
              FinishGoodId: 'FG-001',
              Qty: 1,
              Shopping: [{ QtyPick: 3 }],
            },
          ],
          _count: { LabelDatas: 3, Forecasts: 1, Attachments: 0 },
        },
      ]);
      prismaService.productionRelease.count.mockResolvedValue(1);
      prismaService.billOfMaterials.findMany.mockResolvedValue([]);
      prismaService.finishGood.findMany.mockResolvedValue([]);
      prismaService.labelData.findMany.mockResolvedValue([
        {
          Id: 1,
          LabelNumber: 'L1',
          ProductionReleaseId: 'rel-1',
          Scanned: true,
          QtyThisBox: 1,
          RequiresAssembly: true,
          AssemblySessions: [{ Id: 'A1' }],
        },
        {
          Id: 2,
          LabelNumber: 'L2',
          ProductionReleaseId: 'rel-1',
          Scanned: false,
          QtyThisBox: 1,
          RequiresAssembly: true,
          AssemblySessions: [],
        },
        {
          Id: 3,
          LabelNumber: 'L3',
          ProductionReleaseId: 'rel-1',
          Scanned: false,
          QtyThisBox: 1,
          RequiresAssembly: false,
          AssemblySessions: [],
        },
      ]);
      prismaService.deliveryHistory.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data[0].progressAssembly).toEqual({
        required: true,
        total: 2,
        completed: 1,
        pending: 1,
        percentage: 50,
      });
      expect(result.data[0].progressOverall).toEqual({
        percentage: 21,
        stageCount: 4,
      });
    });

    it('preserves three-stage progress when assembly is not required', async () => {
      prismaService.productionRelease.findMany.mockResolvedValue([
        {
          Id: 'rel-1',
          Status: 'RELEASED',
          Forecasts: [],
          _count: { LabelDatas: 1, Forecasts: 0, Attachments: 0 },
        },
      ]);
      prismaService.productionRelease.count.mockResolvedValue(1);
      prismaService.billOfMaterials.findMany.mockResolvedValue([]);
      prismaService.finishGood.findMany.mockResolvedValue([]);
      prismaService.labelData.findMany.mockResolvedValue([
        {
          Id: 1,
          LabelNumber: 'L1',
          ProductionReleaseId: 'rel-1',
          Scanned: true,
          QtyThisBox: 1,
          RequiresAssembly: false,
          AssemblySessions: [],
        },
      ]);
      prismaService.deliveryHistory.findMany.mockResolvedValue([
        { LabelDataId: 'L1' },
      ]);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data[0].progressAssembly.required).toBe(false);
      expect(result.data[0].progressOverall).toEqual({
        percentage: 67,
        stageCount: 3,
      });
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
      prismaService.productionOrder.findMany.mockResolvedValue([{ Qty: 10 }]);
      prismaService.productionOrder.updateMany.mockResolvedValue({ count: 1 });
      prismaService.productionRelease.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockRelease);

      const result = await service.create(createDto, 'testuser');

      expect(prismaService.productionRelease.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ReleaseNumber: 'PR-2026-001',
          IsNoAttachment: true,
          TotalTargetQty: 10,
        }),
      });
      expect(prismaService.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'Serializable' },
      );
    });

    it('should throw ConflictException on duplicate manual release number pre-check', async () => {
      const createDto = {
        releaseNumber: 'PR-MANUAL-DUP',
        planDate: new Date('2026-06-10'),
        forecastIds: ['PO-001'],
      };

      logService.startProcess.mockResolvedValue({ ProcessId: 'PR1' });
      prismaService.productionRelease.findUnique.mockResolvedValue({
        Id: 'rel-existing',
      });

      await expect(service.create(createDto, 'testuser')).rejects.toThrow(
        ConflictException,
      );
      expect(prismaService.productionRelease.create).not.toHaveBeenCalled();
      expect(logService.completeProcess).toHaveBeenCalledWith('PR1', 'FAILED');
    });

    it('should generate release number using plan date when omitted', async () => {
      const createDto = {
        planDate: new Date('2026-09-21'),
        forecastIds: ['PO-001'],
      } as any;

      logService.startProcess.mockResolvedValue({ ProcessId: 'PR2' });
      prismaService.productionRelease.findFirst.mockResolvedValue({
        ReleaseNumber: 'PR-20260921-009',
      });
      prismaService.productionOrder.findMany.mockResolvedValue([
        { PoId: 'PO-001', Qty: 10 },
      ]);
      prismaService.productionOrder.updateMany.mockResolvedValue({ count: 1 });
      prismaService.productionRelease.create.mockResolvedValue({
        Id: 'rel-gen',
      });
      prismaService.productionRelease.findUnique.mockResolvedValue({
        ReleaseNumber: 'PR-20260921-010',
      });

      await service.create(createDto, 'testuser');

      expect(prismaService.productionRelease.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ReleaseNumber: 'PR-20260921-010',
          TotalTargetQty: 10,
        }),
      });
    });

    it('rolls back create semantics when forecast assignment changes', async () => {
      logService.startProcess.mockResolvedValue({ ProcessId: 'process-1' });
      prismaService.productionOrder.findMany.mockResolvedValue([
        { PoId: 'PO-001', Qty: 10 },
      ]);
      prismaService.productionRelease.create.mockResolvedValue({
        Id: 'rel-1',
        ReleaseNumber: 'PR-001',
      });
      prismaService.productionRelease.findUnique.mockResolvedValue(null);
      prismaService.productionOrder.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.create(
          {
            releaseNumber: 'PR-001',
            planDate: new Date('2026-06-10'),
            forecastIds: ['PO-001'],
          },
          'testuser',
        ),
      ).rejects.toThrow(ConflictException);

      expect(logService.completeProcess).toHaveBeenCalledWith(
        'process-1',
        'FAILED',
      );
      expect(prismaService.productionRelease.findUnique).toHaveBeenCalledWith({
        where: { ReleaseNumber: 'PR-001' },
        select: { Id: true },
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
      prismaService.productionOrder.findMany.mockResolvedValue([{ Qty: 10 }]);
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

    it('should reject CANCELLED through the generic update action', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue({
        ...existingRelease,
        Status: ProductionStatus.RELEASED,
      });

      await expect(
        service.update(
          'rel-1',
          { status: ProductionStatus.CANCELLED },
          'testuser',
        ),
      ).rejects.toThrow('dedicated cancel action');
      expect(prismaService.productionRelease.update).not.toHaveBeenCalled();
    });

    it('should reject direct forecast assignment changes after DRAFT', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue({
        ...existingRelease,
        Status: ProductionStatus.RELEASED,
      });

      await expect(
        service.update('rel-1', { forecastIds: ['PO-001'] }, 'testuser'),
      ).rejects.toThrow('Use Manage Forecasts');
      expect(prismaService.productionDemand.updateMany).not.toHaveBeenCalled();
    });

    it('should reject RELEASED when a linked finish good has no Box Qty', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(
        existingRelease,
      );
      prismaService.productionRelease.findFirst.mockResolvedValue(null);
      prismaService.productionOrder.findMany.mockResolvedValue([
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
      prismaService.productionOrder.findMany.mockResolvedValue([
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

    it('keeps labels and RELEASED transition in one transaction', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(
        existingRelease,
      );
      prismaService.productionOrder.findMany.mockResolvedValue([
        {
          PoId: 'PO-001',
          Qty: 10,
          FinishGoodId: 'FG-001',
          PartData: { PartName: 'Finish Good A', BoxQTY: { Qty: 6 } },
        },
      ]);
      prismaService.labelData.createMany.mockResolvedValue({ count: 2 });
      prismaService.productionRelease.update.mockResolvedValue({
        ...existingRelease,
        Status: ProductionStatus.RELEASED,
      });
      prismaService.productionRelease.findUnique
        .mockResolvedValueOnce(existingRelease)
        .mockResolvedValueOnce({
          ...existingRelease,
          Status: ProductionStatus.RELEASED,
          LabelDatas: [],
        });

      await service.update(
        'rel-1',
        { status: ProductionStatus.RELEASED },
        'testuser',
      );

      expect(prismaService.labelData.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ QtyThisBox: 6 }),
          expect.objectContaining({ QtyThisBox: 4 }),
        ]),
      });
      expect(prismaService.productionRelease.update).toHaveBeenCalledWith({
        where: { Id: 'rel-1' },
        data: expect.objectContaining({
          Status: ProductionStatus.RELEASED,
          TotalTargetQty: 10,
        }),
      });
    });

    it('names the active release and blocks the transition before any production writes', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(
        existingRelease,
      );
      prismaService.productionRelease.findFirst.mockResolvedValue({
        ReleaseNumber: 'PR-ACTIVE',
      });

      const error = await service
        .update('rel-1', { status: ProductionStatus.RELEASED }, 'testuser')
        .catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getStatus()).toBe(409);
      expect((error as ConflictException).message).toBe(
        'Cannot start production release PR-001 because PR-ACTIVE is still active. Only one release can be active at a time. Complete all production and deliveries for PR-ACTIVE, then mark it as COMPLETED before starting this release.',
      );
      expect(prismaService.productionRelease.findFirst).toHaveBeenCalledWith({
        where: { Status: ProductionStatus.RELEASED, Id: { not: 'rel-1' } },
        select: { ReleaseNumber: true },
      });
      expect(prismaService.productionDemand.updateMany).not.toHaveBeenCalled();
      expect(prismaService.labelData.createMany).not.toHaveBeenCalled();
      expect(snapshotRelease).not.toHaveBeenCalled();
      expect(prismaService.productionRelease.update).not.toHaveBeenCalled();
      expect(logService.completeProcess).toHaveBeenCalledWith(
        'PR123456',
        'FAILED',
      );
    });

    it.each([
      { target: 'ProductionRelease_one_released_key' },
      { target: ['ProductionRelease_one_released_key'] },
    ])(
      'explains the active-release database conflict for target %j',
      async ({ target }) => {
        prismaService.$transaction.mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('unique conflict', {
            code: 'P2002',
            clientVersion: '7.0.0',
            meta: { target },
          }),
        );

        await expect(
          service.update(
            'rel-1',
            { status: ProductionStatus.RELEASED },
            'testuser',
          ),
        ).rejects.toThrow(
          'Cannot start this production release because another release is still active. Only one release can be active at a time. Open Production Release and complete the active release before starting this one.',
        );
        expect(logService.completeProcess).toHaveBeenCalledWith(
          'PR123456',
          'FAILED',
        );
      },
    );

    const completedForecast = {
      PoId: 'PO-001',
      Qty: 100,
      FinishGoodId: 'FG-001',
      DeliveryHistory: [{ Qty: 100 }],
      LabelData: [
        {
          Scanned: true,
          QtyThisBox: 100,
          FinishGoodId: 'FG-001',
          ProductionReleaseId: 'rel-1',
          DeliveryHistory: { Qty: 100 },
        },
      ],
    };

    it.each([0, 40])(
      'rejects close when only %i units have been delivered despite full POKAYOKE',
      async (qty) => {
        prismaService.productionRelease.findUnique.mockResolvedValue({
          ...existingRelease,
          Status: ProductionStatus.RELEASED,
        });
        prismaService.productionOrder.findMany.mockResolvedValue([
          { ...completedForecast, DeliveryHistory: [{ Qty: qty }] },
        ]);
        await expect(
          service.update(
            'rel-1',
            { status: ProductionStatus.COMPLETED, isNoAttachment: true },
            'testuser',
          ),
        ).rejects.toThrow('Every forecast/PO');
        expect(prismaService.productionRelease.update).not.toHaveBeenCalled();
      },
    );

    it('rejects close when one PO is short even if another is overdelivered', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue({
        ...existingRelease,
        Status: ProductionStatus.RELEASED,
      });
      prismaService.productionOrder.findMany.mockResolvedValue([
        { ...completedForecast, DeliveryHistory: [{ Qty: 150 }] },
        {
          ...completedForecast,
          PoId: 'PO-002',
          DeliveryHistory: [{ Qty: 50 }],
        },
      ]);
      await expect(
        service.update(
          'rel-1',
          { status: ProductionStatus.COMPLETED },
          'testuser',
        ),
      ).rejects.toThrow('Every forecast/PO');
    });

    it.each([
      { ...completedForecast, LabelData: [] },
      {
        ...completedForecast,
        LabelData: [{ ...completedForecast.LabelData[0], Scanned: false }],
      },
      {
        ...completedForecast,
        LabelData: [
          { ...completedForecast.LabelData[0], DeliveryHistory: null },
        ],
      },
    ])('rejects close with incomplete label evidence', async (forecast) => {
      prismaService.productionRelease.findUnique.mockResolvedValue({
        ...existingRelease,
        Status: ProductionStatus.RELEASED,
      });
      prismaService.productionOrder.findMany.mockResolvedValue([forecast]);
      await expect(
        service.update(
          'rel-1',
          { status: ProductionStatus.COMPLETED },
          'testuser',
        ),
      ).rejects.toThrow('Every forecast/PO');
    });

    it('rejects closing while an assembly session is active', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue({
        ...existingRelease,
        Status: ProductionStatus.RELEASED,
        IsNoAttachment: true,
      });
      prismaService.productionOrder.findMany.mockResolvedValue([
        completedForecast,
      ]);
      prismaService.assemblySession.count.mockResolvedValue(1);
      await expect(
        service.update(
          'rel-1',
          { status: ProductionStatus.COMPLETED, totalProductionMinutes: 60 },
          'testuser',
        ),
      ).rejects.toThrow('active assembly');
      expect(prismaService.productionRelease.update).not.toHaveBeenCalled();
    });

    it('allows close after every PO and label has been delivered', async () => {
      const released = {
        ...existingRelease,
        Status: ProductionStatus.RELEASED,
        IsNoAttachment: true,
      };
      prismaService.productionRelease.findUnique.mockResolvedValue(released);
      prismaService.productionOrder.findMany.mockResolvedValue([
        completedForecast,
      ]);
      prismaService.productionRelease.update.mockResolvedValue({
        ...released,
        Status: ProductionStatus.COMPLETED,
      });
      await service.update(
        'rel-1',
        { status: ProductionStatus.COMPLETED, totalProductionMinutes: 1845 },
        'testuser',
      );
      expect(prismaService.productionRelease.update).toHaveBeenCalledWith({
        where: { Id: 'rel-1' },
        data: expect.objectContaining({
          Status: ProductionStatus.COMPLETED,
          TotalTargetQty: 100,
          TotalProductionMinutes: 1845,
        }),
      });
    });

    it('preserves the attachment requirement after complete delivery', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue({
        ...existingRelease,
        Status: ProductionStatus.RELEASED,
      });
      prismaService.productionOrder.findMany.mockResolvedValue([
        completedForecast,
      ]);
      prismaService.productionReleaseAttachment.count.mockResolvedValue(0);
      await expect(
        service.update(
          'rel-1',
          { status: ProductionStatus.COMPLETED },
          'testuser',
        ),
      ).rejects.toThrow('without an attachment');
    });

    it.each([undefined, null, 0, -1, 1.5, 2147483648, '480'])(
      'rejects invalid closing duration %s without closing',
      async (minutes) => {
        prismaService.productionRelease.findUnique.mockResolvedValue({
          ...existingRelease,
          Status: ProductionStatus.RELEASED,
          IsNoAttachment: true,
        });
        prismaService.productionOrder.findMany.mockResolvedValue([
          completedForecast,
        ]);
        await expect(
          service.update(
            'rel-1',
            {
              status: ProductionStatus.COMPLETED,
              totalProductionMinutes: minutes as number,
            },
            'testuser',
          ),
        ).rejects.toThrow('valid total production duration');
        expect(prismaService.productionRelease.update).not.toHaveBeenCalled();
      },
    );

    it.each([1, 1440, 1845, 2147483647])(
      'stores %s minutes with closure and returns the recorded duration',
      async (minutes) => {
        const released = {
          ...existingRelease,
          Status: ProductionStatus.RELEASED,
          IsNoAttachment: true,
        };
        const completed = {
          ...released,
          Status: ProductionStatus.COMPLETED,
          TotalProductionMinutes: minutes,
        };
        prismaService.productionRelease.findUnique
          .mockResolvedValueOnce(released)
          .mockResolvedValueOnce(completed);
        prismaService.productionOrder.findMany.mockResolvedValue([
          completedForecast,
        ]);
        prismaService.productionRelease.update.mockResolvedValue(completed);
        const result = await service.update(
          'rel-1',
          {
            status: ProductionStatus.COMPLETED,
            totalProductionMinutes: minutes,
          },
          'testuser',
        );
        expect(result.TotalProductionMinutes).toBe(minutes);
        expect(prismaService.productionRelease.update).toHaveBeenCalledWith({
          where: { Id: 'rel-1' },
          data: expect.objectContaining({
            Status: ProductionStatus.COMPLETED,
            TotalProductionMinutes: minutes,
          }),
        });
        expect(logService.addLog).toHaveBeenCalledWith(
          expect.objectContaining({
            client: prismaService,
            message: 'Production duration recorded with release closure.',
          }),
        );
      },
    );

    it.each([
      ProductionStatus.DRAFT,
      ProductionStatus.RELEASED,
      ProductionStatus.COMPLETED,
      ProductionStatus.CANCELLED,
    ])(
      'rejects recording duration on a %s release without a closing transition',
      async (status) => {
        prismaService.productionRelease.findUnique.mockResolvedValue({
          ...existingRelease,
          Status: status,
        });
        await expect(
          service.update('rel-1', { totalProductionMinutes: 480 }, 'testuser'),
        ).rejects.toThrow('only be recorded when closing');
        expect(prismaService.productionRelease.update).not.toHaveBeenCalled();
      },
    );

    it('preserves a closed release duration during a notes-only edit', async () => {
      const completed = {
        ...existingRelease,
        Status: ProductionStatus.COMPLETED,
        TotalProductionMinutes: 1845,
      };
      prismaService.productionRelease.findUnique.mockResolvedValue(completed);
      prismaService.productionOrder.findMany.mockResolvedValue([
        completedForecast,
      ]);
      prismaService.productionRelease.update.mockResolvedValue(completed);
      await service.update('rel-1', { notes: 'Updated note' }, 'testuser');
      const update = prismaService.productionRelease.update.mock.calls[0][0];
      expect(update.data).not.toHaveProperty('TotalProductionMinutes');
    });

    it.each([
      [ProductionStatus.DRAFT, ProductionStatus.COMPLETED],
      [ProductionStatus.RELEASED, ProductionStatus.DRAFT],
      [ProductionStatus.COMPLETED, ProductionStatus.DRAFT],
      [ProductionStatus.COMPLETED, ProductionStatus.RELEASED],
      [ProductionStatus.CANCELLED, ProductionStatus.DRAFT],
      [ProductionStatus.CANCELLED, ProductionStatus.RELEASED],
      [ProductionStatus.CANCELLED, ProductionStatus.COMPLETED],
    ])('rejects transition %s to %s', async (from, to) => {
      prismaService.productionRelease.findUnique.mockResolvedValue({
        ...existingRelease,
        Status: from,
      });
      await expect(
        service.update('rel-1', { status: to }, 'testuser'),
      ).rejects.toThrow('Cannot change status');
      expect(prismaService.productionRelease.update).not.toHaveBeenCalled();
    });

    it('rejects empty draft assignments', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(
        existingRelease,
      );
      await expect(
        service.update('rel-1', { forecastIds: [] }, 'testuser'),
      ).rejects.toThrow('Select at least one production order');
    });

    it('rejects closing an empty released production', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue({
        ...existingRelease,
        Status: ProductionStatus.RELEASED,
      });
      prismaService.productionOrder.findMany.mockResolvedValue([]);
      await expect(
        service.update(
          'rel-1',
          { status: ProductionStatus.COMPLETED, isNoAttachment: true },
          'testuser',
        ),
      ).rejects.toThrow('Every forecast/PO');
    });
  });

  describe('forecast candidates', () => {
    it.each([ProductionStatus.DRAFT, ProductionStatus.RELEASED])(
      'returns candidates for %s releases',
      async (status) => {
        prismaService.productionRelease.findUnique.mockResolvedValue({
          Status: status,
        });
        prismaService.productionOrder.count.mockResolvedValue(1);
        prismaService.productionOrder.findMany.mockResolvedValue([
          { PoId: 'PO-001' },
        ]);

        const result = await service.getForecastCandidates('rel-1', {
          mode: 'tag',
          page: 1,
          limit: 10,
        });

        expect(result.data).toEqual([{ PoId: 'PO-001' }]);
        expect(prismaService.productionOrder.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ ProductionReleaseId: null }),
          }),
        );
      },
    );
  });

  describe('cross-page selection snapshots', () => {
    it('returns every matching ID without pagination, using the same filters as the list', async () => {
      const query = {
        page: 3,
        limit: 10,
        mode: 'tag' as const,
        poNumber: 'PO-',
        partNumber: 'FG-',
        deliveryDate: '2026-10-07',
      };
      const rows = Array.from({ length: 25 }, (_, i) => ({ PoId: `PO-${i}` }));
      prismaService.productionOrder.findMany.mockResolvedValue(rows);
      prismaService.productionOrder.count.mockResolvedValue(25);
      const result = await service.getCandidateIds(query);
      const idsArgs = prismaService.productionOrder.findMany.mock.calls[0][0];
      expect(result).toEqual({
        demandIds: rows.map((row) => row.PoId),
        forecastIds: rows.map((row) => row.PoId),
        total: 25,
      });
      expect(idsArgs).not.toHaveProperty('skip');
      expect(idsArgs).not.toHaveProperty('take');
      expect(idsArgs.select).toEqual({ PoId: true });
      await service.getCreateCandidates(query);
      const listArgs = prismaService.productionOrder.findMany.mock.calls[1][0];
      expect(listArgs.where).toEqual(idsArgs.where);
      expect(listArgs.skip).toBe(20);
      expect(listArgs.take).toBe(10);
      expect(idsArgs.where.PoId.contains).toBe('PO-');
      expect(idsArgs.where.FinishGoodId.contains).toBe('FG-');
      expect(idsArgs.where.DeliveryDate.gte).toEqual(
        new Date('2026-10-07T00:00:00Z'),
      );
    });

    it('restricts untag snapshots to the selected release and excludes activity', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue({
        Status: 'RELEASED',
      });
      prismaService.productionOrder.findMany.mockResolvedValue([]);
      expect(
        await service.getCandidateIds(
          { page: 1, limit: 10, mode: 'untag' },
          'rel-1',
        ),
      ).toEqual({ demandIds: [], forecastIds: [], total: 0 });
      const args = prismaService.productionOrder.findMany.mock.calls[0][0];
      expect(args.where).toMatchObject({
        ProductionReleaseId: 'rel-1',
        Shopping: { none: {} },
        ProductionReport: { none: {} },
        DeliveryHistory: { none: {} },
        ProductionFindings: { none: {} },
      });
      expect(args.where.LabelData.none.OR).toContainEqual({
        AssemblySessions: { some: {} },
      });
      expect(args.where.LabelData.none.OR).toContainEqual({
        PokayokeHistory: { some: {} },
      });
    });

    it.each(['COMPLETED', 'CANCELLED'])(
      'rejects selection on a %s release',
      async (status) => {
        prismaService.productionRelease.findUnique.mockResolvedValue({
          Status: status,
        });
        await expect(
          service.getCandidateIds({ page: 1, limit: 10, mode: 'tag' }, 'rel-1'),
        ).rejects.toThrow(ConflictException);
        expect(prismaService.productionOrder.findMany).not.toHaveBeenCalled();
      },
    );
  });

  describe('forecast amendments', () => {
    const released = {
      Id: 'rel-1',
      ReleaseNumber: 'PR-001',
      Status: ProductionStatus.RELEASED,
    };
    const cleanForecast = {
      PoId: 'PO-001',
      Qty: 12,
      FinishGoodId: 'FG-001',
      ProductionReleaseId: null,
      PartData: { PartName: 'Part', BoxQTY: { Qty: 5 } },
      _count: { Shopping: 0, ProductionReport: 0, DeliveryHistory: 0 },
      LabelData: [],
    };

    beforeEach(() => {
      logService.startProcess.mockResolvedValue({ ProcessId: 'process-1' });
      prismaService.productionRelease.findUnique.mockResolvedValue(released);
    });

    it('tags a DRAFT forecast without labels or snapshots', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue({
        ...released,
        Status: ProductionStatus.DRAFT,
      });
      prismaService.productionOrder.findMany
        .mockResolvedValueOnce([cleanForecast])
        .mockResolvedValueOnce([]);
      prismaService.productionOrder.updateMany.mockResolvedValue({ count: 1 });
      prismaService.productionOrder.aggregate.mockResolvedValue({
        _sum: { Qty: 12 },
      });

      await service.tagForecasts(
        'rel-1',
        { forecastIds: ['PO-001'], reason: 'Draft planning' },
        'testuser',
      );

      expect(prismaService.productionDemand.updateMany).toHaveBeenCalledWith({
        where: { Id: { in: ['PO-001'] }, ProductionReleaseId: null },
        data: { ProductionReleaseId: 'rel-1' },
      });
      expect(prismaService.labelData.createMany).not.toHaveBeenCalled();
      expect(snapshotRelease).not.toHaveBeenCalled();
      expect(prismaService.productionRelease.update).toHaveBeenCalledWith({
        where: { Id: 'rel-1' },
        data: { TotalTargetQty: 12 },
      });
    });

    it('untags a DRAFT forecast without deleting labels', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue({
        ...released,
        Status: ProductionStatus.DRAFT,
      });
      prismaService.productionOrder.findMany
        .mockResolvedValueOnce([
          { ...cleanForecast, ProductionReleaseId: 'rel-1' },
        ])
        .mockResolvedValueOnce([]);
      prismaService.productionOrder.count.mockResolvedValue(2);
      prismaService.productionOrder.updateMany.mockResolvedValue({ count: 1 });
      prismaService.productionOrder.aggregate.mockResolvedValue({
        _sum: { Qty: 8 },
      });

      await service.untagForecasts(
        'rel-1',
        { forecastIds: ['PO-001'], reason: 'Draft planning' },
        'testuser',
      );

      expect(prismaService.labelData.deleteMany).not.toHaveBeenCalled();
      expect(prismaService.productionDemand.updateMany).toHaveBeenCalledWith({
        where: {
          Id: { in: ['PO-001'] },
          ProductionReleaseId: 'rel-1',
        },
        data: { ProductionReleaseId: null },
      });
      expect(prismaService.productionRelease.update).toHaveBeenCalledWith({
        where: { Id: 'rel-1' },
        data: { TotalTargetQty: 8 },
      });
    });

    it('tags clean RELEASED forecasts and creates complete labels atomically', async () => {
      prismaService.productionOrder.findMany
        .mockResolvedValueOnce([cleanForecast])
        .mockResolvedValueOnce([]);
      prismaService.productionOrder.updateMany.mockResolvedValue({ count: 1 });
      prismaService.productionOrder.aggregate.mockResolvedValue({
        _sum: { Qty: 12 },
      });
      prismaService.labelData.createMany.mockResolvedValue({ count: 3 });

      await service.tagForecasts(
        'rel-1',
        { forecastIds: ['PO-001'], reason: 'Schedule amendment' },
        'testuser',
      );

      expect(prismaService.labelData.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ QtyThisBox: 5 }),
          expect.objectContaining({ QtyThisBox: 2 }),
        ]),
      });
      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('blocks any Shopping row even when its quantity is zero', async () => {
      prismaService.productionOrder.findMany.mockResolvedValue([
        {
          ...cleanForecast,
          _count: { ...cleanForecast._count, Shopping: 1 },
        },
      ]);

      await expect(
        service.tagForecasts(
          'rel-1',
          { forecastIds: ['PO-001'], reason: 'Schedule amendment' },
          'testuser',
        ),
      ).rejects.toThrow('operational activity');
      expect(prismaService.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'Serializable' },
      );
      expect(prismaService.productionDemand.updateMany).not.toHaveBeenCalled();
      expect(prismaService.labelData.createMany).not.toHaveBeenCalled();
    });

    it('blocks failed pokayoke history', async () => {
      prismaService.productionOrder.findMany.mockResolvedValue([
        {
          ...cleanForecast,
          LabelData: [
            {
              Id: 1,
              Scanned: false,
              _count: { PokayokeHistory: 1 },
              DeliveryHistory: null,
            },
          ],
        },
      ]);

      await expect(
        service.tagForecasts(
          'rel-1',
          { forecastIds: ['PO-001'], reason: 'Schedule amendment' },
          'testuser',
        ),
      ).rejects.toThrow('operational activity');
    });

    it('rejects untagging every linked forecast and directs cancellation', async () => {
      prismaService.productionOrder.findMany.mockResolvedValue([
        { ...cleanForecast, ProductionReleaseId: 'rel-1' },
      ]);
      prismaService.productionOrder.count.mockResolvedValue(1);

      await expect(
        service.untagForecasts(
          'rel-1',
          { forecastIds: ['PO-001'], reason: 'Schedule amendment' },
          'testuser',
        ),
      ).rejects.toThrow('Cancel the production release instead');
    });

    it('rechecks activity inside the transaction before cancel mutations', async () => {
      prismaService.productionOrder.findMany
        .mockResolvedValueOnce([{ PoId: 'PO-001' }])
        .mockResolvedValueOnce([
          {
            ...cleanForecast,
            ProductionReleaseId: 'rel-1',
            _count: { ...cleanForecast._count, ProductionReport: 1 },
          },
        ]);

      await expect(
        service.cancel('rel-1', { reason: 'Schedule cancelled' }, 'testuser'),
      ).rejects.toThrow('operational activity');

      expect(prismaService.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'Serializable' },
      );
      expect(prismaService.labelData.deleteMany).not.toHaveBeenCalled();
      expect(prismaService.productionDemand.updateMany).not.toHaveBeenCalled();
      expect(prismaService.productionRelease.update).not.toHaveBeenCalled();
    });

    it('does not continue mutations or success audit when a transaction step fails', async () => {
      prismaService.productionOrder.findMany.mockResolvedValue([cleanForecast]);
      prismaService.productionOrder.updateMany.mockResolvedValue({ count: 1 });
      prismaService.labelData.createMany.mockRejectedValue(
        new Error('label insert failed'),
      );

      await expect(
        service.tagForecasts(
          'rel-1',
          { forecastIds: ['PO-001'], reason: 'Schedule amendment' },
          'testuser',
        ),
      ).rejects.toThrow('label insert failed');

      expect(prismaService.productionOrder.aggregate).not.toHaveBeenCalled();
      expect(prismaService.productionRelease.update).not.toHaveBeenCalled();
      expect(logService.addLog).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'INFO' }),
      );
      expect(logService.completeProcess).toHaveBeenCalledWith(
        'process-1',
        'FAILED',
      );
    });
  });

  describe('uploadAttachment', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024 * 1024, // 1MB
      buffer: Buffer.from('%PDF-1.7 test content'),
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
      prismaService.productionReleaseAttachment.create.mockResolvedValue({
        id: 1,
        FileName: 'test.pdf',
        FilePath: 'http://nas/file.pdf',
        ProductionReleaseId: 'rel-1',
      });

      const result = await service.uploadAttachment(
        { productionReleaseId: 'rel-1' },
        [mockFile],
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
          [invalidFile],
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
          [largeFile],
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
          [mockFile],
          'testuser',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject upload when production release not found', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadAttachment(
          { productionReleaseId: 'invalid-id' },
          [mockFile],
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
          [mockFile],
          'testuser',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should upload multiple attachments without updating forecasts', async () => {
      prismaService.productionRelease.findUnique.mockResolvedValue(mockRelease);
      nasUploadService.uploadFile.mockResolvedValue('http://nas/file.pdf');
      prismaService.productionReleaseAttachment.create.mockImplementation(
        ({ data }) =>
          Promise.resolve({
            id: 1,
            ...data,
            CreatedAt: new Date(),
            UpdatedAt: new Date(),
            UpdatedBy: null,
          }),
      );

      const result = await service.uploadAttachment(
        { productionReleaseId: 'rel-1' },
        [mockFile, mockFile],
        'testuser',
      );

      expect(result).toHaveLength(2);
      expect(
        prismaService.productionReleaseAttachment.create,
      ).toHaveBeenCalledTimes(2);
      expect(prismaService.productionDemand.updateMany).not.toHaveBeenCalled();
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
      prismaService.productionReleaseAttachment.findMany.mockResolvedValue(
        mockAttachments,
      );

      const result = await service.getAttachments('rel-1');

      expect(result).toHaveLength(2);
      expect(
        prismaService.productionReleaseAttachment.findMany,
      ).toHaveBeenCalledWith({
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

      prismaService.productionReleaseAttachment.findFirst.mockResolvedValue(
        mockAttachment,
      );
      nasUploadService.deleteFile.mockResolvedValue(undefined);
      prismaService.productionReleaseAttachment.delete.mockResolvedValue(
        mockAttachment,
      );

      prismaService.productionRelease.findUnique.mockResolvedValue({
        Status: ProductionStatus.RELEASED,
        IsNoAttachment: false,
      });
      const result = await service.deleteAttachment('rel-1', 1, 'testuser');

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

      prismaService.productionReleaseAttachment.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.deleteAttachment('rel-1', 999, 'testuser'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
