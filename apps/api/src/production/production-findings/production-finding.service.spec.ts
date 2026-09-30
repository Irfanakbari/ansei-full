import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import {
  PublicFindingOptionsQueryDto,
  PublicFinishGoodFindingContextQueryDto,
  SubmitMaterialFindingDto,
} from './production-finding.dto';
import { ProductionFindingService } from './production-finding.service';

const requestId = '11111111-1111-4111-8111-111111111111';

function createHarness(finding: Record<string, unknown>) {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    productionFinding: {
      findUnique: jest.fn().mockResolvedValue(finding),
      findFirst: jest.fn().mockResolvedValue(finding),
      update: jest.fn().mockResolvedValue(finding),
    },
    productionFindingEvent: { create: jest.fn().mockResolvedValue({}) },
    productionFindingAllocation: { create: jest.fn().mockResolvedValue({}) },
    productionTraceEvent: { create: jest.fn().mockResolvedValue({}) },
    shopping: { findUnique: jest.fn() },
    businessCommand: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ Id: 'command-1', Result: null }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
    productionFinding: {
      findUnique: jest.fn().mockResolvedValue(finding),
      findFirst: jest.fn().mockResolvedValue(finding),
    },
  };
  const logs = {
    startProcess: jest.fn().mockResolvedValue({ ProcessId: 'process-1' }),
    completeProcess: jest.fn().mockResolvedValue(undefined),
  };
  return { tx, prisma, logs };
}

