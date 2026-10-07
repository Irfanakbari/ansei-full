import { latestSnapshot } from '../common/helpers/bom-snapshot.helper';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';
import type { LogProcessModel } from '../generated/prisma/models';
import type {
  MrpCalculateResponse,
  MrpMaterialResponse,
  MrpDayDemand,
} from './dto/mrp-calculate.dto';
import ExcelJS from 'exceljs';

// BOM data: materialId -> array of {finishGoodId, qty}
// Forecast data: dateStr -> poId -> { finishGoodId, outstandingQty }
type BomDataMap = Map<number, Array<{ finishGoodId: number; qty: number }>>;
type ForecastDataMap = Map<
  string,
  Map<
    string,
    {
      finishGoodId: string;
      outstandingQty: number;
      snapshotBom?: Map<number, number>;
    }
  >
>;

@Injectable()
export class MrpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  /**
   * Calculate MRP (Material Requirements Planning) for all materials
   * Returns current stock, pending incoming, and demand forecast for 6 days
   */
  async calculate(): Promise<MrpCalculateResponse> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MRP_001',
        functionName: 'MrpService.calculate',
        createdBy: 'SYSTEM',
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: 'Starting MRP calculation',
        type: 'INFO',
        location: 'mrp.service.ts:38',
      });

      // Calculate date range: today, H+1, H-1, H-2, H-3, H-4, H-5
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dates = this.generateDateRange(today);

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Calculating MRP for date range: ${dates[0].toISOString()} to ${dates[dates.length - 1].toISOString()}`,
        type: 'INFO',
        location: 'mrp.service.ts:53',
      });

      // Get all materials with their stock info
      const materials = await this.prisma.material.findMany({
        orderBy: { PartNumber: 'asc' },
        include: {
          SupplierData: true,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Found ${materials.length} materials to process`,
        type: 'INFO',
        location: 'mrp.service.ts:60',
      });

      // Get pending incoming quantities (from Incoming.IncomingMaterial where Closed = false)
      // Re-added: Pending incoming represents goods physically arrived but still under checking.
      const pendingIncoming = await this.getPendingIncomingQuantities();

      // Get Reserved Materials (from MaterialDeliveryNoteDetail with DRAFT status)
      const reservedMaterials = await this.getReservedMaterials();

      // Get Bill of Materials for all materials
      const bomData = await this.getBillOfMaterialsData();

      // Get demand forecasts for the date range (only forecasts without DeliveryHistory)
      const forecastData = await this.getForecastDemands(dates);

      // Get FinishGood to PartNumber mapping for BOM lookup
      const finishGoodMap = await this.getFinishGoodMapping();

      // Get Picked Materials for those forecasts
      const pickedMaterialsMap = await this.getPickedMaterials(forecastData);

      // Process each material
      const materialResults: MrpMaterialResponse[] = [];

      for (const material of materials) {
        const materialId = material.Id;
        const partNumber = material.PartNumber;

        // Calculate QtyPending
        const qtyPending = pendingIncoming.get(materialId) || 0;

        // Calculate QtyReserved
        const qtyReserved = reservedMaterials.get(partNumber) || 0;

        // Calculate QtyCurrentTotal (Available Stock = Rack + WH + Pending - Reserved)
        const qtyCurrentTotal = Math.max(
          0,
          material.QtyRack + material.QtyWarehouse + qtyPending - qtyReserved,
        );

        // Calculate daily demand for each date (Cumulative)
        let runningStock = qtyCurrentTotal;
        const dailyDemand: MrpDayDemand[] = dates.map((date) => {
          const dateStr = this.formatDate(date);

          // Get demand for this material on this date
          const demand = this.calculateMaterialDemand(
            materialId,
            partNumber,
            dateStr,
            bomData,
            forecastData,
            finishGoodMap,
            pickedMaterialsMap,
          );

          runningStock -= demand;

          // Lack is the cumulative shortage up to this day
          const lack = Math.max(0, -runningStock);
          const hasShortage = lack > 0;

          return {
            date: dateStr,
            demand,
            lack,
            hasShortage,
          };
        });

        materialResults.push({
          materialId,
          partNumber,
          partName: material.PartName,
          supplier: material.SupplierData?.Name || material.Supplier || null,
          rackLocation: material.RackLocation,
          qtyRack: material.QtyRack,
          qtyWarehouse: material.QtyWarehouse,
          qtyPending,
          qtyReserved,
          qtyCurrentTotal,
          dailyDemand,
        });
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `MRP calculation completed for ${materialResults.length} materials`,
        type: 'INFO',
        location: 'mrp.service.ts:153',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return {
        calculatedAt: new Date().toISOString(),
        dateRange: {
          today: this.formatDate(today),
          startDate: this.formatDate(dates[0]), // Start from Today (H+0)
          endDate: this.formatDate(dates[dates.length - 1]), // H+6 (last future day)
        },
        materials: materialResults,
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'mrp.service.ts:171',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Generate date range chronologically: today, H+1, H+2, H+3, H+4, H+5, H+6
   */
  private generateDateRange(today: Date): Date[] {
    const dates: Date[] = [];

    // Today
    dates.push(new Date(today));

    // H+1 to H+6 (6 future days)
    for (let i = 1; i <= 6; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }

    return dates;
  }

  /**
   * Format date to YYYY-MM-DD string in local timezone
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get pending incoming quantities grouped by MaterialId
   * Only includes Incoming where Closed = false
   */
  private async getPendingIncomingQuantities(): Promise<Map<number, number>> {
    const pendingData = await this.prisma.incomingMaterial.groupBy({
      by: ['MaterialId'],
      where: {
        IncomingData: {
          Closed: false,
        },
        MaterialId: {
          not: null,
        },
      },
      _sum: {
        Qty: true,
      },
    });

    const result = new Map<number, number>();
    for (const item of pendingData) {
      if (item.MaterialId !== null) {
        result.set(item.MaterialId, item._sum.Qty || 0);
      }
    }

    return result;
  }

  /**
   * Get reserved material quantities grouped by MaterialId (PartNumber)
   * Only includes MaterialDeliveryNoteDetail where DeliveryNoteData.Status = 'DRAFT'
   */
  private async getReservedMaterials(): Promise<Map<string, number>> {
    const reservedData = await this.prisma.materialDeliveryNoteDetail.groupBy({
      by: ['MaterialId'],
      where: {
        DeliveryNoteData: {
          Status: 'DRAFT',
        },
        QtyPicking: {
          gt: 0,
        },
      },
      _sum: {
        QtyPicking: true,
      },
    });

    const result = new Map<string, number>();
    for (const item of reservedData) {
      if (item.MaterialId) {
        result.set(item.MaterialId, item._sum.QtyPicking || 0);
      }
    }

    return result;
  }

  /**
   * Get Bill of Materials data for all materials
   * Maps MaterialId -> Set of FinishGoodIds that use this material
   */
  private async getBillOfMaterialsData(): Promise<BomDataMap> {
    const boms = await this.prisma.billOfMaterials.findMany({
      where: { FGData: { ActiveBomRevisionId: { not: null } } },
      select: {
        FinishGoodId: true,
        MaterialId: true,
        Qty: true,
      },
    });

    // Map: materialId -> array of {finishGoodId, qty}
    const result = new Map<
      number,
      Array<{ finishGoodId: number; qty: number }>
    >();

    for (const bom of boms) {
      if (!result.has(bom.MaterialId)) {
        result.set(bom.MaterialId, []);
      }
      result.get(bom.MaterialId)!.push({
        finishGoodId: bom.FinishGoodId,
        qty: bom.Qty,
      });
    }

    return result;
  }

  /**
   * Get FinishGood mapping: Id -> PartNumber
   */
  private async getFinishGoodMapping(): Promise<Map<number, string>> {
    const finishGoods = await this.prisma.finishGood.findMany({
      select: {
        Id: true,
        PartNumber: true,
      },
    });

    const result = new Map<number, string>();
    for (const fg of finishGoods) {
      result.set(fg.Id, fg.PartNumber);
    }

    return result;
  }

  /**
   * Get forecast demands for the date range
   * Calculates outstanding demand by subtracting delivered qty
   * Returns Map of date string -> poId -> { finishGoodId, outstandingQty }
   */
  private async getForecastDemands(dates: Date[]): Promise<ForecastDataMap> {
    // Dates array is chronological: [H-5, H-4, H-3, H-2, H-1, today, H+1]
    const startDate = dates[0]; // H-5 (earliest)
    const endDate = dates[dates.length - 1]; // H+1 (latest)

    // Get forecasts in date range
    const forecasts = await this.prisma.productionOrder.findMany({
      where: {
        DeliveryDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        PoId: true,
        FinishGoodId: true,
        DeliveryDate: true,
        ProductionReleaseId: true,
        ProductionRelease: { select: { Status: true } },
        Qty: true,
        DeliveryHistory: {
          select: {
            Qty: true,
          },
        },
      },
    });

    const result = new Map<
      string,
      Map<
        string,
        {
          finishGoodId: string;
          outstandingQty: number;
          snapshotBom?: Map<number, number>;
        }
      >
    >();

    for (const forecast of forecasts) {
      const dateStr = this.formatDate(new Date(forecast.DeliveryDate));

      if (!result.has(dateStr)) {
        result.set(dateStr, new Map());
      }

      // Calculate outstanding quantity (Forecast Qty - Total Delivered Qty)
      const totalDelivered = forecast.DeliveryHistory.reduce(
        (sum, h) => sum + h.Qty,
        0,
      );
      const outstandingQty = Math.max(0, forecast.Qty - totalDelivered);

      if (outstandingQty > 0) {
        result.get(dateStr)!.set(forecast.PoId, {
          finishGoodId: forecast.FinishGoodId,
          outstandingQty,
          snapshotBom:
            forecast.ProductionReleaseId &&
            forecast.ProductionRelease?.Status !== 'DRAFT'
              ? new Map(
                  (
                    await latestSnapshot(
                      this.prisma,
                      forecast.PoId,
                      forecast.ProductionReleaseId,
                    )
                  )?.Lines.map((line) => [line.MaterialId, line.QtyPerUnit]) ??
                    [],
                )
              : undefined,
        });
      }
    }

    return result;
  }

  /**
   * Get total picked quantity for all valid forecasts in the date range
   * Returns Map of ProductionDemandId -> Map of Material PartNumber -> QtyPick
   */
  private async getPickedMaterials(
    forecastData: ForecastDataMap,
  ): Promise<Map<string, Map<string, number>>> {
    const allForecastIds = new Set<string>();
    for (const dayForecasts of forecastData.values()) {
      for (const poId of dayForecasts.keys()) {
        allForecastIds.add(poId);
      }
    }

    if (allForecastIds.size === 0) {
      return new Map();
    }

    const shoppings = await this.prisma.shopping.groupBy({
      by: ['ProductionDemandId', 'MaterialId'],
      where: {
        ProductionDemandId: { in: Array.from(allForecastIds) },
        Purpose: 'STANDARD',
      },
      _sum: {
        QtyPick: true,
      },
    });

    const result = new Map<string, Map<string, number>>();
    for (const shop of shoppings) {
      if (!shop.ProductionDemandId) continue;

      if (!result.has(shop.ProductionDemandId)) {
        result.set(shop.ProductionDemandId, new Map());
      }

      result
        .get(shop.ProductionDemandId)!
        .set(shop.MaterialId, shop._sum.QtyPick || 0);
    }

    return result;
  }

  /**
   * Calculate material demand for a specific date
   * Based on BOM: Material demand = Sum of max(0, (Forecast.OutstandingQty * BOM.Qty) - PickedQty)
   */
  private calculateMaterialDemand(
    materialId: number,
    materialPartNumber: string,
    dateStr: string,
    bomData: BomDataMap,
    forecastData: ForecastDataMap,
    finishGoodMap: Map<number, string>,
    pickedMaterialsMap: Map<string, Map<string, number>>,
  ): number {
    const dayForecasts = forecastData.get(dateStr);

    if (!dayForecasts) {
      return 0;
    }

    // Get the BOM entries for this material
    const bomEntries = bomData.get(materialId) ?? [];

    // Create a map of finishGoodPartNumber -> bomQty for this material
    const finishGoodBomMap = new Map<string, number>();
    for (const entry of bomEntries) {
      const partNumber = finishGoodMap.get(entry.finishGoodId);
      if (partNumber) {
        finishGoodBomMap.set(partNumber, entry.qty);
      }
    }

    let totalDemand = 0;

    // For each Forecast on this date
    for (const [
      poId,
      { finishGoodId, outstandingQty, snapshotBom },
    ] of dayForecasts) {
      const bomQty = snapshotBom
        ? snapshotBom.get(materialId)
        : finishGoodBomMap.get(finishGoodId);
      if (bomQty !== undefined) {
        // This FinishGood uses this Material
        const baseRequired = outstandingQty * bomQty;

        // Subtract already picked amount
        const alreadyPicked =
          pickedMaterialsMap.get(poId)?.get(materialPartNumber) || 0;

        const remainingRequired = Math.max(0, baseRequired - alreadyPicked);
        totalDemand += remainingRequired;
      }
    }

    return totalDemand;
  }

  /**
   * Export MRP data to Excel file
   * Layout similar to frontend with merged headers and printable format
   */
  async exportToExcel(): Promise<{ buffer: Buffer; filename: string }> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MRP_002',
        functionName: 'MrpService.exportToExcel',
        createdBy: 'SYSTEM',
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: 'Starting MRP Excel export',
        type: 'INFO',
        location: 'mrp.service.ts:380',
      });

      // Get MRP data
      const mrpData = await this.calculate();

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Exporting ${mrpData.materials.length} materials to Excel`,
        type: 'INFO',
        location: 'mrp.service.ts:395',
      });

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ANSEI IPCS System';
      workbook.created = new Date();

      // Add worksheet
      const worksheet = workbook.addWorksheet('MRP Report', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }],
        pageSetup: {
          paperSize: 9, // A4
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          horizontalCentered: true,
          verticalCentered: false,
          margins: {
            top: 0.5,
            bottom: 0.5,
            left: 0.5,
            right: 0.5,
            header: 0.3,
            footer: 0.3,
          },
        },
      });

      // ===== HEADER SECTION (Rows 1-3) =====
      // Company/Title Header
      worksheet.mergeCells('A1:Q1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'PT ANSEI INDONESIA';
      titleCell.font = {
        name: 'Arial',
        size: 16,
        bold: true,
        color: { argb: 'FF1E3A5F' },
      };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8EDF5' },
      };

      worksheet.mergeCells('A2:Q2');
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = 'MATERIAL REQUIREMENTS PLANNING (MRP) REPORT';
      subtitleCell.font = {
        name: 'Arial',
        size: 12,
        bold: true,
        color: { argb: 'FF1E3A5F' },
      };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      subtitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8EDF5' },
      };

      // Info Row
      const needRestockCount = mrpData.materials.filter(
        (m) => Math.max(...m.dailyDemand.map((d) => d.lack)) > 0,
      ).length;

      const dateRangeText =
        this.formatDateForDisplay(mrpData.dateRange.startDate) +
        ' - ' +
        this.formatDateForDisplay(mrpData.dateRange.endDate);
      const calculatedAtText = this.formatDateTimeForDisplay(
        mrpData.calculatedAt,
      );

      worksheet.mergeCells('A3:Q3');
      const infoCell = worksheet.getCell('A3');
      infoCell.value = `Calculated: ${calculatedAtText}  |  Period: ${dateRangeText}  |  Total Materials: ${mrpData.materials.length}  |  Need Restock: ${needRestockCount}`;
      infoCell.font = { name: 'Arial', size: 10, italic: true };
      infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
      infoCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      };

      // ===== LEGEND ROW (Row 4) =====
      worksheet.mergeCells('A4:Q4');
      const legendCell = worksheet.getCell('A4');
      legendCell.value =
        'Dmd = Demand  |  Lack = Stock Shortage  |  ✓ = Stock OK  |  OK = No Restock Needed';
      legendCell.font = {
        name: 'Arial',
        size: 9,
        italic: true,
        color: { argb: 'FF6B7280' },
      };
      legendCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // ===== COLUMN HEADERS (Rows 5-6) =====
      // Generate date columns based on data
      const dates = mrpData.dateRange;
      const startDate = new Date(dates.startDate);
      const endDate = new Date(dates.endDate);
      const dateColumns: {
        date: Date;
        dateStr: string;
        displayDate: string;
      }[] = [];

      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const dateStr = d.toISOString().split('T')[0];
        dateColumns.push({
          date: new Date(d),
          dateStr,
          displayDate: this.formatDateShort(d),
        });
      }

      // Base columns definition (starting column A)
      const baseColumns = [
        { header: 'No', width: 5, field: 'no', align: 'center' },
        {
          header: 'Part Number',
          width: 14,
          field: 'partNumber',
          align: 'left',
        },
        {
          header: 'Material Name',
          width: 22,
          field: 'partName',
          align: 'left',
        },
        { header: 'Supplier', width: 16, field: 'supplier', align: 'left' },
        { header: 'Rack', width: 8, field: 'rackLocation', align: 'center' },
        { header: 'Qty Rack', width: 9, field: 'qtyRack', align: 'right' },
        { header: 'Qty WH', width: 9, field: 'qtyWarehouse', align: 'right' },
        { header: 'Pending', width: 8, field: 'qtyPending', align: 'right' },
        { header: 'Reserved', width: 9, field: 'qtyReserved', align: 'right' },
        {
          header: 'Total Avail',
          width: 10,
          field: 'qtyCurrentTotal',
          align: 'right',
        },
      ];

      // Calculate column positions
      // A=No, B=PartNumber, C=MaterialName, D=Supplier, E=Rack, F=QtyRack, G=QtyWH, H=Pending, I=Reserved, J=Total
      // Then K onwards are date columns with 2 sub-columns each (Dmd, Lack)
      // Then last column = Max Lack

      const numBaseCols = baseColumns.length;
      const numDateColumns = dateColumns.length;
      const totalCols = numBaseCols + numDateColumns * 2 + 1; // base + date subcols + MaxLack

      // Add data rows starting at row 7
      const currentRow = 7;

      // Header Row 5 - Main headers
      worksheet.getRow(5).height = 22;

      // Base columns
      for (let i = 0; i < numBaseCols; i++) {
        const col = i + 1;
        const cell = worksheet.getCell(5, col);
        cell.value = baseColumns[i].header;
        cell.font = {
          name: 'Arial',
          size: 10,
          bold: true,
          color: { argb: 'FFFFFFFF' },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A5F' }, // Dark blue
        };
        cell.alignment = {
          horizontal: baseColumns[i].align as 'center' | 'left' | 'right',
          vertical: 'middle',
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        };
        worksheet.getColumn(col).width = baseColumns[i].width;
      }

      // Date columns header (spanning 2 columns each)
      let dateColIndex = numBaseCols + 1; // Start after base columns
      for (const dateCol of dateColumns) {
        const colStart = dateColIndex;
        const colEnd = dateColIndex + 1;

        // Merge the date header cell
        worksheet.mergeCells(5, colStart, 5, colEnd);
        const dateCell = worksheet.getCell(5, colStart);
        dateCell.value = dateCol.displayDate;
        dateCell.font = {
          name: 'Arial',
          size: 10,
          bold: true,
          color: { argb: 'FFFFFFFF' },
        };
        dateCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A5F' },
        };
        dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
        dateCell.border = {
          top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        };

        worksheet.getColumn(colStart).width = 11;
        worksheet.getColumn(colEnd).width = 8;

        dateColIndex += 2;
      }

      // Max Lack column header
      const maxLackCol = numBaseCols + numDateColumns * 2 + 1;
      const maxLackCell = worksheet.getCell(5, maxLackCol);
      maxLackCell.value = 'Max Lack';
      maxLackCell.font = {
        name: 'Arial',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      maxLackCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF7C3AED' }, // Purple for summary
      };
      maxLackCell.alignment = { horizontal: 'center', vertical: 'middle' };
      maxLackCell.border = {
        top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      };
      worksheet.getColumn(maxLackCol).width = 10;

      // Header Row 6 - Sub headers (Dmd, Lack)
      worksheet.getRow(6).height = 20;
      dateColIndex = numBaseCols + 1;
      for (const dateCol of dateColumns) {
        // Dmd header
        const dmdCell = worksheet.getCell(6, dateColIndex);
        dmdCell.value = 'Dmd';
        dmdCell.font = {
          name: 'Arial',
          size: 9,
          bold: true,
          color: { argb: 'FF059669' },
        }; // Green
        dmdCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD1FAE5' }, // Light green
        };
        dmdCell.alignment = { horizontal: 'center', vertical: 'middle' };
        dmdCell.border = {
          top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        };

        // Lack header
        const lackCell = worksheet.getCell(6, dateColIndex + 1);
        lackCell.value = 'Lack';
        lackCell.font = {
          name: 'Arial',
          size: 9,
          bold: true,
          color: { argb: 'FFDC2626' },
        }; // Red
        lackCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEE2E2' }, // Light red
        };
        lackCell.alignment = { horizontal: 'center', vertical: 'middle' };
        lackCell.border = {
          top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        };

        dateColIndex += 2;
      }

      // ===== DATA ROWS (starting row 7) =====
      for (let i = 0; i < mrpData.materials.length; i++) {
        const material = mrpData.materials[i];
        const rowNum = 7 + i;
        const maxLack = Math.max(...material.dailyDemand.map((d) => d.lack));
        const hasShortage = maxLack > 0;

        // Determine row background color based on shortage
        let rowBgColor = 'FFFFFFFF'; // White
        if (hasShortage) {
          rowBgColor = 'FFFFF7ED'; // Light orange for shortage
        }

        worksheet.getRow(rowNum).height = 18;

        // No
        const noCell = worksheet.getCell(rowNum, 1);
        noCell.value = i + 1;
        noCell.font = { name: 'Arial', size: 10 };
        noCell.alignment = { horizontal: 'center', vertical: 'middle' };
        noCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor },
        };
        noCell.border = {
          top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };

        // Part Number
        const partCell = worksheet.getCell(rowNum, 2);
        partCell.value = material.partNumber;
        partCell.font = { name: 'Courier New', size: 9, bold: true };
        partCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F4FF' },
        };
        partCell.alignment = { horizontal: 'left', vertical: 'middle' };
        partCell.border = {
          top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };

        // Material Name
        const nameCell = worksheet.getCell(rowNum, 3);
        nameCell.value = material.partName;
        nameCell.font = { name: 'Arial', size: 10 };
        nameCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor },
        };
        nameCell.alignment = { horizontal: 'left', vertical: 'middle' };
        nameCell.border = {
          top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };

        // Supplier
        const supplierCell = worksheet.getCell(rowNum, 4);
        supplierCell.value = material.supplier;
        supplierCell.font = { name: 'Arial', size: 10 };
        supplierCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor },
        };
        supplierCell.alignment = { horizontal: 'left', vertical: 'middle' };
        supplierCell.border = {
          top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };

        // Rack
        const rackCell = worksheet.getCell(rowNum, 5);
        rackCell.value = material.rackLocation || '-';
        rackCell.font = { name: 'Arial', size: 9, bold: true };
        rackCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor },
        };
        rackCell.alignment = { horizontal: 'center', vertical: 'middle' };
        rackCell.border = {
          top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };

        // Qty Rack
        const qtyRackCell = worksheet.getCell(rowNum, 6);
        qtyRackCell.value = material.qtyRack;
        qtyRackCell.font = { name: 'Arial', size: 10 };
        qtyRackCell.alignment = { horizontal: 'right', vertical: 'middle' };
        qtyRackCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor },
        };
        qtyRackCell.border = {
          top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };

        // Qty Warehouse
        const qtyWhCell = worksheet.getCell(rowNum, 7);
        qtyWhCell.value = material.qtyWarehouse;
        qtyWhCell.font = { name: 'Arial', size: 10 };
        qtyWhCell.alignment = { horizontal: 'right', vertical: 'middle' };
        qtyWhCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor },
        };
        qtyWhCell.border = {
          top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };

        // Pending
        const pendingCell = worksheet.getCell(rowNum, 8);
        pendingCell.value = material.qtyPending;
        pendingCell.font = {
          name: 'Arial',
          size: 10,
          color:
            material.qtyPending > 0
              ? { argb: 'FFD97706' }
              : { argb: 'FF6B7280' },
          bold: material.qtyPending > 0,
        };
        pendingCell.alignment = { horizontal: 'right', vertical: 'middle' };
        pendingCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor },
        };
        pendingCell.border = {
          top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };

        // Reserved
        const reservedCell = worksheet.getCell(rowNum, 9);
        reservedCell.value = material.qtyReserved || 0;
        reservedCell.font = {
          name: 'Arial',
          size: 10,
          color:
            (material.qtyReserved || 0) > 0
              ? { argb: 'FFD97706' }
              : { argb: 'FF6B7280' },
          bold: (material.qtyReserved || 0) > 0,
        };
        reservedCell.alignment = { horizontal: 'right', vertical: 'middle' };
        reservedCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor },
        };
        reservedCell.border = {
          top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };

        // Total
        const totalCell = worksheet.getCell(rowNum, 10);
        totalCell.value = material.qtyCurrentTotal;
        totalCell.font = {
          name: 'Arial',
          size: 10,
          bold: true,
          color: { argb: 'FF059669' },
        };
        totalCell.alignment = { horizontal: 'right', vertical: 'middle' };
        totalCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor },
        };
        totalCell.border = {
          top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };

        // Date columns (Dmd and Lack)
        dateColIndex = numBaseCols + 1;
        for (const dateCol of dateColumns) {
          const demandData = material.dailyDemand.find(
            (dd) => dd.date === dateCol.dateStr,
          );
          const demand = demandData?.demand || 0;
          const lack = demandData?.lack || 0;

          // Dmd cell
          const dmdCell = worksheet.getCell(rowNum, dateColIndex);
          dmdCell.value = demand; // Always show 0 if no demand
          dmdCell.font = {
            name: 'Arial',
            size: 10,
            color: demand > 0 ? { argb: 'FF059669' } : { argb: 'FF9CA3AF' },
            bold: demand > 0,
          };
          dmdCell.alignment = { horizontal: 'right', vertical: 'middle' };
          dmdCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: demand > 0 ? 'FFD1FAE5' : rowBgColor },
          };
          dmdCell.border = {
            top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
            left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
            right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          };

          // Lack cell
          const lackCell = worksheet.getCell(rowNum, dateColIndex + 1);
          if (lack > 0) {
            lackCell.value = lack;
            lackCell.font = {
              name: 'Arial',
              size: 10,
              bold: true,
              color: { argb: 'FFDC2626' },
            };
            lackCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFEE2E2' },
            };
          } else {
            lackCell.value = '✓';
            lackCell.font = {
              name: 'Arial',
              size: 11,
              bold: true,
              color: { argb: 'FF059669' },
            };
            lackCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD1FAE5' },
            };
          }
          lackCell.alignment = { horizontal: 'center', vertical: 'middle' };
          lackCell.border = {
            top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
            left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
            right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          };

          dateColIndex += 2;
        }

        // Max Lack cell
        const maxLackCell = worksheet.getCell(rowNum, maxLackCol);
        if (hasShortage) {
          maxLackCell.value = maxLack;
          maxLackCell.font = {
            name: 'Arial',
            size: 11,
            bold: true,
            color: { argb: 'FFDC2626' },
          };
          maxLackCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEE2E2' },
          };
        } else {
          maxLackCell.value = 'OK';
          maxLackCell.font = {
            name: 'Arial',
            size: 10,
            bold: true,
            color: { argb: 'FF059669' },
          };
          maxLackCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD1FAE5' },
          };
        }
        maxLackCell.alignment = { horizontal: 'center', vertical: 'middle' };
        maxLackCell.border = {
          top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };
      }

      // ===== FOOTER =====
      const lastDataRow = 7 + mrpData.materials.length;
      const footerRow = lastDataRow + 1;
      worksheet.mergeCells(`A${footerRow}:${maxLackCol}${footerRow}`);
      const footerCell = worksheet.getCell(`A${footerRow}`);
      footerCell.value = `Generated by ANSEI IPCS System on ${this.formatDateTimeForDisplay(
        new Date().toISOString(),
      )}`;
      footerCell.font = {
        name: 'Arial',
        size: 8,
        italic: true,
        color: { argb: 'FF9CA3AF' },
      };
      footerCell.alignment = { horizontal: 'right', vertical: 'middle' };

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Generate filename
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace('T', '_')
        .slice(0, 15);
      const filename = `MRP_Report_${timestamp}.xlsx`;

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Excel export completed: ${filename}`,
        type: 'INFO',
        location: 'mrp.service.ts:780',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return {
        buffer: Buffer.from(buffer),
        filename,
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'mrp.service.ts:790',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Format date for display (e.g., "16 Jul")
   */
  private formatDateShort(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
    };
    return date.toLocaleDateString('id-ID', options);
  }

  /**
   * Format date for display (e.g., "16 July 2026")
   */
  private formatDateForDisplay(dateStr: string): string {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    };
    return date.toLocaleDateString('id-ID', options);
  }

  /**
   * Format datetime for display (e.g., "16 July 2026, 08:30")
   */
  private formatDateTimeForDisplay(dateStr: string): string {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    return date.toLocaleDateString('id-ID', options);
  }
}
