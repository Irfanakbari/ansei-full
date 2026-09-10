import { Test, TestingModule } from '@nestjs/testing';
import { MrpService } from './mrp.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';
import type { MrpCalculateResponse } from './dto/mrp-calculate.dto';

describe('MrpService', () => {
  let service: MrpService;
  let prismaService: jest.Mocked<PrismaService>;
  let logService: jest.Mocked<LogProcessService>;

  const mockLogProcess = {
    ProcessId: 'PR20260618120000000001',
    FunctionId: 'MRP_001',
    FunctionName: 'MrpService.calculate',
    ProcessStatus: 'STARTED' as const,
    ProcessStart: new Date(),
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'SYSTEM',
  };

  const mockMaterials = [
    {
      Id: 1,
      PartNumber: 'MAT-001',
      PartName: 'Material A',
      Supplier: 'Supplier A',
      RackLocation: 'A-01',
      QtyRack: 100,
      QtyWarehouse: 50,
      CreatedAt: new Date(),
      CreatedBy: 'admin',
      UpdatedAt: new Date(),
      SatuanId: 1,
    },
    {
      Id: 2,
      PartNumber: 'MAT-002',
      PartName: 'Material B',
      Supplier: 'Supplier B',
      RackLocation: 'B-02',
      QtyRack: 200,
      QtyWarehouse: 100,
      CreatedAt: new Date(),
      CreatedBy: 'admin',
      UpdatedAt: new Date(),
      SatuanId: 1,
    },
  ];

  const mockPendingIncoming = [
    { MaterialId: 1, _sum: { Qty: 25 } },
    { MaterialId: 2, _sum: { Qty: 50 } },
  ];

  const mockBomData = [
    { FinishGoodId: 1, MaterialId: 1, Qty: 2 },
    { FinishGoodId: 1, MaterialId: 2, Qty: 1 },
  ];

  const mockFinishGoods = [{ Id: 1, PartNumber: 'FG-001' }];

  const mockForecastData = [
    {
      FinishGoodId: 'FG-001',
      DeliveryDate: new Date(),
      Qty: 10,
    },
  ];

  beforeEach(async () => {
    const mockPrismaService = {
      material: {
        findMany: jest.fn(),
      },
      incomingMaterial: {
        groupBy: jest.fn(),
      },
      billOfMaterials: {
        findMany: jest.fn(),
      },
      finishGood: {
        findMany: jest.fn(),
      },
      forecast: {
        findMany: jest.fn(),
      },
    };

    const mockLogService = {
      startProcess: jest.fn().mockResolvedValue(mockLogProcess),
      addLog: jest.fn().mockResolvedValue({}),
      completeProcess: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MrpService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LogProcessService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<MrpService>(MrpService);
    prismaService = module.get(PrismaService);
    logService = module.get(LogProcessService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculate', () => {
    it('should return MRP data for all materials', async () => {
      // Setup mocks
      prismaService.material.findMany.mockResolvedValue(mockMaterials);
      prismaService.incomingMaterial.groupBy.mockResolvedValue(
        mockPendingIncoming,
      );
      prismaService.billOfMaterials.findMany.mockResolvedValue(mockBomData);
      prismaService.finishGood.findMany.mockResolvedValue(mockFinishGoods);
      prismaService.forecast.findMany.mockResolvedValue(mockForecastData);

      // Execute
      const result = await service.calculate();

      // Assert
      expect(result).toBeDefined();
      expect(result.materials).toBeDefined();
      expect(Array.isArray(result.materials)).toBe(true);
      expect(result.calculatedAt).toBeDefined();
      expect(result.dateRange).toBeDefined();
      expect(result.dateRange.today).toBeDefined();
    });

    it('should calculate qtyCurrentTotal correctly', async () => {
      prismaService.material.findMany.mockResolvedValue(mockMaterials);
      prismaService.incomingMaterial.groupBy.mockResolvedValue(
        mockPendingIncoming,
      );
      prismaService.billOfMaterials.findMany.mockResolvedValue([] as never);
      prismaService.finishGood.findMany.mockResolvedValue([] as never);
      prismaService.forecast.findMany.mockResolvedValue([] as never);

      const result = await service.calculate();

      // Material 1: 100 + 50 + 25 = 175
      const material1 = result.materials.find((m) => m.materialId === 1);
      expect(material1?.qtyCurrentTotal).toBe(175);

      // Material 2: 200 + 100 + 50 = 350
      const material2 = result.materials.find((m) => m.materialId === 2);
      expect(material2?.qtyCurrentTotal).toBe(350);
    });

    it('should return correct pending quantities', async () => {
      prismaService.material.findMany.mockResolvedValue(mockMaterials);
      prismaService.incomingMaterial.groupBy.mockResolvedValue(
        mockPendingIncoming,
      );
      prismaService.billOfMaterials.findMany.mockResolvedValue([] as never);
      prismaService.finishGood.findMany.mockResolvedValue([] as never);
      prismaService.forecast.findMany.mockResolvedValue([] as never);

      const result = await service.calculate();

      const material1 = result.materials.find((m) => m.materialId === 1);
      expect(material1?.qtyPending).toBe(25);

      const material2 = result.materials.find((m) => m.materialId === 2);
      expect(material2?.qtyPending).toBe(50);
    });

    it('should return 7 days of dailyDemand', async () => {
      prismaService.material.findMany.mockResolvedValue([
        mockMaterials[0],
      ] as never);
      prismaService.incomingMaterial.groupBy.mockResolvedValue([] as never);
      prismaService.billOfMaterials.findMany.mockResolvedValue([] as never);
      prismaService.finishGood.findMany.mockResolvedValue([] as never);
      prismaService.forecast.findMany.mockResolvedValue([] as never);

      const result = await service.calculate();

      expect(result.materials[0].dailyDemand).toHaveLength(7);

      // Check date format
      result.materials[0].dailyDemand.forEach((day) => {
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof day.demand).toBe('number');
        expect(typeof day.lack).toBe('number');
      });
    });

    it('should include material details in response', async () => {
      prismaService.material.findMany.mockResolvedValue([
        mockMaterials[0],
      ] as never);
      prismaService.incomingMaterial.groupBy.mockResolvedValue([] as never);
      prismaService.billOfMaterials.findMany.mockResolvedValue([] as never);
      prismaService.finishGood.findMany.mockResolvedValue([] as never);
      prismaService.forecast.findMany.mockResolvedValue([] as never);

      const result = await service.calculate();

      const material = result.materials[0];
      expect(material.partNumber).toBe('MAT-001');
      expect(material.partName).toBe('Material A');
      expect(material.supplier).toBe('Supplier A');
      expect(material.rackLocation).toBe('A-01');
      expect(material.qtyRack).toBe(100);
      expect(material.qtyWarehouse).toBe(50);
    });

    it('should call logService methods for audit logging', async () => {
      prismaService.material.findMany.mockResolvedValue([] as never);
      prismaService.incomingMaterial.groupBy.mockResolvedValue([] as never);
      prismaService.billOfMaterials.findMany.mockResolvedValue([] as never);
      prismaService.finishGood.findMany.mockResolvedValue([] as never);
      prismaService.forecast.findMany.mockResolvedValue([] as never);

      await service.calculate();

      expect(logService.startProcess).toHaveBeenCalledWith({
        functionId: 'MRP_001',
        functionName: 'MrpService.calculate',
        createdBy: 'SYSTEM',
      });

      expect(logService.addLog).toHaveBeenCalled();
      expect(logService.completeProcess).toHaveBeenCalledWith(
        mockLogProcess.ProcessId,
        'SUCCESS',
      );
    });

    it('should handle materials with zero stock correctly', async () => {
      const zeroStockMaterial = {
        Id: 3,
        PartNumber: 'MAT-003',
        PartName: 'Material C',
        Supplier: null,
        RackLocation: null,
        QtyRack: 0,
        QtyWarehouse: 0,
        CreatedAt: new Date(),
        CreatedBy: 'admin',
        UpdatedAt: new Date(),
        SatuanId: null,
      };

      prismaService.material.findMany.mockResolvedValue([
        zeroStockMaterial,
      ] as never);
      prismaService.incomingMaterial.groupBy.mockResolvedValue([] as never);
      prismaService.billOfMaterials.findMany.mockResolvedValue([] as never);
      prismaService.finishGood.findMany.mockResolvedValue([] as never);
      prismaService.forecast.findMany.mockResolvedValue([] as never);

      const result = await service.calculate();

      const material = result.materials[0];
      expect(material.qtyRack).toBe(0);
      expect(material.qtyWarehouse).toBe(0);
      expect(material.qtyPending).toBe(0);
      expect(material.qtyCurrentTotal).toBe(0);
    });

    it('should calculate lack correctly', async () => {
      prismaService.material.findMany.mockResolvedValue([
        mockMaterials[0],
      ] as never);
      prismaService.incomingMaterial.groupBy.mockResolvedValue([] as never);
      prismaService.billOfMaterials.findMany.mockResolvedValue([] as never);
      prismaService.finishGood.findMany.mockResolvedValue([] as never);
      prismaService.forecast.findMany.mockResolvedValue([] as never);

      const result = await service.calculate();

      // All demands are 0, so lack should be 0 (not negative)
      const material = result.materials[0];
      material.dailyDemand.forEach((day) => {
        expect(day.lack).toBe(0);
      });
    });

    it('should show lack when demand exceeds stock', async () => {
      // Material with stock = 175, demand = 200 on today
      const materialWithHighDemand = {
        Id: 10,
        PartNumber: 'MAT-HIGH',
        PartName: 'High Demand Material',
        Supplier: 'Test Supplier',
        RackLocation: 'R-01',
        QtyRack: 75,
        QtyWarehouse: 100,
        CreatedAt: new Date(),
        CreatedBy: 'admin',
        UpdatedAt: new Date(),
        SatuanId: 1,
      };

      // BOM: Material 10 is used by FG-001 with qty 1
      const bomForHighDemand = [{ FinishGoodId: 1, MaterialId: 10, Qty: 1 }];

      // Forecast: FG-001 with qty 200 on today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const forecastForHighDemand = [
        {
          FinishGoodId: 'FG-001',
          DeliveryDate: today,
          Qty: 200,
        },
      ];

      prismaService.material.findMany.mockResolvedValue([
        materialWithHighDemand,
      ] as never);
      prismaService.incomingMaterial.groupBy.mockResolvedValue([] as never);
      prismaService.billOfMaterials.findMany.mockResolvedValue(
        bomForHighDemand,
      );
      prismaService.finishGood.findMany.mockResolvedValue(mockFinishGoods);
      prismaService.forecast.findMany.mockResolvedValue(forecastForHighDemand);

      const result = await service.calculate();

      const material = result.materials[0];
      // qtyCurrentTotal = 75 + 100 + 0 = 175
      expect(material.qtyCurrentTotal).toBe(175);

      // Find today's entry
      const todayEntry = material.dailyDemand.find(
        (d) => d.date === result.dateRange.today,
      );
      // demand = 200, lack = max(0, 200 - 175) = 25
      expect(todayEntry?.demand).toBe(200);
      expect(todayEntry?.lack).toBe(25);
    });

    it('should handle empty materials list', async () => {
      prismaService.material.findMany.mockResolvedValue([]);
      prismaService.incomingMaterial.groupBy.mockResolvedValue([]);
      prismaService.billOfMaterials.findMany.mockResolvedValue([]);
      prismaService.finishGood.findMany.mockResolvedValue([]);
      prismaService.forecast.findMany.mockResolvedValue([]);

      const result = await service.calculate();

      expect(result.materials).toHaveLength(0);
    });

    it('should calculate demand based on BOM and Forecast', async () => {
      // Material 1 is used by FinishGood 1 with qty 2
      // Forecast has FG-001 with qty 10
      // Expected demand = 10 * 2 = 20
      prismaService.material.findMany.mockResolvedValue([
        mockMaterials[0],
      ] as never);
      prismaService.incomingMaterial.groupBy.mockResolvedValue([] as never);
      prismaService.billOfMaterials.findMany.mockResolvedValue(mockBomData);
      prismaService.finishGood.findMany.mockResolvedValue(mockFinishGoods);
      prismaService.forecast.findMany.mockResolvedValue(mockForecastData);

      const result = await service.calculate();

      const material = result.materials[0];
      // At least one day should have demand greater than 0
      const hasDemand = material.dailyDemand.some((d) => d.demand > 0);
      expect(hasDemand).toBe(true);
    });
  });
});
