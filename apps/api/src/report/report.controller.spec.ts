import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { InventoryReconciliationService } from './inventory-reconciliation.service';

describe('ReportController', () => {
  let controller: ReportController;
  let reportService: jest.Mocked<ReportService>;

  const mockReportService = {
    generateStockMaterialReport: jest.fn(),
    generateIncomingWarehouseReport: jest.fn(),
    generateIncomingRackReport: jest.fn(),
    generateTransferMaterialReport: jest.fn(),
    generateProductionReleaseReport: jest.fn(),
    generatePokayokeScanReport: jest.fn(),
    generateDeliveryHistoryReport: jest.fn(),
    generateProductionReport: jest.fn(),
    generateShoppingHistoryReport: jest.fn(),
    generateMaterialNgReport: jest.fn(),
    generateInventoryLedgerReport: jest.fn(),
  };
  const mockReconciliationService = { reconcile: jest.fn() };

  const mockResponse = {
    set: jest.fn().mockReturnThis(),
    send: jest.fn(),
  } as unknown as Response;

  const mockUser = {
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    roleId: 1,
    roleName: 'Admin',
    sessionId: 'session-123',
    permissions: ['IPCS.REPORT_READ'],
    departments: ['IT'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [
        { provide: ReportService, useValue: mockReportService },
        {
          provide: InventoryReconciliationService,
          useValue: mockReconciliationService,
        },
      ],
    }).compile();

    controller = module.get<ReportController>(ReportController);
    reportService = module.get(ReportService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns the read-only inventory reconciliation', async () => {
    const result = { readOnly: true };
    mockReconciliationService.reconcile.mockResolvedValue(result);

    await expect(controller.reconcileInventory(mockUser)).resolves.toBe(result);
  });

  describe('generateStockMaterialReport', () => {
    it('should generate stock material report', async () => {
      const mockBuffer = Buffer.from('mock excel data');
      mockReportService.generateStockMaterialReport.mockResolvedValue(
        mockBuffer,
      );

      await controller.generateStockMaterialReport(mockUser, mockResponse);

      expect(reportService.generateStockMaterialReport).toHaveBeenCalled();
      expect(mockResponse.set).toHaveBeenCalledWith({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': expect.stringContaining('Stock_Material_Report'),
        'Content-Length': mockBuffer.length,
      });
      expect(mockResponse.send).toHaveBeenCalledWith(mockBuffer);
    });
  });

  describe('generateIncomingWarehouseReport', () => {
    it('should generate incoming warehouse report without date range', async () => {
      const mockBuffer = Buffer.from('mock excel data');
      mockReportService.generateIncomingWarehouseReport.mockResolvedValue(
        mockBuffer,
      );

      await controller.generateIncomingWarehouseReport(
        mockUser,
        mockResponse,
        {},
      );

      expect(
        reportService.generateIncomingWarehouseReport,
      ).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should generate incoming warehouse report with date range', async () => {
      const mockBuffer = Buffer.from('mock excel data');
      mockReportService.generateIncomingWarehouseReport.mockResolvedValue(
        mockBuffer,
      );

      await controller.generateIncomingWarehouseReport(mockUser, mockResponse, {
        fromdate: '01072026',
        todate: '31072026',
      });

      expect(
        reportService.generateIncomingWarehouseReport,
      ).toHaveBeenCalledWith('01072026', '31072026');
    });
  });

  describe('generateIncomingRackReport', () => {
    it('should generate incoming rack report', async () => {
      const mockBuffer = Buffer.from('mock excel data');
      mockReportService.generateIncomingRackReport.mockResolvedValue(
        mockBuffer,
      );

      await controller.generateIncomingRackReport(mockUser, mockResponse, {});

      expect(reportService.generateIncomingRackReport).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
    });
  });

  describe('generateTransferMaterialReport', () => {
    it('should generate transfer material report', async () => {
      const mockBuffer = Buffer.from('mock excel data');
      mockReportService.generateTransferMaterialReport.mockResolvedValue(
        mockBuffer,
      );

      await controller.generateTransferMaterialReport(
        mockUser,
        mockResponse,
        {},
      );

      expect(reportService.generateTransferMaterialReport).toHaveBeenCalled();
    });
  });

  describe('generateProductionReleaseReport', () => {
    it('should generate production release report', async () => {
      const mockBuffer = Buffer.from('mock excel data');
      mockReportService.generateProductionReleaseReport.mockResolvedValue(
        mockBuffer,
      );

      await controller.generateProductionReleaseReport(
        mockUser,
        mockResponse,
        {},
      );

      expect(reportService.generateProductionReleaseReport).toHaveBeenCalled();
    });
  });

  describe('generatePokayokeScanReport', () => {
    it('should generate pokayoke scan report', async () => {
      const mockBuffer = Buffer.from('mock excel data');
      mockReportService.generatePokayokeScanReport.mockResolvedValue(
        mockBuffer,
      );

      await controller.generatePokayokeScanReport(mockUser, mockResponse, {});

      expect(reportService.generatePokayokeScanReport).toHaveBeenCalled();
    });
  });

  describe('generateDeliveryHistoryReport', () => {
    it('should generate delivery history report', async () => {
      const mockBuffer = Buffer.from('mock excel data');
      mockReportService.generateDeliveryHistoryReport.mockResolvedValue(
        mockBuffer,
      );

      await controller.generateDeliveryHistoryReport(
        mockUser,
        mockResponse,
        {},
      );

      expect(reportService.generateDeliveryHistoryReport).toHaveBeenCalled();
    });
  });

  describe('generateProductionReport', () => {
    it('should generate production report', async () => {
      const mockBuffer = Buffer.from('mock excel data');
      mockReportService.generateProductionReport.mockResolvedValue(mockBuffer);

      await controller.generateProductionReport(mockUser, mockResponse, {});

      expect(reportService.generateProductionReport).toHaveBeenCalled();
    });
  });

  describe('generateShoppingHistoryReport', () => {
    it('should generate shopping history report', async () => {
      const mockBuffer = Buffer.from('mock excel data');
      mockReportService.generateShoppingHistoryReport.mockResolvedValue(
        mockBuffer,
      );

      await controller.generateShoppingHistoryReport(
        mockUser,
        mockResponse,
        {},
      );

      expect(reportService.generateShoppingHistoryReport).toHaveBeenCalled();
    });
  });

  describe('generateMaterialNgReport', () => {
    it('should generate material NG report', async () => {
      const mockBuffer = Buffer.from('mock excel data');
      mockReportService.generateMaterialNgReport.mockResolvedValue(mockBuffer);

      await controller.generateMaterialNgReport(mockUser, mockResponse, {});

      expect(reportService.generateMaterialNgReport).toHaveBeenCalled();
    });
  });

  describe('generateInventoryLedgerReport', () => {
    it('should generate inventory ledger report with all filters', async () => {
      const mockBuffer = Buffer.from('mock excel data');
      mockReportService.generateInventoryLedgerReport.mockResolvedValue(
        mockBuffer,
      );

      await controller.generateInventoryLedgerReport(mockUser, mockResponse, {
        fromdate: '01072026',
        todate: '31072026',
        category: 'MATERIAL',
        location: 'WAREHOUSE',
      });

      expect(reportService.generateInventoryLedgerReport).toHaveBeenCalledWith(
        '01072026',
        '31072026',
        'MATERIAL',
        'WAREHOUSE',
      );
    });
  });
});
