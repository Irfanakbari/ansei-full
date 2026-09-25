import { Injectable } from '@nestjs/common';
import moment from 'moment-timezone';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssemblyStatus,
  ItemCategory,
  MaterialNgCaseStatus,
  PokayokeCompareStatus,
  ProductionStatus,
  OpnameStatus,
} from '../generated/prisma/enums';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  DashboardResponseEntity,
  DashboardSummaryEntity,
  DailyForecastStatEntity,
  DailyIncomingStatEntity,
  DailyDeliveryStatEntity,
} from './entities/dashboard-response.entity';
import { FrontendFinishGoodEntity } from './entities/finish-good-list.entity';
import { FrontendManPowerEntity } from './entities/man-power-list.entity';
import { DisplayTargetEntity } from './entities/display-target.entity';
import { NotificationResponseEntity } from './entities/notification-response.entity';

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
        QtyThisBox: true,
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
    const scannedQtyMap = new Map<string, number>();
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
        const currentScannedQty = scannedQtyMap.get(releaseId) || 0;
        scannedQtyMap.set(releaseId, currentScannedQty + label.QtyThisBox);
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
        TotalGoodQty: scannedQtyMap.get(release.Id) || 0,
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

  async getNotifications(): Promise<NotificationResponseEntity> {
    const forecastsWithoutAttachmentQuery = this.prisma.forecast.findMany({
      where: {
        ProductionReleaseId: { not: null },
        ProductionRelease: {
          Status: ProductionStatus.RELEASED,
          IsNoAttachment: false,
          Attachments: { none: {} },
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

    const incomingNotClosedQuery = this.prisma.incoming.findMany({
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

    const stockOpnameInProgressQuery = this.prisma.stockOpname.findMany({
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

    const allLabelDataNotScannedQuery = this.prisma.labelData.findMany({
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

    const assemblyInProgressQuery = this.prisma.assemblySession.findMany({
      where: {
        Status: AssemblyStatus.IN_PROGRESS,
        LabelData: {
          ProductionRelease: { Status: ProductionStatus.RELEASED },
        },
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

    const [
      forecastsWithoutAttachment,
      incomingNotClosed,
      stockOpnameInProgress,
      allLabelDataNotScanned,
      assemblySessions,
    ] = await Promise.all([
      forecastsWithoutAttachmentQuery,
      incomingNotClosedQuery,
      stockOpnameInProgressQuery,
      allLabelDataNotScannedQuery,
      assemblyInProgressQuery,
    ]);

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
          partNumber: forecast.PartData?.PartNumber ?? null,
          partName: forecast.PartData?.PartName ?? null,
          qty: forecast.Qty,
          deliveryDate: forecast.DeliveryDate,
        });
        return acc;
      },
      {} as Record<
        string,
        NotificationResponseEntity['byProductionRelease'][number]
      >,
    );

    const forecastIds = [
      ...new Set(allLabelDataNotScanned.map((label) => label.ForecastId)),
    ];
    const shoppingCompletion = new Map(
      await Promise.all(
        forecastIds.map(
          async (forecastId) =>
            [forecastId, await this.isShoppingComplete(forecastId)] as const,
        ),
      ),
    );
    const labelDataNotScanned = allLabelDataNotScanned.filter((label) =>
      shoppingCompletion.get(label.ForecastId),
    );
    const assemblyInProgress = assemblySessions.map((session) => ({
      id: session.Id,
      labelNumber: session.LabelData.LabelNumber,
      finishGoodId: session.LabelData.FinishGoodId,
      releaseId: session.LabelData.ProductionReleaseId,
      releaseNumber: session.LabelData.ProductionRelease?.ReleaseNumber ?? null,
      startedAt: session.StartedAt,
    }));
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

    for (const session of assemblyInProgress) {
      messages.push({
        menu: 'ASSEMBLY',
        message: `Release ID : ${session.releaseNumber || 'Unknown'}, Label ${session.labelNumber} Assembly Still In Progress`,
      });
    }

    return {
      totalPOWithoutAttachment: forecastsWithoutAttachment.length,
      byProductionRelease: Object.values(byProductionRelease),
      totalIncomingNotClosed: incomingNotClosed.length,
      incomingNotClosed: incomingNotClosed.map((inc) => ({
        id: inc.Id,
        poId: inc.PoId,
        description: inc.Description,
        receivedBy: inc.ReceivedBy,
        supplierName: inc.SupplierData?.Name,
        createdAt: inc.CreatedAt,
      })),
      totalStockOpnameInProgress: stockOpnameInProgress.length,
      stockOpnameInProgress: stockOpnameInProgress.map((opname) => ({
        id: opname.Id,
        opnameNumber: opname.OpnameNumber,
        category: opname.Category,
        startedAt: opname.StartedAt,
      })),
      totalLabelDataNotScanned: labelDataNotScanned.length,
      labelDataNotScanned: labelDataNotScanned.map((label) => ({
        id: label.Id,
        labelNumber: label.LabelNumber,
        releaseId: label.ProductionReleaseId,
        releaseNumber: label.ProductionRelease?.ReleaseNumber,
      })),
      totalAssemblyInProgress: assemblyInProgress.length,
      assemblyInProgress,
      messages,
    };
  }

  async getDashboard(
    query: DashboardQueryDto = {},
  ): Promise<DashboardResponseEntity> {
    const timezone = 'Asia/Jakarta';
    const asOf = new Date();
    const plantNow = moment.tz(asOf, timezone);
    const year = query.year ?? plantNow.year();
    const month = query.month ?? plantNow.month() + 1;
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const periodStartMoment = moment.tz(`${period}-01`, 'YYYY-MM-DD', timezone);
    const periodEndMoment = periodStartMoment.clone().add(1, 'month');
    const periodStart = periodStartMoment.toDate();
    const periodEndExclusive = periodEndMoment.toDate();
    const plantToday = plantNow.clone().startOf('day').toDate();
    const range = { gte: periodStart, lt: periodEndExclusive };
    const [
      activeMaterials,
      suppliers,
      finishGoods,
      activeManpower,
      materials,
      ledger,
      opnames,
      forecasts,
      incoming,
      openIncomingCount,
      releases,
      reports,
      assemblies,
      labels,
      failedAttempts,
      deliveries,
      materialNgCases,
    ] = await Promise.all([
      this.prisma.material.count({ where: { IsActive: true } }),
      this.prisma.supplier.count(),
      this.prisma.finishGood.count(),
      this.prisma.manPower.count({ where: { Status: true } }),
      this.prisma.material.findMany({
        where: { IsActive: true },
        select: { PartNumber: true, PartName: true, MinimumStock: true },
      }),
      this.prisma.inventoryLedger.groupBy({
        by: ['MaterialId'],
        where: {
          ItemCategory: ItemCategory.MATERIAL,
          MaterialId: { not: null },
        },
        _sum: { QtyIn: true, QtyOut: true },
      }),
      this.prisma.stockOpname.findMany({
        where: { Status: OpnameStatus.IN_PROGRESS },
        select: {
          Id: true,
          OpnameNumber: true,
          Category: true,
          StartedAt: true,
          Details: { select: { ActualQty: true, ActualQtyRack: true } },
        },
        orderBy: { StartedAt: 'desc' },
      }),
      this.prisma.forecast.findMany({
        where: { DeliveryDate: range },
        select: {
          PoId: true,
          Qty: true,
          DeliveryDate: true,
          ProductionReleaseId: true,
          FinishGoodId: true,
          PartData: { select: { PartNumber: true, PartName: true } },
        },
      }),
      this.prisma.incoming.findMany({
        where: {
          OR: [{ Closed: true, ApprovedAt: range }, { CreatedAt: range }],
        },
        select: {
          Id: true,
          PoId: true,
          ApprovedAt: true,
          CreatedAt: true,
          Closed: true,
          SupplierId: true,
          SupplierData: { select: { Id: true, Name: true } },
          IncomingMaterial: {
            select: {
              Qty: true,
              QtyChecked: true,
              MaterialId: true,
              MaterialData: { select: { PartNumber: true, PartName: true } },
            },
          },
        },
        orderBy: { CreatedAt: 'desc' },
      }),
      this.prisma.incoming.count({ where: { Closed: false } }),
      this.prisma.productionRelease.findMany({
        where: { PlanDate: range },
        select: {
          Id: true,
          ReleaseNumber: true,
          PlanDate: true,
          Status: true,
          TotalTargetQty: true,
          Forecasts: {
            select: {
              PoId: true,
              FinishGoodId: true,
              Qty: true,
            },
          },
          LabelDatas: {
            select: {
              LabelNumber: true,
              Scanned: true,
              QtyThisBox: true,
              RequiresAssembly: true,
              AssemblySessions: {
                where: { Status: AssemblyStatus.COMPLETED },
                select: { Id: true },
              },
            },
          },
        },
        orderBy: { PlanDate: 'desc' },
      }),
      this.prisma.productionReport.findMany({
        where: { ProductionStamp: range },
        select: {
          ProductionStamp: true,
          Qty: true,
          NgQty: true,
          ValidatedAt: true,
          FinishGoodId: true,
        },
      }),
      this.prisma.assemblySession.findMany({
        where: { StartedAt: range },
        select: { Status: true },
      }),
      this.prisma.labelData.findMany({
        where: { ProductionRelease: { PlanDate: range } },
        select: { LabelNumber: true, Scanned: true },
      }),
      this.prisma.pokayokeScanHistory.count({
        where: { CreatedAt: range, Status: PokayokeCompareStatus.GAGAL },
      }),
      this.prisma.deliveryHistory.findMany({
        where: { CreatedAt: range },
        select: { ForecastId: true, Qty: true, CreatedAt: true },
      }),
      this.prisma.materialNgCase.findMany({
        where: { CreatedAt: range },
        select: {
          Status: true,
          CreatedAt: true,
          CaseNumber: true,
          Reason: true,
          Details: {
            select: {
              ReplacementRequestedQty: true,
              Replacements: { select: { QtyPick: true } },
            },
          },
        },
      }),
    ]);
    const forecastIds = [
      ...new Set([
        ...forecasts.map((item) => item.PoId),
        ...releases.flatMap((release) =>
          release.Forecasts.map((item) => item.PoId),
        ),
      ]),
    ];
    const lifetimeDeliveries = forecastIds.length
      ? await this.prisma.deliveryHistory.groupBy({
          by: ['ForecastId'],
          where: { ForecastId: { in: forecastIds } },
          _sum: { Qty: true },
        })
      : [];
    const shoppingCompletions = forecastIds.length
      ? await this.prisma.shoppingCompletion.findMany({
          where: { ForecastId: { in: forecastIds } },
          select: { ForecastId: true },
        })
      : [];
    const completedShoppingForecastIds = new Set(
      shoppingCompletions.map((item) => item.ForecastId),
    );
    const deliveredByForecast = new Map(
      lifetimeDeliveries.map((item) => [item.ForecastId, item._sum.Qty ?? 0]),
    );
    const stockByPart = new Map(
      ledger.map((item) => [
        item.MaterialId!,
        (item._sum.QtyIn ?? 0) - (item._sum.QtyOut ?? 0),
      ]),
    );
    const allInventoryRisk = materials
      .map((material) => {
        const totalStock = stockByPart.get(material.PartNumber) ?? 0;
        const status =
          totalStock < 0
            ? ('NEGATIVE' as const)
            : totalStock === 0
              ? ('OUT' as const)
              : totalStock <= material.MinimumStock
                ? ('LOW' as const)
                : null;
        return status
          ? {
              partNumber: material.PartNumber,
              partName: material.PartName,
              totalStock,
              minimumStock: material.MinimumStock,
              shortageQty: Math.max(material.MinimumStock - totalStock, 0),
              status,
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort(
        (a, b) => b.shortageQty - a.shortageQty || a.totalStock - b.totalStock,
      );
    const inventoryRisk = allInventoryRisk.slice(0, 8);
    const approvedIncoming = incoming.filter(
      (doc) =>
        doc.Closed !== false &&
        doc.ApprovedAt &&
        doc.ApprovedAt >= periodStart &&
        doc.ApprovedAt < periodEndExclusive,
    );
    const incomingQty = approvedIncoming.reduce(
      (sum, document) =>
        sum +
        document.IncomingMaterial.reduce(
          (value, item) => value + (item.Qty ?? 0),
          0,
        ),
      0,
    );
    const activeSupplierCount = new Set(
      approvedIncoming.map((item) => item.SupplierId),
    ).size;
    const forecastQty = forecasts.reduce((sum, item) => sum + item.Qty, 0);
    const deliveredQty = forecasts.reduce(
      (sum, item) =>
        sum + Math.min(deliveredByForecast.get(item.PoId) ?? 0, item.Qty),
      0,
    );
    const reportedQty = reports.reduce((sum, item) => sum + item.Qty, 0);
    const reportedNgQty = reports.reduce((sum, item) => sum + item.NgQty, 0);
    const reportedGoodQty = reports.reduce(
      (sum, item) => sum + Math.max(item.Qty - item.NgQty, 0),
      0,
    );
    const releaseCountsByStatus = Object.values(ProductionStatus).reduce<
      Record<string, number>
    >(
      (result, status) => ({
        ...result,
        [status]: releases.filter((release) => release.Status === status)
          .length,
      }),
      {},
    );
    const activeReleases = releases.filter(
      (release) => release.Status === ProductionStatus.RELEASED,
    );
    const releasePipeline = activeReleases.slice(0, 10).map((release) => {
      const targetQty = release.Forecasts.reduce(
        (sum, item) => sum + item.Qty,
        0,
      );
      const completedForecasts = release.Forecasts.filter((item) =>
        completedShoppingForecastIds.has(item.PoId),
      ).length;
      const scanned = release.LabelDatas.filter((item) => item.Scanned).length;
      const assemblyRequired = release.LabelDatas.filter(
        (item) => item.RequiresAssembly === true,
      );
      const assemblyRequiredQty = assemblyRequired.reduce(
        (sum, item) => sum + item.QtyThisBox,
        0,
      );
      const assemblyCompletedQty = assemblyRequired
        .filter((item) => item.AssemblySessions.length > 0)
        .reduce((sum, item) => sum + item.QtyThisBox, 0);
      const delivered = release.Forecasts.reduce(
        (sum, item) =>
          sum + Math.min(deliveredByForecast.get(item.PoId) ?? 0, item.Qty),
        0,
      );
      return {
        releaseId: release.Id,
        releaseNumber: release.ReleaseNumber,
        planDate: release.PlanDate,
        status: release.Status,
        targetQty,
        shoppingPct: release.Forecasts.length
          ? (completedForecasts / release.Forecasts.length) * 100
          : null,
        assemblyPct: release.LabelDatas.length
          ? assemblyRequired.length
            ? assemblyRequiredQty > 0
              ? (assemblyCompletedQty / assemblyRequiredQty) * 100
              : 0
            : 100
          : null,
        pokayokePct: release.LabelDatas.length
          ? (scanned / release.LabelDatas.length) * 100
          : null,
        deliveryPct: targetQty
          ? Math.min((delivered / targetQty) * 100, 100)
          : null,
      };
    });
    const dailyMap = new Map<
      string,
      {
        demandQty: number;
        approvedIncomingMaterialQty: number;
        approvedIncomingDocumentCount: number;
        reportedGoodQty: number;
        deliveredQty: number;
        reportedNgQty: number;
      }
    >();
    for (
      const cursor = periodStartMoment.clone();
      cursor.isBefore(periodEndMoment);
      cursor.add(1, 'day')
    )
      dailyMap.set(cursor.format('YYYY-MM-DD'), {
        demandQty: 0,
        approvedIncomingMaterialQty: 0,
        approvedIncomingDocumentCount: 0,
        reportedGoodQty: 0,
        deliveredQty: 0,
        reportedNgQty: 0,
      });
    const dayKey = (date: Date) =>
      moment.tz(date, timezone).format('YYYY-MM-DD');
    forecasts.forEach((item) => {
      const day = dailyMap.get(dayKey(item.DeliveryDate));
      if (day) day.demandQty += item.Qty;
    });
    approvedIncoming.forEach((item) => {
      if (item.ApprovedAt) {
        const day = dailyMap.get(dayKey(item.ApprovedAt));
        if (day) {
          day.approvedIncomingMaterialQty += item.IncomingMaterial.reduce(
            (sum, material) => sum + (material.Qty ?? 0),
            0,
          );
          day.approvedIncomingDocumentCount += 1;
        }
      }
    });
    reports.forEach((item) => {
      const day = dailyMap.get(dayKey(item.ProductionStamp))!;
      day.reportedGoodQty += Math.max(item.Qty - item.NgQty, 0);
      day.reportedNgQty += item.NgQty;
    });
    deliveries
      .filter(
        (item) =>
          item.CreatedAt >= periodStart && item.CreatedAt < periodEndExclusive,
      )
      .forEach((item) => {
        dailyMap.get(dayKey(item.CreatedAt))!.deliveredQty += item.Qty;
      });
    const daily = [...dailyMap].map(([date, values]) => ({ date, ...values }));
    const topPartsMap = new Map<
      string,
      {
        partNumber: string;
        partName: string;
        demandQty: number;
        deliveredQty: number;
        ngQty: number;
      }
    >();
    forecasts.forEach((item) =>
      topPartsMap.set(item.FinishGoodId, {
        partNumber: item.PartData.PartNumber,
        partName: item.PartData.PartName,
        demandQty:
          item.Qty + (topPartsMap.get(item.FinishGoodId)?.demandQty ?? 0),
        deliveredQty:
          (topPartsMap.get(item.FinishGoodId)?.deliveredQty ?? 0) +
          Math.min(deliveredByForecast.get(item.PoId) ?? 0, item.Qty),
        ngQty: 0,
      }),
    );
    reports.forEach((item) => {
      const part = topPartsMap.get(item.FinishGoodId);
      if (part) part.ngQty += item.NgQty;
    });
    const topParts = [...topPartsMap.values()]
      .sort((a, b) => b.demandQty - a.demandQty)
      .slice(0, 8);

    const topSuppliersMap = new Map<
      number,
      {
        supplierId: number;
        supplierName: string;
        documentCount: number;
        totalQty: number;
      }
    >();
    const topIncomingMaterialsMap = new Map<
      string,
      {
        partNumber: string;
        partName: string;
        totalQty: number;
      }
    >();

    incoming.forEach((doc) => {
      const supplierId = doc.SupplierId;
      const supplierName = doc.SupplierData?.Name ?? `Supplier #${supplierId}`;
      const docQty = doc.IncomingMaterial.reduce((s, m) => s + (m.Qty ?? 0), 0);
      const currentSup = topSuppliersMap.get(supplierId) || {
        supplierId,
        supplierName,
        documentCount: 0,
        totalQty: 0,
      };
      currentSup.documentCount += 1;
      currentSup.totalQty += docQty;
      topSuppliersMap.set(supplierId, currentSup);

      doc.IncomingMaterial.forEach((mat) => {
        const partNumber =
          mat.MaterialData?.PartNumber ??
          (mat.MaterialId ? String(mat.MaterialId) : 'Unknown');
        const partName = mat.MaterialData?.PartName ?? partNumber;
        const currentMat = topIncomingMaterialsMap.get(partNumber) || {
          partNumber,
          partName,
          totalQty: 0,
        };
        currentMat.totalQty += mat.Qty ?? 0;
        topIncomingMaterialsMap.set(partNumber, currentMat);
      });
    });

    const topSuppliers = [...topSuppliersMap.values()]
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 8);

    const topIncomingMaterials = [...topIncomingMaterialsMap.values()]
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 8);

    const recentIncoming = incoming.slice(0, 8).map((doc) => ({
      id: doc.Id,
      poId: doc.PoId,
      supplierName: doc.SupplierData?.Name ?? `Supplier #${doc.SupplierId}`,
      approvedAt: doc.ApprovedAt,
      createdAt: doc.CreatedAt,
      closed: doc.Closed,
      totalQty: doc.IncomingMaterial.reduce((s, m) => s + (m.Qty ?? 0), 0),
      materialCount: doc.IncomingMaterial.length,
    }));
    const overdue = forecasts.filter(
      (item) =>
        item.DeliveryDate < plantToday &&
        (deliveredByForecast.get(item.PoId) ?? 0) < item.Qty,
    );
    const openMaterialNg = materialNgCases.filter(
      (item) => item.Status === MaterialNgCaseStatus.OPEN,
    );
    const pendingLabels = labels.filter((item) => !item.Scanned).length;
    const unvalidatedReports = reports.filter(
      (item) => item.ValidatedAt === null,
    ).length;
    const exceptions = [
      ...overdue.map((item) => ({
        type: 'OVERDUE_DELIVERY',
        title: item.PoId,
        description: `${item.PartData.PartNumber} has ${item.Qty - (deliveredByForecast.get(item.PoId) ?? 0)} open`,
        occurredAt: item.DeliveryDate,
        route: '/apps/production/delivery',
        severity: 'HIGH' as const,
      })),
      ...openMaterialNg.map((item) => ({
        type: 'MATERIAL_NG',
        title: item.CaseNumber,
        description: item.Reason,
        occurredAt: item.CreatedAt,
        route: '/apps/production/material-ng',
        severity: 'MEDIUM' as const,
      })),
    ]
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 10);
    const freeze = (category: string) =>
      opnames
        .filter((item) => item.Category === category)
        .map((item) => ({
          id: item.Id,
          opnameNumber: item.OpnameNumber,
          startedAt: item.StartedAt,
          progress: item.Details.length
            ? (item.Details.filter(
                (detail) =>
                  detail.ActualQty !== null || detail.ActualQtyRack !== null,
              ).length /
                item.Details.length) *
              100
            : 0,
        }));
    const outstandingReplacementQty = openMaterialNg.reduce(
      (sum, item) =>
        sum +
        item.Details.reduce(
          (lineSum, line) =>
            lineSum +
            Math.max(
              line.ReplacementRequestedQty -
                line.Replacements.reduce(
                  (replacementSum, replacement) =>
                    replacementSum + replacement.QtyPick,
                  0,
                ),
              0,
            ),
          0,
        ),
      0,
    );
    const summary: DashboardSummaryEntity = {
      totalMaterials: activeMaterials,
      totalSuppliers: suppliers,
      totalFinishGoods: finishGoods,
      totalManPower: activeManpower,
      totalIncomingQty: incomingQty,
      totalDeliveryQty: deliveredQty,
    };
    return {
      meta: {
        period,
        timezone,
        periodStart,
        periodEndExclusive,
        asOf,
        productionOutputMetric: 'reportedGoodQty',
      },
      currentSnapshot: {
        masterData: { activeMaterials, suppliers, finishGoods, activeManpower },
        inventory: {
          outOfStockPartCount: allInventoryRisk.filter(
            (item) => item.status === 'OUT',
          ).length,
          lowStockPartCount: allInventoryRisk.filter(
            (item) => item.status === 'LOW',
          ).length,
          negativeBalancePartCount: allInventoryRisk.filter(
            (item) => item.status === 'NEGATIVE',
          ).length,
        },
        freezes: {
          activeMaterial: freeze(ItemCategory.MATERIAL),
          activeFinishGood: freeze(ItemCategory.FINISH_GOOD),
        },
        openExceptions: {
          overdueForecastCount: overdue.length,
          openIncomingCount,
          unvalidatedReportCount: unvalidatedReports,
          pendingLabelCount: pendingLabels,
          openMaterialNgCaseCount: openMaterialNg.length,
        },
      },
      monthly: {
        demand: {
          forecastCount: forecasts.length,
          forecastQty,
          unscheduledCount: forecasts.filter(
            (item) => !item.ProductionReleaseId,
          ).length,
          unscheduledQty: forecasts
            .filter((item) => !item.ProductionReleaseId)
            .reduce((sum, item) => sum + item.Qty, 0),
          releasedQty: forecasts
            .filter((item) => item.ProductionReleaseId)
            .reduce((sum, item) => sum + item.Qty, 0),
        },
        incoming: {
          approvedDocumentCount: approvedIncoming.length,
          approvedMaterialQty: incomingQty,
          openDocumentCount: openIncomingCount,
          activeSupplierCount,
        },
        production: {
          releaseCountsByStatus,
          targetQty: releases.reduce(
            (sum, item) => sum + item.TotalTargetQty,
            0,
          ),
          scannedGoodQty: releases.reduce(
            (sum, item) =>
              sum +
              item.LabelDatas.filter((label) => label.Scanned).reduce(
                (value, label) => value + label.QtyThisBox,
                0,
              ),
            0,
          ),
          productionAttainmentPct: forecastQty
            ? (reportedGoodQty / forecastQty) * 100
            : null,
          reportedQty,
          reportedNgQty,
          ngRatePct: reportedQty ? (reportedNgQty / reportedQty) * 100 : null,
          unvalidatedReportCount: unvalidatedReports,
        },
        assembly: {
          inProgress: assemblies.filter(
            (item) => item.Status === AssemblyStatus.IN_PROGRESS,
          ).length,
          completed: assemblies.filter(
            (item) => item.Status === AssemblyStatus.COMPLETED,
          ).length,
          cancelled: assemblies.filter(
            (item) => item.Status === AssemblyStatus.CANCELLED,
          ).length,
        },
        pokayoke: {
          scannedLabels: labels.length - pendingLabels,
          pendingLabels,
          failedAttempts,
        },
        delivery: {
          deliveredQty,
          attainmentPct: forecastQty
            ? (deliveredQty / forecastQty) * 100
            : null,
          overdueForecastCount: overdue.length,
          overdueOpenQty: overdue.reduce(
            (sum, item) =>
              sum + item.Qty - (deliveredByForecast.get(item.PoId) ?? 0),
            0,
          ),
        },
        materialNg: {
          openCaseCount: openMaterialNg.length,
          outstandingReplacementQty,
        },
      },
      daily,
      releasePipeline,
      inventoryRisk,
      topParts,
      topSuppliers,
      topIncomingMaterials,
      recentIncoming,
      exceptions,
      summary,
      forecastDailyStats: daily.map((item) => ({
        date: item.date,
        count: forecasts.filter(
          (forecast) => dayKey(forecast.DeliveryDate) === item.date,
        ).length,
        totalQty: item.demandQty,
      })),
      incomingDailyStats: daily.map((item) => ({
        date: item.date,
        count: item.approvedIncomingDocumentCount,
        totalQty: item.approvedIncomingMaterialQty,
      })),
      deliveryDailyStats: daily.map((item) => ({
        date: item.date,
        totalQty: item.deliveredQty,
      })),
      currentMonth: period,
      daysInMonth: daily.length,
    };
  }

  /**
   * Get list of finish goods (PartNumber, PartName, Alias)
   */
  async getFinishGoodsList(): Promise<FrontendFinishGoodEntity[]> {
    return this.prisma.finishGood.findMany({
      select: {
        PartNumber: true,
        PartName: true,
        Alias: true,
      },
      orderBy: { PartNumber: 'asc' },
    });
  }

  async getDisplayTarget(partNumber: string): Promise<DisplayTargetEntity> {
    const finishGood = await this.prisma.finishGood.findUnique({
      where: { PartNumber: partNumber },
      select: {
        PartNumber: true,
        PartName: true,
        Alias: true,
      },
    });

    const activeRelease = await this.prisma.productionRelease.findFirst({
      where: { Status: ProductionStatus.RELEASED },
      select: {
        Id: true,
        ReleaseNumber: true,
        Forecasts: {
          where: { FinishGoodId: partNumber },
          select: { Qty: true },
        },
      },
      orderBy: { PlanDate: 'desc' },
    });

    return {
      partNumber,
      partName: finishGood?.PartName ?? '',
      alias: finishGood?.Alias ?? null,
      targetQty:
        activeRelease?.Forecasts.reduce(
          (total, forecast) => total + forecast.Qty,
          0,
        ) ?? 0,
      productionReleaseId: activeRelease?.Id ?? null,
      releaseNumber: activeRelease?.ReleaseNumber ?? null,
    };
  }

  /**
   * Get list of active manpower (Nik, Name, PicturePath, Line)
   */
  async getManPowerList(): Promise<FrontendManPowerEntity[]> {
    return this.prisma.manPower.findMany({
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
  }
}
