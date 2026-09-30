import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from './report.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';

describe('ReportService', () => {
  let service: ReportService;
  let prismaService: jest.Mocked<PrismaService>;
  let logService: jest.Mocked<LogProcessService>;

  const mockPrismaService = {
    material: {
      findMany: jest.fn(),
    },
    incoming: {
      findMany: jest.fn(),
    },
    inventoryLedger: {
      findMany: jest.fn(),
    },
    materialDeliveryNote: {
      findMany: jest.fn(),
    },
    productionRelease: {
      findMany: jest.fn(),
    },
    pokayokeScanHistory: {
      findMany: jest.fn(),
    },
    deliveryHistory: {
      findMany: jest.fn(),
    },
    productionReport: {
      findMany: jest.fn(),
    },
    shopping: {
      findMany: jest.fn(),
    },
  };

  const mockLogService = {
    startProcess: jest.fn(),
    addLog: jest.fn(),
    completeProcess: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LogProcessService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
    prismaService = module.get(PrismaService);
    logService = module.get(LogProcessService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateStockMaterialReport', () => {
    it('should generate stock material report successfully', async () => {
      // Setup mock data
      const mockMaterials = [
        {
          Id: 1,
          PartNumber: 'MAT-001',
          PartName: 'Material 1',
          Supplier: 'Supplier A',
          RackLocation: 'RACK-A1',
          QtyRack: 100,
          QtyWarehouse: 500,
          IsActive: true,
          SatuanData: { Name: 'PCS' },
        },
        {
          Id: 2,
          PartNumber: 'MAT-002',
          PartName: 'Material 2',
          Supplier: 'Supplier B',
          RackLocation: 'RACK-B1',
          QtyRack: 200,
          QtyWarehouse: 300,
          IsActive: true,
          SatuanData: { Name: 'BOX' },
        },
      ];

      mockPrismaService.material.findMany.mockResolvedValue(
        mockMaterials as any,
      );

      // Execute
      const result = await service.generateStockMaterialReport();

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      expect(mockPrismaService.material.findMany).toHaveBeenCalledWith({
        where: { IsActive: true },
        include: { SatuanData: true },
        orderBy: { PartNumber: 'asc' },
      });
    });

    it('should handle empty material list', async () => {
      mockPrismaService.material.findMany.mockResolvedValue([]);

      const result = await service.generateStockMaterialReport();

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('generateIncomingWarehouseReport', () => {
    it('should generate incoming warehouse report with date range', async () => {
      const mockIncomings = [
        {
          Id: 'INC-001',
          PoId: 'PO-2026-001',
          CreatedAt: new Date(),
          ReceivedBy: 'John',
          SupplierData: { Name: 'Supplier A' },
          IncomingMaterial: [
            {
              Qty: 100,
              QtyChecked: 95,
              MaterialData: { PartNumber: 'MAT-001', PartName: 'Material 1' },
            },
          ],
        },
      ];

      mockPrismaService.incoming.findMany.mockResolvedValue(
        mockIncomings as any,
      );

      const result = await service.generateIncomingWarehouseReport(
        '01072026',
        '31072026',
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.incoming.findMany).toHaveBeenCalled();
    });

    it('should generate incoming warehouse report without date range', async () => {
      mockPrismaService.incoming.findMany.mockResolvedValue([]);

      const result = await service.generateIncomingWarehouseReport();

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('generateTransferMaterialReport', () => {
    it('should generate transfer material report with flattened detail rows', async () => {
      const mockDeliveryNotes = [
        {
          Id: 'DN-001',
          DeliveryNoteNum: 'SJ-MAT/2026/07/0001',
          Destination: 'Area A',
          Status: 'SHIPPED',
          CreatedAt: new Date(),
          CreatedBy: 'John',
          ShippedAt: new Date(),
          ShippedBy: 'Jane',
          Notes: 'Test notes',
          Details: [
            {
              MaterialData: { PartNumber: 'MAT-001', PartName: 'Material 1' },
              QtyRequested: 50,
              QtyPicking: 50,
              QtyReceived: 48,
            },
          ],
        },
      ];

      mockPrismaService.materialDeliveryNote.findMany.mockResolvedValue(
        mockDeliveryNotes as any,
      );

      const result = await service.generateTransferMaterialReport();

      expect(result).toBeInstanceOf(Buffer);
      expect(
        mockPrismaService.materialDeliveryNote.findMany,
      ).toHaveBeenCalled();
    });
  });

  describe('generateInventoryLedgerReport', () => {
    it('should generate inventory ledger report with filters', async () => {
      const mockLedgers = [
        {
          Id: 'uuid-001',
          TransactionDate: new Date(),
          ItemCategory: 'MATERIAL',
          MaterialId: 'MAT-001',
          Location: 'WAREHOUSE',
          TransactionType: 'INCOMING_SUPPLIER',
          ReferenceDoc: 'PO-001',
          BalanceBefore: 100,
          QtyIn: 50,
          QtyOut: 0,
          BalanceAfter: 150,
          CreatedBy: 'John',
          MaterialData: { PartNumber: 'MAT-001', PartName: 'Material 1' },
          FGData: null,
        },
      ];

      mockPrismaService.inventoryLedger.findMany.mockResolvedValue(
        mockLedgers as any,
      );

      const result = await service.generateInventoryLedgerReport(
        '01072026',
        '31072026',
        'MATERIAL',
        'WAREHOUSE',
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.inventoryLedger.findMany).toHaveBeenCalled();
    });
  });

  describe('generateProductionReleaseReport', () => {
    it('should generate production release report with flattened forecasts', async () => {
      const mockReleases = [
        {
          Id: 'PR-001',
          ReleaseNumber: 'PR-2026-001',
          PlanDate: new Date(),
          Status: 'RELEASED',
          TotalTargetQty: 1000,
          TotalGoodQty: 950,
          TotalNgQty: 50,
          CreatedAt: new Date(),
          CreatedBy: 'John',
          Forecasts: [
            {
              PoId: 'PO-2026-001',
              Qty: 500,
              PartData: { PartNumber: 'FG-001', PartName: 'Finish Good 1' },
            },
          ],
        },
      ];

      mockPrismaService.productionRelease.findMany.mockResolvedValue(
        mockReleases as any,
      );

      const result = await service.generateProductionReleaseReport();

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.productionRelease.findMany).toHaveBeenCalled();
    });
  });

  describe('generatePokayokeScanReport', () => {
    it('should generate pokayoke scan report', async () => {
      const mockScans = [
        {
          Id: 1,
          LabelNumber: 'LABEL-001',
          PoId: 'PO-2026-001',
          PartNumber: 'FG-001',
          PartName: 'Finish Good 1',
          Status: 'SUKSES',
          CreatedAt: new Date(),
          CreatedBy: 'John',
        },
      ];

      mockPrismaService.pokayokeScanHistory.findMany.mockResolvedValue(
        mockScans as any,
      );

      const result = await service.generatePokayokeScanReport(
        '01072026',
        '31072026',
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.pokayokeScanHistory.findMany).toHaveBeenCalled();
    });
  });

  describe('generateDeliveryHistoryReport', () => {
    it('should generate delivery history report', async () => {
      const mockDeliveries = [
        {
          Id: 1,
          ForecastId: 'PO-2026-001',
          Qty: 10,
          CreatedAt: new Date(),
          CreatedBy: 'John',
          LabelDataId: 'LABEL-001',
          LabelData: { LabelNumber: 'LABEL-001', FinishGoodId: 'FG-001' },
          PoData: { PartData: { PartName: 'Finish Good 1' } },
        },
      ];

      mockPrismaService.deliveryHistory.findMany.mockResolvedValue(
        mockDeliveries as any,
      );

      const result = await service.generateDeliveryHistoryReport();

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.deliveryHistory.findMany).toHaveBeenCalled();
    });
  });

  describe('generateProductionReport', () => {
    it('should generate production report', async () => {
      const mockReports = [
        {
          Id: 1,
          Date: '2026-07-01',
          Time: '08:00',
          PoNumber: 'PO-2026-001',
          Qty: 100,
          NgQty: 5,
          StopMinute: 30,
          CreatedAt: new Date(),
          ValidatedAt: new Date(),
          ValidatedBy: 'Validator',
          FinishGoodId: 'FG-001',
          ManPowerUid: 'uid-001',
          FGData: { PartNumber: 'FG-001', PartName: 'Finish Good 1' },
          ManPowerData: { Name: 'Operator 1' },
        },
      ];

      mockPrismaService.productionReport.findMany.mockResolvedValue(
        mockReports as any,
      );

      const result = await service.generateProductionReport();

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.productionReport.findMany).toHaveBeenCalled();
    });
  });

  describe('generateShoppingHistoryReport', () => {
    it('should generate shopping history report', async () => {
      const mockShoppings = [
        {
          Id: 'SHP-001',
          ForecastId: 'PO-2026-001',
          Type: 'REGULER',
          QtyPick: 50,
          Description: 'Test',
          CreatedAt: new Date(),
          CreatedBy: 'John',
          MaterialData: { PartNumber: 'MAT-001', PartName: 'Material 1' },
          ForecastData: { PoId: 'PO-2026-001' },
        },
      ];

      mockPrismaService.shopping.findMany.mockResolvedValue(
        mockShoppings as any,
      );

      const result = await service.generateShoppingHistoryReport();

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.shopping.findMany).toHaveBeenCalled();
    });
  });

  describe('generateIncomingRackReport', () => {
    it('should generate incoming rack report from ledger', async () => {
      const mockLedgers = [
        {
          Id: 'uuid-001',
          ReferenceDoc: 'TRANSFER-001',
          TransactionDate: new Date(),
          QtyIn: 50,
          CreatedBy: 'John',
          MaterialId: 'MAT-001',
          MaterialData: {
            PartNumber: 'MAT-001',
            PartName: 'Material 1',
            Supplier: 'Supplier A',
          },
        },
      ];

      mockPrismaService.inventoryLedger.findMany.mockResolvedValue(
        mockLedgers as any,
      );

      const result = await service.generateIncomingRackReport();

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.inventoryLedger.findMany).toHaveBeenCalled();
    });
  });
});