describe('ProductionFindingService', () => {
  describe('public options', () => {
    function createOptionsService() {
      const prisma = {
        material: { findMany: jest.fn() },
        labelData: { findMany: jest.fn() },
      };
      const service = new ProductionFindingService(
        prisma as unknown as PrismaService,
        {} as LogProcessService,
      );
      return { prisma, service };
    }

    it('trims optional search and validates the bounded limit', async () => {
      const valid = plainToInstance(PublicFindingOptionsQueryDto, {
        search: '  PART  ',
      });
      const blank = plainToInstance(PublicFindingOptionsQueryDto, {
        search: '   ',
      });
      const oversizedSearch = plainToInstance(PublicFindingOptionsQueryDto, {
        search: 'X'.repeat(101),
      });
      const oversizedLimit = plainToInstance(PublicFindingOptionsQueryDto, {
        limit: 51,
      });

      expect(valid).toEqual({ search: 'PART', limit: 20 });
      expect(blank).toEqual({ search: undefined, limit: 20 });
      await expect(validate(valid)).resolves.toHaveLength(0);
      await expect(validate(oversizedSearch)).resolves.not.toHaveLength(0);
      await expect(validate(oversizedLimit)).resolves.not.toHaveLength(0);
    });

    it('returns only active material part number and name options', async () => {
      const { prisma, service } = createOptionsService();
      prisma.material.findMany.mockResolvedValue([
        { PartNumber: 'MAT-1', PartName: 'Material One' },
      ]);

      await expect(
        service.getPublicMaterialOptions({ search: 'mat', limit: 10 }),
      ).resolves.toEqual([{ partNumber: 'MAT-1', partName: 'Material One' }]);
      expect(prisma.material.findMany).toHaveBeenCalledWith({
        where: {
          IsActive: true,
          OR: [
            { PartNumber: { contains: 'mat', mode: 'insensitive' } },
            { PartName: { contains: 'mat', mode: 'insensitive' } },
          ],
        },
        select: { PartNumber: true, PartName: true },
        orderBy: [{ PartNumber: 'asc' }, { Id: 'asc' }],
        take: 10,
      });
    });

    it('returns minimal options from released production labels only', async () => {
      const { prisma, service } = createOptionsService();
      prisma.labelData.findMany.mockResolvedValue([
        {
          LabelNumber: 'LABEL-1',
          QtyThisBox: 20,
          FinishGoodId: 'FG-1',
          PartData: { PartName: 'Finish Good One' },
        },
      ]);

      await expect(
        service.getPublicLabelOptions({ search: 'label', limit: 5 }),
      ).resolves.toEqual([
        {
          labelNumber: 'LABEL-1',
          labelQty: 20,
          finishGoodPartNumber: 'FG-1',
          finishGoodPartName: 'Finish Good One',
        },
      ]);
      expect(prisma.labelData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ProductionRelease: { is: { Status: 'RELEASED' } },
          }),
          select: {
            LabelNumber: true,
            QtyThisBox: true,
            FinishGoodId: true,
            PartData: { select: { PartName: true } },
          },
          take: 5,
        }),
      );
    });
  });

  describe('getPublicFinishGoodContext', () => {
    function createPublicContextService() {
      const prisma = {
        labelData: { findUnique: jest.fn() },
        productionBomSnapshot: { findFirst: jest.fn() },
      };
      const service = new ProductionFindingService(
        prisma as unknown as PrismaService,
        {} as LogProcessService,
      );
      return { prisma, service };
    }

    it('normalizes a valid label query and rejects blank or oversized values', async () => {
      const valid = plainToInstance(PublicFinishGoodFindingContextQueryDto, {
        labelNumber: '  FG-001  ',
      });
      const blank = plainToInstance(PublicFinishGoodFindingContextQueryDto, {
        labelNumber: '   ',
      });
      const oversized = plainToInstance(
        PublicFinishGoodFindingContextQueryDto,
        { labelNumber: 'X'.repeat(256) },
      );

      expect(valid.labelNumber).toBe('FG-001');
      await expect(validate(valid)).resolves.toHaveLength(0);
      await expect(validate(blank)).resolves.not.toHaveLength(0);
      await expect(validate(oversized)).resolves.not.toHaveLength(0);
    });

    it('returns only normalized released-label and immutable snapshot context', async () => {
      const { prisma, service } = createPublicContextService();
      prisma.labelData.findUnique.mockResolvedValue({
        LabelNumber: 'FG-001',
        QtyThisBox: 20,
        FinishGoodId: 'FG-PART-1',
        ForecastId: 'forecast-1',
        ProductionReleaseId: 'release-1',
        PartData: { PartName: 'Finish Good One' },
        ProductionRelease: { Status: 'RELEASED' },
      });
      prisma.productionBomSnapshot.findFirst.mockResolvedValue({
        FinishGoodPartNumber: 'FG-PART-1',
        FinishGoodPartName: 'Finish Good One',
        Lines: [
          {
            Id: '22222222-2222-4222-8222-222222222222',
            PartNumber: 'MAT-1',
            PartName: 'Material One',
            QtyPerUnit: 2,
            RequiredQty: 40,
          },
        ],
      });

      await expect(
        service.getPublicFinishGoodContext('  FG-001  '),
      ).resolves.toEqual({
        labelNumber: 'FG-001',
        finishGoodPartNumber: 'FG-PART-1',
        finishGoodPartName: 'Finish Good One',
        labelQty: 20,
        components: [
          {
            snapshotLineId: '22222222-2222-4222-8222-222222222222',
            materialPartNumber: 'MAT-1',
            materialPartName: 'Material One',
            QtyPerUnit: 2,
          },
        ],
      });
      expect(prisma.labelData.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { LabelNumber: 'FG-001' } }),
      );
      expect(prisma.productionBomSnapshot.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ForecastId: 'forecast-1', ReleaseId: 'release-1' },
          orderBy: { Version: 'desc' },
        }),
      );
    });

    it('rejects a label outside a released production order', async () => {
      const { prisma, service } = createPublicContextService();
      prisma.labelData.findUnique.mockResolvedValue({
        LabelNumber: 'FG-001',
        ProductionReleaseId: 'release-1',
        ProductionRelease: { Status: 'COMPLETED' },
      });

      await expect(
        service.getPublicFinishGoodContext('FG-001'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.productionBomSnapshot.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a released label without an immutable BOM snapshot', async () => {
      const { prisma, service } = createPublicContextService();
      prisma.labelData.findUnique.mockResolvedValue({
        LabelNumber: 'FG-001',
        QtyThisBox: 20,
        FinishGoodId: 'FG-PART-1',
        ForecastId: 'forecast-1',
        ProductionReleaseId: 'release-1',
        PartData: { PartName: 'Finish Good One' },
        ProductionRelease: { Status: 'RELEASED' },
      });
      prisma.productionBomSnapshot.findFirst.mockResolvedValue(null);

      await expect(
        service.getPublicFinishGoodContext('FG-001'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('accepts ASSY as a material finding location', async () => {
    const dto = plainToInstance(SubmitMaterialFindingDto, {
      requestId,
      materialId: 'MAT-1',
      location: 'ASSY',
      qty: 2,
      reason: 'Damaged during assembly',
      reporter: 'operator',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('approves an ASSY material finding without inventory mutation', async () => {
    const finding = {
      Id: 'finding-1',
      Category: 'MATERIAL',
      Status: 'PENDING',
      MaterialId: 'MAT-1',
      Location: 'ASSY',
      Qty: 1,
      ForecastId: null,
      ReleaseId: null,
    };
    const { tx, prisma, logs } = createHarness(finding);
    Object.assign(tx, {
      stockOpname: { findFirst: jest.fn() },
      material: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
      inventoryLedger: { aggregate: jest.fn(), create: jest.fn() },
    });
    const module = await Test.createTestingModule({
      providers: [
        ProductionFindingService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogProcessService, useValue: logs },
      ],
    }).compile();

    await module
      .get(ProductionFindingService)
      .approve('finding-1', { requestId }, 'leader');

    expect(tx.productionFinding.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ Status: 'WAITING_PART_CHANGE' }),
      }),
    );
    expect(tx.inventoryLedger.create).not.toHaveBeenCalled();
    expect(tx.material.update).not.toHaveBeenCalled();
    expect(tx.stockOpname.findFirst).not.toHaveBeenCalled();
  });

  it('blocks material finding approval while material inventory counting is active', async () => {
    const finding = {
      Id: 'finding-1',
      Category: 'MATERIAL',
      Status: 'PENDING',
      MaterialId: 'MAT-1',
      Location: 'RACK',
      Qty: 1,
      ForecastId: null,
      ReleaseId: null,
    };
    const { tx, prisma, logs } = createHarness(finding);
    Object.assign(tx, {
      stockOpname: {
        findFirst: jest.fn().mockResolvedValue({
          Id: 'opname-1',
          RecordNumber: 'IC-001',
          Category: 'MATERIAL',
          Status: 'IN_PROGRESS',
        }),
      },
      material: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      inventoryLedger: {
        aggregate: jest.fn(),
        create: jest.fn(),
      },
    });
    const module = await Test.createTestingModule({
      providers: [
        ProductionFindingService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogProcessService, useValue: logs },
      ],
    }).compile();

    await expect(
      module
        .get(ProductionFindingService)
        .approve('finding-1', { requestId }, 'leader'),
    ).rejects.toThrow('Inventory Counting session IC-001');
    expect(tx.inventoryLedger.create).not.toHaveBeenCalled();
    expect(tx.material.update).not.toHaveBeenCalled();
    expect(tx.productionFinding.update).not.toHaveBeenCalled();
  });

  it('allocates matching NON_PRODUCTION ADDITIONAL shopping to an ASSY finding', async () => {
    const finding = {
      Id: 'finding-1',
      Category: 'MATERIAL',
      Location: 'ASSY',
      Status: 'WAITING_PART_CHANGE',
      ForecastId: null,
      ReleaseId: null,
      Components: [
        {
          Id: 'component-1',
          MaterialId: 'MAT-1',
          Qty: 2,
          Allocations: [],
        },
      ],
    };
    const { tx, prisma, logs } = createHarness(finding);
    tx.shopping.findUnique.mockResolvedValue({
      Id: 'shopping-1',
      Type: 'ADDITIONAL',
      Purpose: 'NON_PRODUCTION',
      ForecastId: null,
      MaterialId: 'MAT-1',
      QtyPick: 2,
    });
    const module = await Test.createTestingModule({
      providers: [
        ProductionFindingService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogProcessService, useValue: logs },
      ],
    }).compile();

    await module.get(ProductionFindingService).allocate(
      'finding-1',
      {
        requestId,
        componentId: 'component-1',
        shoppingId: 'shopping-1',
        qty: 2,
      },
      'leader',
    );

    expect(tx.productionFindingAllocation.create).toHaveBeenCalledWith({
      data: {
        FindingId: 'finding-1',
        ComponentId: 'component-1',
        ShoppingId: 'shopping-1',
        Qty: 2,
        CreatedBy: 'leader',
      },
    });
  });

  it('completes a finish-good finding only when every component is covered', async () => {
    const finding = {
      Id: 'finding-1',
      Category: 'FINISH_GOOD',
      Status: 'WAITING_PART_CHANGE',
      ForecastId: 'PO-1',
      ReleaseId: 'release-1',
      ReviewNote: null,
      Components: [
        { Qty: 3, Allocations: [{ Qty: 2 }, { Qty: 1 }] },
        { Qty: 1, Allocations: [{ Qty: 1 }] },
      ],
    };
    const { tx, prisma, logs } = createHarness(finding);
    const module = await Test.createTestingModule({
      providers: [
        ProductionFindingService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogProcessService, useValue: logs },
      ],
    }).compile();

    await module
      .get(ProductionFindingService)
      .complete('finding-1', { requestId }, 'leader');

    expect(tx.productionFinding.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          Status: 'COMPLETED',
          CompletedBy: 'leader',
        }),
      }),
    );
    expect(tx.productionTraceEvent.create).toHaveBeenCalled();
  });

  it('rejects completion when component allocation coverage is short', async () => {
    const finding = {
      Id: 'finding-1',
      Category: 'FINISH_GOOD',
      Status: 'WAITING_PART_CHANGE',
      ForecastId: 'PO-1',
      ReleaseId: 'release-1',
      ReviewNote: null,
      Components: [{ Qty: 3, Allocations: [{ Qty: 2 }] }],
    };
    const { prisma, logs } = createHarness(finding);
    const module = await Test.createTestingModule({
      providers: [
        ProductionFindingService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogProcessService, useValue: logs },
      ],
    }).compile();

    await expect(
      module
        .get(ProductionFindingService)
        .complete('finding-1', { requestId }, 'leader'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
