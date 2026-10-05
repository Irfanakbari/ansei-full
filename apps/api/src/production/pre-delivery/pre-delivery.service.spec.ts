import { Test, TestingModule } from '@nestjs/testing';
import { PreDeliveryService } from './pre-delivery.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as flow from '../../common/helpers/production-flow.helper';
import { ShoppingService } from '../shopping/shopping.service';

describe('PreDeliveryService', () => {
  let service: PreDeliveryService;
  let prismaService: any;

  const mockPrismaService = {
    labelData: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    forecast: {
      findMany: jest.fn(),
    },
    shopping: {
      findMany: jest.fn(),
    },
  };

  const mockShoppingService = {
    checkRequirement: jest.fn(),
  };

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.resetAllMocks();

    jest
      .spyOn(flow, 'assertLabelReady')
      .mockResolvedValue(
        {} as Awaited<ReturnType<typeof flow.assertLabelReady>>,
      );
    mockPrismaService.shopping.findMany.mockResolvedValue([
      { ForecastId: 'PO-001' },
    ]);
    // Set default mock implementations
    mockShoppingService.checkRequirement.mockResolvedValue({
      summary: { overallPercentage: 100 },
      requirements: [{ qtyNeeded: 20, qtyPicked: 20 }],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreDeliveryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ShoppingService, useValue: mockShoppingService },
      ],
    }).compile();

    service = module.get<PreDeliveryService>(PreDeliveryService);
    prismaService = mockPrismaService;
  });

  describe('findAll', () => {
    it('does not treat rounded 100% as complete shopping', async () => {
      mockShoppingService.checkRequirement.mockResolvedValue({
        summary: { overallPercentage: 100 },
        requirements: [
          { qtyNeeded: 200, qtyPicked: 200 },
          { qtyNeeded: 1, qtyPicked: 0 },
        ],
      });
      await expect(service['isShoppingComplete']('PO-001')).resolves.toBe(
        false,
      );
    });
    it('should return paginated label data', async () => {
      // Set up mocks for productionReleaseId filter
      mockPrismaService.forecast.findMany.mockResolvedValue([
        { PoId: 'PO-001' },
      ]);
      mockPrismaService.shopping.findMany.mockResolvedValue([
        { ForecastId: 'PO-001' },
      ]);
      mockShoppingService.checkRequirement.mockResolvedValue({
        summary: { overallPercentage: 100 },
        requirements: [{ qtyNeeded: 20, qtyPicked: 20 }],
      });

      const mockLabels = [
        {
          Id: 1,
          LabelNumber: 'LBL001',
          Scanned: false,
          ForecastId: 'PO-001',
          FinishGoodId: 'FG-001',
          QtyThisBox: 100,
          PartData: { PartNumber: 'FG-001', PartName: 'Finish Good A' },
          POData: { PoId: 'PO-001', VendorName: 'Vendor A' },
          ProductionRelease: { Id: 'rel-1', ReleaseNumber: 'PR-001' },
        },
        {
          Id: 2,
          LabelNumber: 'LBL002',
          Scanned: true,
          ForecastId: 'PO-001',
          FinishGoodId: 'FG-001',
          QtyThisBox: 50,
          PartData: { PartNumber: 'FG-001', PartName: 'Finish Good A' },
          POData: { PoId: 'PO-001', VendorName: 'Vendor A' },
          ProductionRelease: { Id: 'rel-1', ReleaseNumber: 'PR-001' },
        },
      ];

      mockPrismaService.labelData.count.mockResolvedValue(2);
      mockPrismaService.labelData.findMany.mockResolvedValue(mockLabels as any);

      const result = await service.findAll({
        productionReleaseId: 'rel-1',
        page: 1,
        limit: 50,
      });

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
    });

    it('should filter by forecastId', async () => {
      // Set up mocks for productionReleaseId filter
      mockPrismaService.forecast.findMany.mockResolvedValue([
        { PoId: 'PO-001' },
      ]);
      mockPrismaService.shopping.findMany.mockResolvedValue([
        { ForecastId: 'PO-001' },
      ]);
      mockShoppingService.checkRequirement.mockResolvedValue({
        summary: { overallPercentage: 100 },
        requirements: [{ qtyNeeded: 20, qtyPicked: 20 }],
      });

      mockPrismaService.labelData.count.mockResolvedValue(0);
      mockPrismaService.labelData.findMany.mockResolvedValue([]);

      await service.findAll({
        productionReleaseId: 'rel-1',
        forecastId: 'PO-001',
      });

      expect(mockPrismaService.labelData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ForecastId: 'PO-001' }),
        }),
      );
    });

    it('should filter by scanned status', async () => {
      // Set up mocks for productionReleaseId filter
      mockPrismaService.forecast.findMany.mockResolvedValue([
        { PoId: 'PO-001' },
      ]);
      mockPrismaService.shopping.findMany.mockResolvedValue([
        { ForecastId: 'PO-001' },
      ]);
      mockShoppingService.checkRequirement.mockResolvedValue({
        summary: { overallPercentage: 100 },
        requirements: [{ qtyNeeded: 20, qtyPicked: 20 }],
      });

      mockPrismaService.labelData.count.mockResolvedValue(0);
      mockPrismaService.labelData.findMany.mockResolvedValue([]);

      await service.findAll({ productionReleaseId: 'rel-1', scanned: true });

      expect(mockPrismaService.labelData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ Scanned: true }),
        }),
      );
    });

    it('should return empty when no productionReleaseId found', async () => {
      mockPrismaService.forecast.findMany.mockResolvedValue([]);

      const result = await service.findAll({
        productionReleaseId: 'invalid-id',
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a label by id', async () => {
      const mockLabel = {
        Id: 1,
        LabelNumber: 'LBL001',
        Scanned: false,
        PartData: { PartNumber: 'FG-001', PartName: 'Finish Good A' },
        POData: { PoId: 'PO-001', VendorName: 'Vendor A' },
        ProductionRelease: { Id: 'rel-1', ReleaseNumber: 'PR-001' },
      };
      mockPrismaService.labelData.findUnique.mockResolvedValue(
        mockLabel as any,
      );

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.labelNumber).toBe('LBL001');
    });

    it('filters by active production release when activeReleaseOnly is true', async () => {
      mockPrismaService.forecast.findMany.mockResolvedValue([
        { PoId: 'PO-001' },
      ]);
      mockPrismaService.labelData.findMany.mockResolvedValue([]);
      mockPrismaService.labelData.count.mockResolvedValue(0);

      await service.findAll({ activeReleaseOnly: true });

      expect(mockPrismaService.forecast.findMany).toHaveBeenCalledWith({
        where: { ProductionRelease: { Status: 'RELEASED' } },
        select: { PoId: true },
      });
      expect(mockPrismaService.labelData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ProductionRelease: { Status: 'RELEASED' },
          }),
        }),
      );
    });

    it('should return null when not found', async () => {
      mockPrismaService.labelData.findUnique.mockResolvedValue(null);

      const result = await service.findOne(999);

      expect(result).toBeNull();
    });
  });

  describe('getSummary', () => {
    it('should return summary statistics', async () => {
      mockPrismaService.labelData.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      const result = await service.getSummary();

      expect(result.total).toBe(3);
      expect(result.scanned).toBe(2);
      expect(result.notScanned).toBe(1);
    });

    it('should return 0 percentage when no labels', async () => {
      mockPrismaService.labelData.count.mockResolvedValue(0);

      const result = await service.getSummary();

      expect(result.total).toBe(0);
      expect(result.percentage).toBe(0);
    });
  });
});
