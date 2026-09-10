import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductionStatus, OpnameStatus } from '../generated/prisma/enums';
import {
  DashboardResponseEntity,
  DashboardSummaryEntity,
  DailyForecastStatEntity,
  DailyIncomingStatEntity,
  DailyDeliveryStatEntity,
} from './entities/dashboard-response.entity';

@Injectable()
export class FrontendService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if shopping is complete (100%) for a forecast
   */
  private async isShoppingComplete(forecastId: string): Promise<boolean> {
    // Get Forecast with its FinishGood
    const forecast = await this.prisma.forecast.findUnique({
      where: { PoId: forecastId },
      include: {
        PartData: {
          select: {
            PartNumber: true,
            PartName: true,
          },
        },
      },
    });

    if (!forecast) {
      return false;
    }

    // Get BOM for FinishGood
    const bomEntries = await this.prisma.billOfMaterials.findMany({
      where: { FGData: { PartNumber: forecast.FinishGoodId } },
      select: {
        MaterialData: {
          select: {
            PartNumber: true,
          },
        },
        Qty: true,
      },
    });

    // Get all shopping records for this forecast
    const shoppings = await this.prisma.shopping.findMany({
      where: { ForecastId: forecastId },
      select: {
        MaterialId: true,
        QtyPick: true,
      },
    });

    // Calculate total picked per material
    const pickedByMaterial = new Map<string, number>();
    for (const shop of shoppings) {
      const current = pickedByMaterial.get(shop.MaterialId) || 0;
      pickedByMaterial.set(shop.MaterialId, current + shop.QtyPick);
    }

    // Check if all materials are complete
    let totalQtyNeeded = 0;
    let totalQtyPicked = 0;

    for (const bom of bomEntries) {
      const qtyNeeded = forecast.Qty * bom.Qty;
      const qtyPicked = pickedByMaterial.get(bom.MaterialData.PartNumber) || 0;
      totalQtyNeeded += qtyNeeded;
      totalQtyPicked += qtyPicked;
    }

    const overallPercentage =
      totalQtyNeeded > 0
        ? Math.round((totalQtyPicked / totalQtyNeeded) * 100)
        : 0;

    return overallPercentage >= 100;
  }

  async getProductionStatus() {
    // Get only RELEASED production releases
    const releases = await this.prisma.productionRelease.findMany({
      where: {
        Status: ProductionStatus.RELEASED,
      },
      include: {
        Forecasts: {
          select: {
            PoId: true,
            FinishGoodId: true,
            Qty: true,
            DeliveryDate: true,
            PartData: {
              select: {
                PartNumber: true,
                PartName: true,
              },
            },
            Shopping: {
              select: {
                QtyPick: true,
              },
            },
          },
        },
        _count: {
          select: {
            LabelDatas: true,
            Forecasts: true,
          },
        },
      },
      orderBy: {
        PlanDate: 'desc',
      },
    });

    // Get all unique FinishGoodIds (PartNumber) from all releases
    const allFinishGoodPartNumbers = [
      ...new Set(
        releases.flatMap((r) => r.Forecasts.map((f) => f.FinishGoodId)),
      ),
    ];

    // Get BOM data - query via FinishGood.PartNumber since Forecast.FinishGoodId = PartNumber
    const bomData =
      allFinishGoodPartNumbers.length > 0
        ? await this.prisma.billOfMaterials.findMany({
            where: {
              FGData: {
                PartNumber: { in: allFinishGoodPartNumbers },
              },
            },
            select: {
              FinishGoodId: true,
              Qty: true,
            },
          })
        : [];

    // Group BOM by FinishGoodId (Int) and sum total material qty per 1 FG
    const bomByFgId = new Map<number, number>();
    for (const bom of bomData) {
      const current = bomByFgId.get(bom.FinishGoodId) || 0;
      bomByFgId.set(bom.FinishGoodId, current + bom.Qty);
    }

    // Get FinishGood data to map PartNumber (string) -> Id (Int)
    const finishGoods =
      allFinishGoodPartNumbers.length > 0
        ? await this.prisma.finishGood.findMany({
            where: { PartNumber: { in: allFinishGoodPartNumbers } },
            select: { Id: true, PartNumber: true },
          })
        : [];

    // Create map: PartNumber (string) -> total material qty per 1 FG
    const bomMap = new Map<string, number>();
    for (const fg of finishGoods) {
      const materialQty = bomByFgId.get(fg.Id) || 0;
      bomMap.set(fg.PartNumber, materialQty);
    }

    // Get delivery progress data (based on DeliveryHistory) and pokayoke progress (based on Scanned)
    const releaseIds = releases.map((r) => r.Id).filter(Boolean);

    // Get all LabelData for these releases
    const allLabelData = await this.prisma.labelData.findMany({
      where: {
        ProductionReleaseId: { in: releaseIds },
      },
      select: {
        Id: true,
        LabelNumber: true,
        ProductionReleaseId: true,
        Scanned: true,
      },
    });

    // Get delivered LabelData IDs (exist in DeliveryHistory)
    const deliveredLabelDataIds = await this.prisma.deliveryHistory.findMany({
      select: {
        LabelDataId: true,
      },
    });

    const deliveredSet = new Set(
      deliveredLabelDataIds.map((d) => d.LabelDataId).filter(Boolean),
    );

    // Group by ProductionReleaseId
    const deliveryMap = new Map<string, number>();
    const pokayokeScannedMap = new Map<string, number>();
    const totalLabelMap = new Map<string, number>();

    for (const label of allLabelData) {
      const releaseId = label.ProductionReleaseId;
      if (!releaseId) continue;

      // Total labels
      const currentTotal = totalLabelMap.get(releaseId) || 0;
      totalLabelMap.set(releaseId, currentTotal + 1);

      // Delivered labels (exist in DeliveryHistory)
      // Note: DeliveryHistory.LabelDataId stores LabelNumber (string), not LabelData.Id (integer)
      if (deliveredSet.has(label.LabelNumber)) {
        const currentDelivered = deliveryMap.get(releaseId) || 0;
        deliveryMap.set(releaseId, currentDelivered + 1);
      }

      // Pokayoke scanned labels (Scanned = true)
      if (label.Scanned) {
        const currentScanned = pokayokeScannedMap.get(releaseId) || 0;
        pokayokeScannedMap.set(releaseId, currentScanned + 1);
      }
    }

    // Calculate progress for each release
    const releasesWithProgress = releases.map((release) => {
      // Progress Shopping: based on BOM material requirements
      const totalMaterialNeeded = release.Forecasts.reduce((sum, forecast) => {
        const bomQtyPerFg = bomMap.get(forecast.FinishGoodId) || 0;
        return sum + forecast.Qty * bomQtyPerFg;
      }, 0);

      const totalShoppingQty = release.Forecasts.reduce(
        (sum, forecast) =>
          sum + forecast.Shopping.reduce((s, shop) => s + shop.QtyPick, 0),
        0,
      );

      // Progress Delivery: based on DeliveryHistory (labels that have been delivered)
      const totalLabels = totalLabelMap.get(release.Id) || 0;
      const deliveredLabels = deliveryMap.get(release.Id) || 0;

      // Progress Pokayoke: based on LabelData.Scanned (labels that have been scanned)
      const scannedLabels = pokayokeScannedMap.get(release.Id) || 0;

      return {
        ...release,
        TotalGoodQty: release.Forecasts.reduce((sum, f) => sum + f.Qty, 0),
        progressShopping: {
          totalPicked: totalShoppingQty,
          totalTarget: totalMaterialNeeded,
          percentage:
            totalMaterialNeeded > 0
              ? Math.round((totalShoppingQty / totalMaterialNeeded) * 100)
              : 0,
        },
        progressDelivery: {
          total: totalLabels,
          scanned: deliveredLabels,
          pending: totalLabels - deliveredLabels,
          percentage:
            totalLabels > 0
              ? Math.round((deliveredLabels / totalLabels) * 100)
              : 0,
        },
        progressPokayoke: {
          total: totalLabels,
          scanned: scannedLabels,
          pending: totalLabels - scannedLabels,
          percentage:
            totalLabels > 0
              ? Math.round((scannedLabels / totalLabels) * 100)
              : 0,
        },
      };
    });

    return releasesWithProgress;
  }

  async getNotifications() {
    // ========== NOTIFICATION 1: Forecasts without attachment ==========
    // Find forecasts that:
    // 1. Have no attachment (AttachmentDeliveryId is null)
    // 2. Are linked to a Production Release with COMPLETED status
    const forecastsWithoutAttachment = await this.prisma.forecast.findMany({
      where: {
        AttachmentDeliveryId: null,
        ProductionReleaseId: { not: null },
        ProductionRelease: {
          Status: ProductionStatus.RELEASED,
        },
      },
      select: {
        PoId: true,
        PoNumber: true,
        Qty: true,
        DeliveryDate: true,
        ProductionReleaseId: true,
        ProductionRelease: {
          select: {
            Id: true,
            ReleaseNumber: true,
            Status: true,
          },
        },
        PartData: {
          select: {
            PartNumber: true,
            PartName: true,
          },
        },
      },
    });

    // Count total PO without attachment
    const totalPOWithoutAttachment = forecastsWithoutAttachment.length;

    // Group by ProductionRelease
    const byProductionRelease = forecastsWithoutAttachment.reduce(
      (acc, forecast) => {
        const releaseId = forecast.ProductionReleaseId!;
        if (!acc[releaseId]) {
          acc[releaseId] = {
            releaseId,
            releaseNumber: forecast.ProductionRelease?.ReleaseNumber || '',
            status: forecast.ProductionRelease?.Status || '',
            count: 0,
            forecasts: [],
          };
        }
        acc[releaseId].count++;
        acc[releaseId].forecasts.push({
          poId: forecast.PoId,
          poNumber: forecast.PoNumber,
          partNumber: forecast.PartData?.PartNumber,
          partName: forecast.PartData?.PartName,
          qty: forecast.Qty,
          deliveryDate: forecast.DeliveryDate,
        });
        return acc;
      },
      {} as Record<
        string,
        {
          releaseId: string;
          releaseNumber: string;
          status: string;
          count: number;
          forecasts: {
            poId: string;
            poNumber: string;
            partNumber: string | null;
            partName: string | null;
            qty: number;
            deliveryDate: Date;
          }[];
        }
      >,
    );

    // ========== NOTIFICATION 2: Incoming not closed ==========
    // Find all Incoming records where Closed = false
    const incomingNotClosed = await this.prisma.incoming.findMany({
      where: {
        Closed: false,
      },
      select: {
        Id: true,
        PoId: true,
        Description: true,
        ReceivedBy: true,
        CreatedAt: true,
        SupplierData: {
          select: {
            Name: true,
          },
        },
      },
      orderBy: {
        CreatedAt: 'desc',
      },
    });

    const totalIncomingNotClosed = incomingNotClosed.length;

    // ========== NOTIFICATION 3: StockOpname in progress ==========
    const stockOpnameInProgress = await this.prisma.stockOpname.findMany({
      where: {
        Status: OpnameStatus.IN_PROGRESS,
      },
      select: {
        Id: true,
        OpnameNumber: true,
        Category: true,
        StartedAt: true,
      },
      orderBy: {
        StartedAt: 'desc',
      },
    });

    const totalStockOpnameInProgress = stockOpnameInProgress.length;

    // ========== NOTIFICATION 4: LabelData not scanned (RELEASED production + shopping complete) ==========
    // First get all LabelData with Scanned=false and RELEASED production
    const allLabelDataNotScanned = await this.prisma.labelData.findMany({
      where: {
        Scanned: false,
        ProductionRelease: {
          Status: ProductionStatus.RELEASED,
        },
      },
      select: {
        Id: true,
        LabelNumber: true,
        ForecastId: true,
        ProductionReleaseId: true,
        ProductionRelease: {
          select: {
            Id: true,
            ReleaseNumber: true,
          },
        },
      },
      orderBy: {
        Id: 'desc',
      },
    });

    // Filter to only include LabelData where the Forecast has complete shopping (100%)
    const labelDataNotScannedPromises = allLabelDataNotScanned.map(
      async (label) => {
        // Skip if no ForecastId
        if (!label.ForecastId) {
          return null;
        }

        const isComplete = await this.isShoppingComplete(label.ForecastId);
        if (!isComplete) {
          return null;
        }

        return label;
      },
    );

    const labelDataNotScannedResults = await Promise.all(
      labelDataNotScannedPromises,
    );

    const labelDataNotScanned = labelDataNotScannedResults.filter(
      (label): label is NonNullable<typeof label> => label !== null,
    );

    const totalLabelDataNotScanned = labelDataNotScanned.length;

    // ========== Build messages list ==========
    const messages: { menu: string; message: string }[] = [];

    // Messages for incoming not closed
    for (const inc of incomingNotClosed) {
      messages.push({
        menu: 'INCOMING',
        message: `DN ${inc.PoId} Not Approved Yet`,
      });
    }

    // Messages for forecasts without attachment
    for (const forecast of forecastsWithoutAttachment) {
      const releaseNumber =
        forecast.ProductionRelease?.ReleaseNumber || 'Unknown';
      messages.push({
        menu: 'PRODUCTION_PLAN',
        message: `Release ID : ${releaseNumber}, PO ${forecast.PoNumber || forecast.PoId} No Attachment Yet`,
      });
    }

    // Messages for stock opname in progress
    for (const opname of stockOpnameInProgress) {
      messages.push({
        menu: 'STOCK_OPNAME',
        message: `STOCK OPNAME ${opname.OpnameNumber} Still In Progress`,
      });
    }

    // Messages for label data not scanned
    for (const label of labelDataNotScanned) {
      const releaseNumber = label.ProductionRelease?.ReleaseNumber || 'Unknown';
      messages.push({
        menu: 'POKAYOKE',
        message: `Release ID : ${releaseNumber}, Label ${label.LabelNumber} Not Scanned Yet`,
      });
    }

    return {
      totalPOWithoutAttachment,
      byProductionRelease: Object.values(byProductionRelease),
      totalIncomingNotClosed,
      incomingNotClosed: incomingNotClosed.map((inc) => ({
        id: inc.Id,
        poId: inc.PoId,
        description: inc.Description,
        receivedBy: inc.ReceivedBy,
        supplierName: inc.SupplierData?.Name,
        createdAt: inc.CreatedAt,
      })),
      totalStockOpnameInProgress,
      stockOpnameInProgress: stockOpnameInProgress.map((opname) => ({
        id: opname.Id,
        opnameNumber: opname.OpnameNumber,
        category: opname.Category,
        startedAt: opname.StartedAt,
      })),
      totalLabelDataNotScanned,
      labelDataNotScanned: labelDataNotScanned.map((label) => ({
        id: label.Id,
        labelNumber: label.LabelNumber,
        releaseId: label.ProductionReleaseId,
        releaseNumber: label.ProductionRelease?.ReleaseNumber,
      })),
      messages,
    };
  }

  async getDashboard(): Promise<DashboardResponseEntity> {
    // Get current month date range
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(
      currentYear,
      currentMonth + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    // 1. Get summary counts in parallel
    const [
      totalMaterials,
      totalSuppliers,
      totalFinishGoods,
      totalManPower,
      incomingData,
      deliveryData,
      forecastData,
    ] = await Promise.all([
      // Count active materials
      this.prisma.material.count({
        where: { IsActive: true },
      }),
      // Count all suppliers
      this.prisma.supplier.count(),
      // Count all finish goods
      this.prisma.finishGood.count(),
      // Count active manpower
      this.prisma.manPower.count({
        where: { Status: true },
      }),
      // Get incoming materials for current month
      this.prisma.incomingMaterial.groupBy({
        by: ['IncomingId'],
        _sum: {
          Qty: true,
        },
        where: {
          IncomingData: {
            CreatedAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        },
      }),
      // Get delivery history for current month
      this.prisma.deliveryHistory.groupBy({
        by: ['ForecastId'],
        _sum: {
          Qty: true,
        },
        where: {
          CreatedAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
      // Get forecasts for current month (by DeliveryDate)
      this.prisma.forecast.findMany({
        where: {
          DeliveryDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        select: {
          DeliveryDate: true,
          Qty: true,
        },
      }),
    ]);

    // Calculate total incoming qty
    const totalIncomingQty = incomingData.reduce(
      (sum, item) => sum + (item._sum.Qty || 0),
      0,
    );

    // Calculate total delivery qty
    const totalDeliveryQty = deliveryData.reduce(
      (sum, item) => sum + (item._sum.Qty || 0),
      0,
    );

    // Build summary
    const summary: DashboardSummaryEntity = {
      totalMaterials,
      totalSuppliers,
      totalFinishGoods,
      totalManPower,
      totalIncomingQty,
      totalDeliveryQty,
    };

    // 2. Build forecast daily stats (every day of the month)
    const forecastByDay = new Map<
      number,
      { count: number; totalQty: number }
    >();
    for (const forecast of forecastData) {
      const day = forecast.DeliveryDate.getDate();
      const existing = forecastByDay.get(day) || { count: 0, totalQty: 0 };
      forecastByDay.set(day, {
        count: existing.count + 1,
        totalQty: existing.totalQty + forecast.Qty,
      });
    }

    const forecastDailyStats: DailyForecastStatEntity[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const data = forecastByDay.get(day) || { count: 0, totalQty: 0 };
      const dateStr = `${currentMonthStr}-${String(day).padStart(2, '0')}`;
      forecastDailyStats.push({
        date: dateStr,
        count: data.count,
        totalQty: data.totalQty,
      });
    }

    // 3. Build incoming daily stats (every day of the month)
    // Query incoming with date info for daily breakdown
    const incomingWithDates = await this.prisma.incoming.findMany({
      where: {
        CreatedAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      select: {
        CreatedAt: true,
        IncomingMaterial: {
          select: {
            Qty: true,
          },
        },
      },
    });

    const incomingDailyByDay = new Map<number, number>();
    for (const incoming of incomingWithDates) {
      const day = incoming.CreatedAt.getDate();
      const dayTotal = incoming.IncomingMaterial.reduce(
        (sum, mat) => sum + mat.Qty,
        0,
      );
      const existing = incomingDailyByDay.get(day) || 0;
      incomingDailyByDay.set(day, existing + dayTotal);
    }

    const incomingDailyStats: DailyIncomingStatEntity[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentMonthStr}-${String(day).padStart(2, '0')}`;
      incomingDailyStats.push({
        date: dateStr,
        totalQty: incomingDailyByDay.get(day) || 0,
      });
    }

    // 4. Build delivery daily stats (every day of the month)
    // Query delivery history with date info for daily breakdown
    const deliveryWithDates = await this.prisma.deliveryHistory.findMany({
      where: {
        CreatedAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      select: {
        CreatedAt: true,
        Qty: true,
      },
    });

    const deliveryDailyByDay = new Map<number, number>();
    for (const delivery of deliveryWithDates) {
      const day = delivery.CreatedAt.getDate();
      const existing = deliveryDailyByDay.get(day) || 0;
      deliveryDailyByDay.set(day, existing + delivery.Qty);
    }

    const deliveryDailyStats: DailyDeliveryStatEntity[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentMonthStr}-${String(day).padStart(2, '0')}`;
      deliveryDailyStats.push({
        date: dateStr,
        totalQty: deliveryDailyByDay.get(day) || 0,
      });
    }

    return {
      summary,
      forecastDailyStats,
      incomingDailyStats,
      deliveryDailyStats,
      currentMonth: currentMonthStr,
      daysInMonth,
    };
  }
}
