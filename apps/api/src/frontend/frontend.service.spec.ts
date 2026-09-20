import { Test, TestingModule } from '@nestjs/testing';
import { FrontendService } from './frontend.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FrontendService', () => {
  let service: FrontendService;
  let prisma: {
    finishGood: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
    };
    manPower: { findMany: jest.Mock; count: jest.Mock };
    productionRelease: { findFirst: jest.Mock; findMany: jest.Mock };
    forecast: { findMany: jest.Mock; findUnique: jest.Mock };
    incoming: { findMany: jest.Mock; count: jest.Mock };
    stockOpname: { findMany: jest.Mock };
    labelData: { findMany: jest.Mock };
    assemblySession: { findMany: jest.Mock };
    billOfMaterials: { findMany: jest.Mock };
    shopping: { findMany: jest.Mock };
    shoppingCompletion: { findMany: jest.Mock };
    material: { count: jest.Mock; findMany: jest.Mock };
    supplier: { count: jest.Mock };
    inventoryLedger: { groupBy: jest.Mock };
    incomingMaterial: { groupBy: jest.Mock };
    deliveryHistory: { findMany: jest.Mock; groupBy: jest.Mock };
    productionReport: { findMany: jest.Mock };
    pokayokeScanHistory: { count: jest.Mock };
    materialNgCase: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      finishGood: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      manPower: { findMany: jest.fn(), count: jest.fn() },
      productionRelease: { findFirst: jest.fn(), findMany: jest.fn() },
      forecast: { findMany: jest.fn(), findUnique: jest.fn() },
      incoming: { findMany: jest.fn(), count: jest.fn() },
      stockOpname: { findMany: jest.fn() },
      labelData: { findMany: jest.fn() },
      assemblySession: { findMany: jest.fn() },
      billOfMaterials: { findMany: jest.fn() },
      shopping: { findMany: jest.fn() },
      shoppingCompletion: { findMany: jest.fn() },
      material: { count: jest.fn(), findMany: jest.fn() },
      supplier: { count: jest.fn() },
      inventoryLedger: { groupBy: jest.fn() },
      incomingMaterial: { groupBy: jest.fn() },
      deliveryHistory: { findMany: jest.fn(), groupBy: jest.fn() },
      productionReport: { findMany: jest.fn() },
      pokayokeScanHistory: { count: jest.fn() },
      materialNgCase: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FrontendService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FrontendService>(FrontendService);
  });

  describe('getNotifications', () => {
    beforeEach(() => {
      prisma.forecast.findMany.mockResolvedValue([]);
      prisma.incoming.findMany.mockResolvedValue([]);
      prisma.stockOpname.findMany.mockResolvedValue([]);
      prisma.labelData.findMany.mockResolvedValue([]);
      prisma.assemblySession.findMany.mockResolvedValue([]);
    });

    it('returns only safe assembly data and one message per active session', async () => {
      const startedAt = new Date('2026-09-20T01:00:00.000Z');
      prisma.assemblySession.findMany.mockResolvedValue([
        {
          Id: 'assembly-1',
          StartedAt: startedAt,
          LabelData: {
            LabelNumber: 'LBL-001',
            FinishGoodId: 'FG-001',
            ProductionReleaseId: 'release-1',
            ProductionRelease: { ReleaseNumber: 'PR-001' },
          },
        },
      ]);

      const result = await service.getNotifications();

      expect(prisma.assemblySession.findMany).toHaveBeenCalledWith({
        where: {
          Status: 'IN_PROGRESS',
          LabelData: { ProductionRelease: { Status: 'RELEASED' } },
        },
        select: {
          Id: true,
          StartedAt: true,
          LabelData: {
            select: {
              LabelNumber: true,
              FinishGoodId: true,
              ProductionReleaseId: true,
              ProductionRelease: { select: { ReleaseNumber: true } },
            },
          },
        },
        orderBy: { StartedAt: 'asc' },
      });
      expect(result.totalAssemblyInProgress).toBe(1);
      expect(result.assemblyInProgress).toEqual([
        {
          id: 'assembly-1',
          labelNumber: 'LBL-001',
          finishGoodId: 'FG-001',
          releaseId: 'release-1',
          releaseNumber: 'PR-001',
          startedAt,
        },
      ]);
      expect(result.messages).toContainEqual({
        menu: 'ASSEMBLY',
        message:
          'Release ID : PR-001, Label LBL-001 Assembly Still In Progress',
      });
    });

    it('returns an empty assembly state', async () => {
      const result = await service.getNotifications();

      expect(result.totalAssemblyInProgress).toBe(0);
      expect(result.assemblyInProgress).toEqual([]);
      expect(result.messages).toEqual([]);
    });

    it('evaluates shopping completion once per distinct forecast', async () => {
      prisma.labelData.findMany.mockResolvedValue([
        {
          Id: 1,
          LabelNumber: 'LBL-001',
          ForecastId: 'PO-001',
          ProductionReleaseId: 'release-1',
          ProductionRelease: { Id: 'release-1', ReleaseNumber: 'PR-001' },
        },
        {
          Id: 2,
          LabelNumber: 'LBL-002',
          ForecastId: 'PO-001',
          ProductionReleaseId: 'release-1',
          ProductionRelease: { Id: 'release-1', ReleaseNumber: 'PR-001' },
        },
        {
          Id: 3,
          LabelNumber: 'LBL-003',
          ForecastId: 'PO-002',
          ProductionReleaseId: 'release-1',
          ProductionRelease: { Id: 'release-1', ReleaseNumber: 'PR-001' },
        },
      ]);
      prisma.forecast.findUnique.mockImplementation(({ where }) =>
        Promise.resolve({
          PoId: where.PoId,
          FinishGoodId: 'FG-001',
          Qty: 1,
          PartData: null,
        }),
      );
      prisma.billOfMaterials.findMany.mockResolvedValue([
        { MaterialData: { PartNumber: 'MAT-001' }, Qty: 1 },
      ]);
      prisma.shopping.findMany.mockResolvedValue([
        { MaterialId: 'MAT-001', QtyPick: 1 },
      ]);

      const result = await service.getNotifications();

      expect(prisma.forecast.findUnique).toHaveBeenCalledTimes(2);
      expect(prisma.billOfMaterials.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.shopping.findMany).toHaveBeenCalledTimes(2);
      expect(result.totalLabelDataNotScanned).toBe(3);
    });
  });

  describe('getDashboard', () => {
    beforeEach(() => {
      prisma.material.count.mockResolvedValue(0);
      prisma.supplier.count.mockResolvedValue(0);
      prisma.finishGood.findMany.mockResolvedValue([]);
      prisma.finishGood.count.mockResolvedValue(0);
      prisma.manPower.count.mockResolvedValue(0);
      prisma.material.findMany.mockResolvedValue([]);
      prisma.inventoryLedger.groupBy.mockResolvedValue([]);
      prisma.stockOpname.findMany.mockResolvedValue([]);
      prisma.forecast.findMany.mockResolvedValue([]);
      prisma.incoming.findMany.mockResolvedValue([]);
      prisma.incoming.count.mockResolvedValue(0);
      prisma.productionRelease.findMany.mockResolvedValue([]);
      prisma.productionReport.findMany.mockResolvedValue([]);
      prisma.assemblySession.findMany.mockResolvedValue([]);
      prisma.labelData.findMany.mockResolvedValue([]);
      prisma.pokayokeScanHistory.count.mockResolvedValue(0);
      prisma.deliveryHistory.findMany.mockResolvedValue([]);
      prisma.deliveryHistory.groupBy.mockResolvedValue([]);
      prisma.shoppingCompletion.findMany.mockResolvedValue([]);
      prisma.materialNgCase.findMany.mockResolvedValue([]);
    });

    it('uses half-open Jakarta month boundaries and null percentages for zero denominators', async () => {
      const result = await service.getDashboard({ month: 1, year: 2026 });

      expect(result.meta.periodStart).toEqual(
        new Date('2025-12-31T17:00:00.000Z'),
      );
      expect(result.meta.periodEndExclusive).toEqual(
        new Date('2026-01-31T17:00:00.000Z'),
      );
      expect(prisma.forecast.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            DeliveryDate: {
              gte: new Date('2025-12-31T17:00:00.000Z'),
              lt: new Date('2026-01-31T17:00:00.000Z'),
            },
          },
        }),
      );
      expect(result.monthly.production.productionAttainmentPct).toBeNull();
      expect(result.monthly.production.ngRatePct).toBeNull();
      expect(result.monthly.delivery.attainmentPct).toBeNull();
      expect(result.daily).toHaveLength(31);
      expect(result.daily[0]).toMatchObject({
        date: '2026-01-01',
        reportedGoodQty: 0,
      });
    });

    it('uses approved incoming, ledger stock, capped lifetime delivery, and report fallback formulas', async () => {
      prisma.material.findMany.mockResolvedValue([
        { PartNumber: 'MAT-1', PartName: 'Material', MinimumStock: 10 },
      ]);
      prisma.inventoryLedger.groupBy.mockResolvedValue([
        { MaterialId: 'MAT-1', _sum: { QtyIn: 4, QtyOut: 7 } },
      ]);
      prisma.forecast.findMany.mockResolvedValue([
        {
          PoId: 'PO-1',
          Qty: 10,
          DeliveryDate: new Date('2026-01-10T00:00:00.000Z'),
          ProductionReleaseId: null,
          FinishGoodId: 'FG-1',
          PartData: { PartNumber: 'FG-1', PartName: 'Part' },
        },
      ]);
      prisma.incoming.findMany.mockResolvedValue([
        {
          Id: 'IN-1',
          ApprovedAt: new Date('2026-01-05T00:00:00.000Z'),
          IncomingMaterial: [{ Qty: 7 }, { Qty: 3 }],
        },
      ]);
      prisma.productionReport.findMany.mockResolvedValue([
        {
          ProductionStamp: new Date('2026-01-06T00:00:00.000Z'),
          Qty: 8,
          NgQty: 2,
          ValidatedAt: null,
          FinishGoodId: 'FG-1',
        },
      ]);
      prisma.deliveryHistory.groupBy.mockResolvedValue([
        { ForecastId: 'PO-1', _sum: { Qty: 15 } },
      ]);

      const result = await service.getDashboard({ month: 1, year: 2026 });

      expect(result.monthly.incoming.approvedMaterialQty).toBe(10);
      expect(result.monthly.delivery.deliveredQty).toBe(10);
      expect(result.monthly.delivery.attainmentPct).toBe(100);
      expect(result.monthly.production.reportedQty).toBe(8);
      expect(result.monthly.production.reportedNgQty).toBe(2);
      expect(result.monthly.production.productionAttainmentPct).toBe(60);
      expect(result.inventoryRisk[0]).toMatchObject({
        totalStock: -3,
        status: 'NEGATIVE',
        shortageQty: 13,
      });
      expect(result.topParts[0]).toMatchObject({
        demandQty: 10,
        deliveredQty: 10,
        ngQty: 2,
      });
    });

    it('calculates shopping completion from completed forecast count without mixing quantities', async () => {
      prisma.productionRelease.findMany.mockResolvedValue([
        {
          Id: 'release-1',
          ReleaseNumber: 'PR-001',
          PlanDate: new Date('2026-01-10T00:00:00.000Z'),
          Status: 'RELEASED',
          TotalTargetQty: 1010,
          Forecasts: [
            { PoId: 'PO-1', FinishGoodId: 'FG-1', Qty: 10 },
            { PoId: 'PO-2', FinishGoodId: 'FG-2', Qty: 1000 },
          ],
          LabelDatas: [],
        },
      ]);
      prisma.shoppingCompletion.findMany.mockResolvedValue([
        { ForecastId: 'PO-1' },
      ]);

      const result = await service.getDashboard({ month: 1, year: 2026 });

      expect(result.releasePipeline[0].shoppingPct).toBe(50);
      expect(prisma.shoppingCompletion.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.shoppingCompletion.findMany).toHaveBeenCalledWith({
        where: { ForecastId: { in: ['PO-1', 'PO-2'] } },
        select: { ForecastId: true },
      });
    });

    it('calculates quantity-weighted assembly completion and treats non-required assembly as complete', async () => {
      prisma.productionRelease.findMany.mockResolvedValue([
        {
          Id: 'release-1',
          ReleaseNumber: 'PR-001',
          PlanDate: new Date('2026-01-10T00:00:00.000Z'),
          Status: 'RELEASED',
          TotalTargetQty: 30,
          Forecasts: [{ PoId: 'PO-1', FinishGoodId: 'FG-1', Qty: 30 }],
          LabelDatas: [
            {
              LabelNumber: 'LBL-1',
              Scanned: false,
              QtyThisBox: 10,
              RequiresAssembly: true,
              AssemblySessions: [{ Id: 'assembly-1' }],
            },
            {
              LabelNumber: 'LBL-2',
              Scanned: false,
              QtyThisBox: 20,
              RequiresAssembly: true,
              AssemblySessions: [],
            },
          ],
        },
        {
          Id: 'release-2',
          ReleaseNumber: 'PR-002',
          PlanDate: new Date('2026-01-11T00:00:00.000Z'),
          Status: 'RELEASED',
          TotalTargetQty: 10,
          Forecasts: [{ PoId: 'PO-2', FinishGoodId: 'FG-2', Qty: 10 }],
          LabelDatas: [
            {
              LabelNumber: 'LBL-3',
              Scanned: false,
              QtyThisBox: 10,
              RequiresAssembly: false,
              AssemblySessions: [],
            },
          ],
        },
      ]);
      prisma.shoppingCompletion.findMany.mockResolvedValue([]);

      const result = await service.getDashboard({ month: 1, year: 2026 });

      expect(result.releasePipeline[0].assemblyPct).toBeCloseTo(33.333, 2);
      expect(result.releasePipeline[1].assemblyPct).toBe(100);
    });

    it('returns null shopping completion for a release without forecasts', async () => {
      prisma.productionRelease.findMany.mockResolvedValue([
        {
          Id: 'release-empty',
          ReleaseNumber: 'PR-EMPTY',
          PlanDate: new Date('2026-01-10T00:00:00.000Z'),
          Status: 'RELEASED',
          TotalTargetQty: 0,
          Forecasts: [],
          LabelDatas: [],
        },
      ]);

      const result = await service.getDashboard({ month: 1, year: 2026 });

      expect(result.releasePipeline[0].shoppingPct).toBeNull();
      expect(prisma.shoppingCompletion.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getFinishGoodsList', () => {
    it('should return finish goods with PartNumber, PartName, Alias', async () => {
      const mockFinishGoods = [
        { PartNumber: 'FG-001', PartName: 'Part 1', Alias: 'P1' },
        { PartNumber: 'FG-002', PartName: 'Part 2', Alias: null },
      ];
      prisma.finishGood.findMany.mockResolvedValue(mockFinishGoods);

      const result = await service.getFinishGoodsList();

      expect(result).toEqual(mockFinishGoods);
      expect(prisma.finishGood.findMany).toHaveBeenCalledWith({
        select: {
          PartNumber: true,
          PartName: true,
          Alias: true,
        },
        orderBy: { PartNumber: 'asc' },
      });
    });
  });

  describe('getDisplayTarget', () => {
    it('should sum forecasts for the part number in the active release', async () => {
      prisma.finishGood.findUnique.mockResolvedValue({
        PartNumber: 'FG-001',
        PartName: 'Part 1',
        Alias: 'P1',
      });
      prisma.productionRelease.findFirst.mockResolvedValue({
        Id: 'release-1',
        ReleaseNumber: 'PR-001',
        Forecasts: [{ Qty: 10 }, { Qty: 15 }],
      });

      await expect(service.getDisplayTarget('FG-001')).resolves.toEqual({
        partNumber: 'FG-001',
        partName: 'Part 1',
        alias: 'P1',
        targetQty: 25,
        productionReleaseId: 'release-1',
        releaseNumber: 'PR-001',
      });
      expect(prisma.productionRelease.findFirst).toHaveBeenCalledWith({
        where: { Status: 'RELEASED' },
        select: {
          Id: true,
          ReleaseNumber: true,
          Forecasts: {
            where: { FinishGoodId: 'FG-001' },
            select: { Qty: true },
          },
        },
        orderBy: { PlanDate: 'desc' },
      });
    });

    it('should return zero when no production release is active', async () => {
      prisma.finishGood.findUnique.mockResolvedValue({
        PartNumber: 'FG-001',
        PartName: 'Part 1',
        Alias: null,
      });
      prisma.productionRelease.findFirst.mockResolvedValue(null);

      await expect(service.getDisplayTarget('FG-001')).resolves.toEqual({
        partNumber: 'FG-001',
        partName: 'Part 1',
        alias: null,
        targetQty: 0,
        productionReleaseId: null,
        releaseNumber: null,
      });
    });
  });

  describe('getManPowerList', () => {
    it('should return active manpower with Nik, Name, PicturePath, Line', async () => {
      const mockManPower = [
        {
          Nik: '12345678',
          Name: 'Budi Santoso',
          PicturePath: 'http://nas/pic.jpg',
          Line: 'LINE-A',
        },
      ];
      prisma.manPower.findMany.mockResolvedValue(mockManPower);

      const result = await service.getManPowerList();

      expect(result).toEqual(mockManPower);
      expect(prisma.manPower.findMany).toHaveBeenCalledWith({
        where: { Status: true },
        select: {
          Nik: true,
          Name: true,
          PicturePath: true,
          Line: true,
          SkillMatrix: {
            select: {
              Id: true,
              Label: true,
              Point: true,
            },
          },
        },
        orderBy: { Nik: 'asc' },
      });
    });
  });
});
