import { decorateSapReleaseDocuments } from '../../common/sap/sap-document-summary';
import { captureSapDemand } from '../../common/sap/sap-transaction-capture';
import { forecastCandidateWhere } from './forecast-candidates';
import {
  auditedTransaction,
  auditedWrite,
} from '../../common/helpers/audited-transaction.helper';
import {
  snapshotRelease,
  latestSnapshot,
} from '../../common/helpers/bom-snapshot.helper';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NasUploadService } from '../../common/utils/nas-upload.service';
import {
  CreateProductionReleaseDto,
  UpdateProductionReleaseDto,
  UploadProductionAttachmentDto,
  ProductionReleaseQueryDto,
  CancelProductionReleaseDto,
  AmendProductionReleaseForecastsDto,
  ProductionReleaseForecastCandidatesQueryDto,
  RequestAutocompleteOtpDto,
  ExecuteAutocompleteDto,
} from './dto';
import {
  AutocompleteApproverEntity,
  RequestAutocompleteOtpResponseEntity,
  ExecuteAutocompleteResponseEntity,
} from './entities';
import type { LogProcessModel } from '../../generated/prisma/models';
import {
  ProductionStatus,
  ApprovalChallengeStatus,
  PokayokeCompareStatus,
} from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';
import { assertNoActiveInventoryCounting } from '../../common/helpers/inventory-counting-check.helper';
import {
  randomUUID,
  randomInt,
  createHash,
  timingSafeEqual,
} from 'node:crypto';
import { validateUploadContent } from '../../common/utils/upload-security.util';
import {
  buildProductionLabels,
  lockProductionFlow,
} from '../../common/helpers/production-flow.helper';
import { ShoppingService } from '../shopping/shopping.service';
import { AssemblyService } from '../assembly/assembly.service';
import { PokayokeService } from '../pokayoke/pokayoke.service';
import { DeliveryService } from '../delivery/delivery.service';
import { FonnteService } from '../../common/utils/fonnte.service';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

// Allowed file extensions and max size
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function requiresAssemblyCompletion(label: {
  RequiresAssembly: boolean | null;
  BypassAssembly: boolean;
}): boolean {
  return label.RequiresAssembly === true && !label.BypassAssembly;
}

@Injectable()
export class ProductionReleaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
    private readonly nasUploadService: NasUploadService,
    private readonly shoppingService: ShoppingService,
    private readonly assemblyService: AssemblyService,
    private readonly pokayokeService: PokayokeService,
    private readonly deliveryService: DeliveryService,
    private readonly fonnteService: FonnteService,
  ) {}

  private selectionIds(
    dto: { forecastIds?: string[]; demandIds?: string[] },
    required: true,
  ): string[];
  private selectionIds(
    dto: { forecastIds?: string[]; demandIds?: string[] },
    required: false,
  ): string[] | undefined;
  private selectionIds(
    dto: { forecastIds?: string[]; demandIds?: string[] },
    required: boolean,
  ) {
    if (dto.forecastIds !== undefined && dto.demandIds !== undefined)
      throw new BadRequestException(
        'Send demandIds or legacy forecastIds, not both.',
      );
    const ids = dto.demandIds ?? dto.forecastIds;
    if (ids === undefined && !required) return undefined;
    if (!ids?.length || ids.some((id) => !id.trim()))
      throw new BadRequestException('Select at least one production order.');
    return [...new Set(ids)];
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private isReleaseNumberUniqueConstraintError(error: unknown): boolean {
    if (!this.isUniqueConstraintError(error)) return false;
    const target = error.meta?.target;
    return Array.isArray(target)
      ? target.includes('ReleaseNumber')
      : String(target).includes('ReleaseNumber');
  }

  private releaseConflict(error: unknown): never {
    if (this.isReleaseNumberUniqueConstraintError(error)) {
      throw new ConflictException('Production release number already exists.');
    }
    if (this.isUniqueConstraintError(error)) {
      if (
        String(error.meta?.target).includes(
          'ProductionRelease_one_released_key',
        )
      ) {
        throw new ConflictException(
          'Cannot start this production release because another release is still active. Only one release can be active at a time. Open Production Release and complete the active release before starting this one.',
        );
      }
      throw new ConflictException(
        'Production release conflicts with current database state. Refresh and try again.',
      );
    }
    throw error;
  }

  private async generateReleaseNumber(
    tx: Prisma.TransactionClient,
    planDate: Date,
  ): Promise<string> {
    const year = planDate.getUTCFullYear();
    const month = String(planDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(planDate.getUTCDate()).padStart(2, '0');
    const prefix = `PR-${year}${month}${day}-`;

    const latest = await tx.productionRelease.findFirst({
      where: { ReleaseNumber: { startsWith: prefix } },
      orderBy: { ReleaseNumber: 'desc' },
      select: { ReleaseNumber: true },
    });

    const lastSequence = latest
      ? Number.parseInt(latest.ReleaseNumber.slice(prefix.length), 10)
      : 0;

    return `${prefix}${String((Number.isNaN(lastSequence) ? 0 : lastSequence) + 1).padStart(3, '0')}`;
  }

  async findAll(query: ProductionReleaseQueryDto) {
    const where: Prisma.ProductionReleaseWhereInput = {
      ...(query.status ? { Status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                ReleaseNumber: { contains: query.search, mode: 'insensitive' },
              },
              { Notes: { contains: query.search, mode: 'insensitive' } },
              { CreatedBy: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [totalItems, releases] = await Promise.all([
      this.prisma.productionRelease.count({ where }),
      this.prisma.productionRelease.findMany({
        where,
        include: {
          Forecasts: {
            select: {
              PoId: true,
              FinishGoodId: true,
              Qty: true,
              DeliveryDate: true,
              DeliveryPeriod: true,
              PartData: {
                select: {
                  PartNumber: true,
                  PartName: true,
                },
              },
              Shopping: {
                where: { Purpose: 'STANDARD' },
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
              Attachments: true,
            },
          },
          // DeliveryAttachment: {
          //   select: {
          //     id: true,
          //     FileName: true,
          //     FilePath: true,
          //     CreatedAt: true,
          //     CreatedBy: true,
          //   },
          //   orderBy: {
          //     CreatedAt: 'desc',
          //   },
          // },
        },
        orderBy: [{ PlanDate: 'desc' }, { Id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    // Get all unique FinishGoodIds (PartNumber) from all releases
    const allFinishGoodPartNumbers = [
      ...new Set(
        releases.flatMap((r) => r.Forecasts.map((f) => f.FinishGoodId)),
      ),
    ];

    // Get BOM data - query via FinishGood.PartNumber since Forecast.FinishGoodId = PartNumber
    // BillOfMaterials has FinishGoodId (Int), but we need to match via FinishGood.PartNumber
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

    const orderSnapshots = new Map(
      await Promise.all(
        releases.flatMap((r) =>
          r.Forecasts.map(
            async (f) =>
              [
                f.PoId,
                await latestSnapshot(this.prisma, f.PoId, r.Id),
              ] as const,
          ),
        ),
      ),
    );
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
        RequiresAssembly: true,
        AssemblySessions: {
          where: { Status: 'COMPLETED' },
          select: { Id: true },
          take: 1,
        },
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

    // Calculate TotalGoodQty from scanned labels (LabelData.Scanned = true, sum QtyThisBox)
    const scannedGoodQtyMap = new Map<string, number>();

    for (const label of allLabelData) {
      const releaseId = label.ProductionReleaseId;
      if (!releaseId || !label.Scanned) continue;

      const current = scannedGoodQtyMap.get(releaseId) || 0;
      scannedGoodQtyMap.set(releaseId, current + label.QtyThisBox);
    }

    // Calculate progress for each release
    const releasesWithProgress = releases.map((release) => {
      // TotalGoodQty: sum of QtyThisBox from scanned labels (barang yang sudah jadi/finished goods)
      const totalGoodQty = scannedGoodQtyMap.get(release.Id) || 0;

      // Progress Shopping: based on BOM material requirements
      const totalMaterialNeeded = release.Forecasts.reduce((sum, forecast) => {
        const saved = orderSnapshots.get(forecast.PoId);
        const bomQtyPerFg = saved
          ? saved.Lines.reduce((n, l) => n + l.QtyPerUnit, 0)
          : release.Status === 'DRAFT'
            ? bomMap.get(forecast.FinishGoodId) || 0
            : 0;
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

      const releaseLabels = allLabelData.filter(
        (label) => label.ProductionReleaseId === release.Id,
      );
      const assemblyLabels = releaseLabels.filter(
        (label) => label.RequiresAssembly === true,
      );
      const assembledLabels = assemblyLabels.filter(
        (label) => label.AssemblySessions.length > 0,
      ).length;
      const shoppingPercentage =
        totalMaterialNeeded > 0
          ? Math.min(
              100,
              Math.round((totalShoppingQty / totalMaterialNeeded) * 100),
            )
          : 0;
      const deliveryPercentage =
        totalLabels > 0
          ? Math.min(100, Math.round((deliveredLabels / totalLabels) * 100))
          : 0;
      const pokayokePercentage =
        totalLabels > 0
          ? Math.min(100, Math.round((scannedLabels / totalLabels) * 100))
          : 0;
      const assemblyPercentage =
        assemblyLabels.length > 0
          ? Math.round((assembledLabels / assemblyLabels.length) * 100)
          : 0;
      const stagePercentages = [
        shoppingPercentage,
        pokayokePercentage,
        deliveryPercentage,
        ...(assemblyLabels.length > 0 ? [assemblyPercentage] : []),
      ];
      const overallPercentage = Math.round(
        stagePercentages.reduce((sum, percentage) => sum + percentage, 0) /
          stagePercentages.length,
      );

      return {
        ...release,
        TotalGoodQty: totalGoodQty,
        progressShopping: {
          totalPicked: totalShoppingQty,
          totalTarget: totalMaterialNeeded,
          percentage: shoppingPercentage,
        },
        progressDelivery: {
          total: totalLabels,
          scanned: deliveredLabels,
          pending: totalLabels - deliveredLabels,
          percentage: deliveryPercentage,
        },
        progressPokayoke: {
          total: totalLabels,
          scanned: scannedLabels,
          pending: totalLabels - scannedLabels,
          percentage: pokayokePercentage,
        },
        progressAssembly: {
          required: assemblyLabels.length > 0,
          total: assemblyLabels.length,
          completed: assembledLabels,
          pending: assemblyLabels.length - assembledLabels,
          percentage: assemblyPercentage,
        },
        progressOverall: {
          percentage: overallPercentage,
          stageCount: stagePercentages.length,
        },
      };
    });

    return {
      data: await decorateSapReleaseDocuments(
        this.prisma,
        releasesWithProgress,
      ),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }

  async findOne(id: string) {
    const release = await this.prisma.productionRelease.findUnique({
      where: { Id: id },
      include: {
        Forecasts: {
          include: {
            BomSnapshots: {
              select: {
                Id: true,
                Version: true,
                RevisionId: true,
                CreatedAt: true,
              },
              orderBy: { CreatedAt: 'desc' },
              take: 1,
            },
            PartData: {
              select: {
                PartNumber: true,
                PartName: true,
              },
            },
            Shopping: {
              where: { Purpose: 'STANDARD' },
              select: {
                Id: true,
                QtyPick: true,
              },
            },
          },
        },
        LabelDatas: {
          select: {
            Id: true,
            LabelNumber: true,
            FinishGoodId: true,
            ProductionDemandId: true,
            Scanned: true,
            QtyThisBox: true,
          },
          orderBy: {
            LabelNumber: 'asc',
          },
        },
        Attachments: {
          orderBy: {
            CreatedAt: 'desc',
          },
        },
      },
    });

    if (!release) {
      throw new NotFoundException(`ProductionRelease with id ${id} not found`);
    }

    const totalGoodQty = (release.LabelDatas ?? []).reduce(
      (sum, label) => sum + (label.Scanned ? label.QtyThisBox : 0),
      0,
    );

    return (
      await decorateSapReleaseDocuments(this.prisma, [
        {
          ...release,
          TotalGoodQty: totalGoodQty,
        },
      ])
    )[0];
  }

  async getForecastCandidates(
    id: string,
    query: ProductionReleaseForecastCandidatesQueryDto,
  ) {
    const release = await this.prisma.productionRelease.findUnique({
      where: { Id: id },
      select: { Status: true, SourceType: true },
    });
    if (!release)
      throw new NotFoundException(`ProductionRelease with id ${id} not found`);
    if (
      release.Status !== ProductionStatus.DRAFT &&
      release.Status !== ProductionStatus.RELEASED
    )
      throw new ConflictException(
        'Forecasts can only be managed for a DRAFT or RELEASED production release.',
      );
    const where = forecastCandidateWhere(
      { ...query, sourceType: release.SourceType },
      query.mode === 'untag' ? id : null,
    );
    const [totalItems, data] = await Promise.all([
      this.prisma.productionOrder.count({ where }),
      this.prisma.productionOrder.findMany({
        where,
        select: {
          Id: true,
          PoId: true,
          SourceType: true,
          Qty: true,
          FinishGoodId: true,
          ProductionReleaseId: true,
          DeliveryDate: true,
          DeliveryPeriod: true,
          VendorName: true,
          PartData: { select: { PartNumber: true, PartName: true } },
        },
        orderBy: [{ DeliveryDate: 'asc' }, { Id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }

  async getCreateCandidates(
    query: ProductionReleaseForecastCandidatesQueryDto,
  ) {
    const where = forecastCandidateWhere(query, null);
    const [totalItems, data] = await Promise.all([
      this.prisma.productionOrder.count({ where }),
      this.prisma.productionOrder.findMany({
        where,
        select: {
          PoId: true,
          SourceType: true,
          Qty: true,
          FinishGoodId: true,
          DeliveryDate: true,
          DeliveryPeriod: true,
          ProductionReleaseId: true,
          PartData: { select: { PartNumber: true, PartName: true } },
        },
        orderBy: [{ DeliveryDate: 'asc' }, { Id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }

  async getCandidateIds(
    query: ProductionReleaseForecastCandidatesQueryDto,
    id?: string,
  ) {
    const release = id ? await this.requireManageable(this.prisma, id) : null;
    const rows = await this.prisma.productionOrder.findMany({
      where: forecastCandidateWhere(
        { ...query, sourceType: release?.SourceType ?? query.sourceType },
        id && query.mode === 'untag' ? id : null,
      ),
      select: { PoId: true },
      orderBy: { PoId: 'asc' },
    });
    return {
      demandIds: rows.map((row) => row.PoId),
      forecastIds:
        (release?.SourceType ?? query.sourceType ?? 'PO') === 'PO'
          ? rows.map((row) => row.PoId)
          : [],
      total: rows.length,
    };
  }

  private async requireReleased(tx: Prisma.TransactionClient, id: string) {
    const release = await tx.productionRelease.findUnique({
      where: { Id: id },
    });
    if (!release)
      throw new NotFoundException(`ProductionRelease with id ${id} not found`);
    if (release.Status !== ProductionStatus.RELEASED) {
      throw new ConflictException(
        'Only a RELEASED production release can be amended.',
      );
    }
    return release;
  }

  private async requireManageable(tx: Prisma.TransactionClient, id: string) {
    const release = await tx.productionRelease.findUnique({
      where: { Id: id },
    });
    if (!release)
      throw new NotFoundException(`ProductionRelease with id ${id} not found`);
    if (
      release.Status !== ProductionStatus.DRAFT &&
      release.Status !== ProductionStatus.RELEASED
    ) {
      throw new ConflictException(
        'Only a DRAFT or RELEASED production release can be amended.',
      );
    }
    return release;
  }

  private async getAmendmentForecasts(
    tx: Prisma.TransactionClient,
    forecastIds: string[],
  ) {
    const forecasts = await tx.productionOrder.findMany({
      where: { PoId: { in: forecastIds } },
      select: {
        PoId: true,
        SourceType: true,
        ShoppingCompletion: { select: { ProductionDemandId: true } },
        Qty: true,
        FinishGoodId: true,
        ProductionReleaseId: true,
        PartData: {
          select: {
            PartName: true,
            IsPassthrough: true,
            BoxQTY: { select: { Qty: true } },
          },
        },
        _count: {
          select: {
            Shopping: true,
            ProductionReport: true,
            DeliveryHistory: true,
            ProductionFindings: true,
          },
        },
        LabelData: {
          select: {
            Id: true,
            Scanned: true,
            _count: {
              select: { PokayokeHistory: true, AssemblySessions: true },
            },
            DeliveryHistory: { select: { Id: true } },
          },
        },
      },
    });
    const found = new Set(forecasts.map((forecast) => forecast.PoId));
    const missing = forecastIds.filter((poId) => !found.has(poId));
    if (missing.length)
      throw new ConflictException(
        `Selected orders are no longer available: ${missing.join(', ')}. Refresh and try again.`,
      );
    return forecasts;
  }

  private assertNoOperationalActivity(
    forecasts: Awaited<
      ReturnType<ProductionReleaseService['getAmendmentForecasts']>
    >,
  ) {
    const blocked = forecasts.filter(
      (forecast) =>
        !!forecast.ShoppingCompletion ||
        forecast._count.Shopping > 0 ||
        forecast._count.ProductionReport > 0 ||
        forecast._count.DeliveryHistory > 0 ||
        forecast._count.ProductionFindings > 0 ||
        forecast.LabelData.some(
          (label) =>
            label.Scanned ||
            label._count.PokayokeHistory > 0 ||
            label._count.AssemblySessions > 0 ||
            label.DeliveryHistory,
        ),
    );
    if (blocked.length) {
      throw new ConflictException(
        `Forecast(s) have operational activity and cannot be amended: ${blocked.map((item) => item.PoId).join(', ')}`,
      );
    }
  }

  private buildLabels(
    releaseId: string,
    forecasts: Awaited<
      ReturnType<ProductionReleaseService['getAmendmentForecasts']>
    >,
    bypassAssembly: boolean,
  ) {
    return forecasts.flatMap((forecast) => {
      const boxQty = forecast.PartData?.BoxQTY?.Qty ?? 0;
      if (boxQty <= 0) {
        throw new ConflictException(
          `Box Qty must be configured with a value greater than 0 for ${forecast.FinishGoodId} (PO ${forecast.PoId}).`,
        );
      }
      if (!Number.isInteger(forecast.Qty) || forecast.Qty <= 0) {
        throw new BadRequestException(
          'Forecast quantity must be a positive integer before release.',
        );
      }
      return buildProductionLabels(
        forecast,
        releaseId,
        boxQty,
        !forecast.PartData.IsPassthrough,
        bypassAssembly,
      );
    });
  }

  async cancel(id: string, dto: CancelProductionReleaseDto, actor: string) {
    const log = await this.logService.startProcess({
      functionId: 'PROD_RELEASE_004',
      functionName: 'ProductionReleaseService.Cancel',
      createdBy: actor,
    });
    try {
      const releaseNumber = await auditedTransaction(
        this.prisma,
        async (tx) => {
          await lockProductionFlow(tx);
          const release = await this.requireReleased(tx, id);
          const forecastIds = (
            await tx.productionOrder.findMany({
              where: { ProductionReleaseId: id },
              select: { PoId: true },
            })
          ).map((item) => item.PoId);
          const forecasts = await this.getAmendmentForecasts(tx, forecastIds);
          this.assertNoOperationalActivity(forecasts);
          for (const forecast of forecasts)
            await captureSapDemand(tx, forecast.PoId, actor, 'cancel');
          await tx.labelData.deleteMany({ where: { ProductionReleaseId: id } });
          await tx.productionDemand.updateMany({
            where: { ProductionReleaseId: id },
            data: { ProductionReleaseId: null },
          });
          await tx.productionRelease.update({
            where: { Id: id },
            data: {
              Status: ProductionStatus.CANCELLED,
              TotalTargetQty: 0,
              TotalGoodQty: 0,
              TotalNgQty: 0,
            },
          });
          await this.logService.addLog({
            processId: log.ProcessId,
            message: `Cancelled ${release.ReleaseNumber}. Reason: ${dto.reason}`,
            type: 'INFO',
            location: 'ProductionReleaseService.cancel',
            client: tx,
          });
          await this.logService.completeProcess(
            log.ProcessId,
            'SUCCESS',
            undefined,
            tx,
          );
          return release.ReleaseNumber;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      void releaseNumber;
      return this.findOne(id);
    } catch (error) {
      await this.logService.completeProcess(log.ProcessId, 'FAILED');
      throw error;
    }
  }

  async tagForecasts(
    id: string,
    dto: AmendProductionReleaseForecastsDto,
    actor: string,
  ) {
    dto = { ...dto, forecastIds: this.selectionIds(dto, true) };
    const log = await this.logService.startProcess({
      functionId: 'PROD_RELEASE_005',
      functionName: 'ProductionReleaseService.TagForecasts',
      createdBy: actor,
    });
    try {
      await auditedTransaction(
        this.prisma,
        async (tx) => {
          await lockProductionFlow(tx);
          const release = await this.requireManageable(tx, id);
          const forecasts = await this.getAmendmentForecasts(
            tx,
            dto.forecastIds,
          );
          const linked = forecasts.filter(
            (forecast) => forecast.ProductionReleaseId !== null,
          );
          if (linked.length)
            throw new ConflictException(
              `Forecast(s) are already linked: ${linked.map((item) => item.PoId).join(', ')}`,
            );
          if (
            forecasts.some((f) => f.SourceType !== release.SourceType) ||
            (release.SourceType === 'NON_PO' && dto.demandIds === undefined)
          )
            throw new ConflictException(
              'Order source must match the release; Non PO requires demandIds.',
            );
          this.assertNoOperationalActivity(forecasts);
          const bypassAssembly =
            release.Status === ProductionStatus.RELEASED
              ? (
                  await tx.assemblyProcessSetting.findUniqueOrThrow({
                    where: { Id: 1 },
                    select: { BypassAllAssembly: true },
                  })
                ).BypassAllAssembly
              : false;
          const labels =
            release.Status === ProductionStatus.RELEASED
              ? this.buildLabels(id, forecasts, bypassAssembly)
              : [];
          const result = await tx.productionDemand.updateMany({
            where: { Id: { in: dto.forecastIds }, ProductionReleaseId: null },
            data: { ProductionReleaseId: id },
          });
          if (result.count !== forecasts.length)
            throw new ConflictException(
              'Forecast assignment changed. Refresh and try again.',
            );
          if (release.Status === ProductionStatus.RELEASED) {
            await snapshotRelease(tx, id, actor, log.ProcessId);
            for (const forecast of forecasts)
              await captureSapDemand(tx, forecast.PoId, actor);
            const createdLabels = await tx.labelData.createMany({
              data: labels,
            });
            if (createdLabels.count !== labels.length)
              throw new ConflictException(
                'Not all labels could be generated. Refresh and try again.',
              );
          } else
            for (const forecast of forecasts)
              await captureSapDemand(tx, forecast.PoId, actor, 'draft');
          const aggregate = await tx.productionOrder.aggregate({
            where: { ProductionReleaseId: id },
            _sum: { Qty: true },
          });
          await tx.productionRelease.update({
            where: { Id: id },
            data: { TotalTargetQty: aggregate._sum.Qty ?? 0 },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.logService.addLog({
        processId: log.ProcessId,
        message: `Tagged forecasts ${dto.forecastIds.join(', ')}. Reason: ${dto.reason}`,
        type: 'INFO',
        location: 'ProductionReleaseService.tagForecasts',
      });
      await this.logService.completeProcess(log.ProcessId, 'SUCCESS');
      return this.findOne(id);
    } catch (error) {
      await this.logService.completeProcess(log.ProcessId, 'FAILED');
      throw error;
    }
  }

  async untagForecasts(
    id: string,
    dto: AmendProductionReleaseForecastsDto,
    actor: string,
  ) {
    dto = { ...dto, forecastIds: this.selectionIds(dto, true) };
    const log = await this.logService.startProcess({
      functionId: 'PROD_RELEASE_006',
      functionName: 'ProductionReleaseService.UntagForecasts',
      createdBy: actor,
    });
    try {
      await auditedTransaction(
        this.prisma,
        async (tx) => {
          await lockProductionFlow(tx);
          const release = await this.requireManageable(tx, id);
          const forecasts = await this.getAmendmentForecasts(
            tx,
            dto.forecastIds,
          );
          const invalid = forecasts.filter(
            (forecast) => forecast.ProductionReleaseId !== id,
          );
          if (invalid.length)
            throw new ConflictException(
              `Forecast(s) are not linked to this release: ${invalid.map((item) => item.PoId).join(', ')}`,
            );
          if (
            forecasts.some((f) => f.SourceType !== release.SourceType) ||
            (release.SourceType === 'NON_PO' && dto.demandIds === undefined)
          )
            throw new ConflictException(
              'Order source must match the release; Non PO requires demandIds.',
            );
          this.assertNoOperationalActivity(forecasts);
          const linkedCount = await tx.productionOrder.count({
            where: { ProductionReleaseId: id },
          });
          if (linkedCount === forecasts.length)
            throw new ConflictException(
              'Cannot remove all forecasts. Cancel the production release instead.',
            );
          for (const forecast of forecasts)
            await captureSapDemand(tx, forecast.PoId, actor, 'cancel');
          if (release.Status === ProductionStatus.RELEASED) {
            await tx.labelData.deleteMany({
              where: {
                ProductionReleaseId: id,
                ProductionDemandId: { in: dto.forecastIds },
              },
            });
          }
          const result = await tx.productionDemand.updateMany({
            where: { Id: { in: dto.forecastIds }, ProductionReleaseId: id },
            data: { ProductionReleaseId: null },
          });
          if (result.count !== forecasts.length)
            throw new ConflictException(
              'Forecast assignment changed. Refresh and try again.',
            );
          const aggregate = await tx.productionOrder.aggregate({
            where: { ProductionReleaseId: id },
            _sum: { Qty: true },
          });
          await tx.productionRelease.update({
            where: { Id: id },
            data: { TotalTargetQty: aggregate._sum.Qty ?? 0 },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.logService.addLog({
        processId: log.ProcessId,
        message: `Untagged forecasts ${dto.forecastIds.join(', ')}. Reason: ${dto.reason}`,
        type: 'INFO',
        location: 'ProductionReleaseService.untagForecasts',
      });
      await this.logService.completeProcess(log.ProcessId, 'SUCCESS');
      return this.findOne(id);
    } catch (error) {
      await this.logService.completeProcess(log.ProcessId, 'FAILED');
      throw error;
    }
  }

  async create(dto: CreateProductionReleaseDto, createdBy: string) {
    if (dto.sourceType === 'NON_PO' && dto.forecastIds !== undefined)
      throw new BadRequestException('Non PO requires demandIds.');
    dto = { ...dto, forecastIds: this.selectionIds(dto, true) };
    let logProcess: LogProcessModel | undefined;

    try {
      const manualReleaseNumber = dto.releaseNumber?.trim();
      if (dto.releaseNumber !== undefined && !manualReleaseNumber) {
        throw new BadRequestException(
          'releaseNumber must not be blank when supplied',
        );
      }

      logProcess = await this.logService.startProcess({
        functionId: 'PROD_RELEASE_001',
        functionName: 'ProductionReleaseService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: manualReleaseNumber
          ? `Creating production release with manual number: ${manualReleaseNumber}`
          : 'Creating production release with an auto-generated number',
        type: 'INFO',
        location: 'production-release.service.ts:60',
      });

      if (dto.forecastIds.length === 0) {
        throw new BadRequestException('forecastIds cannot be empty');
      }

      const forecastIds = [...new Set(dto.forecastIds)];
      const result = await auditedTransaction(
        this.prisma,
        async (tx) => {
          await lockProductionFlow(tx);
          await assertNoActiveInventoryCounting(
            tx,
            undefined,
            'Production Release',
          );

          if (manualReleaseNumber) {
            const existing = await tx.productionRelease.findUnique({
              where: { ReleaseNumber: manualReleaseNumber },
              select: { Id: true },
            });
            if (existing) {
              throw new ConflictException(
                `Production release number "${manualReleaseNumber}" already exists.`,
              );
            }
          }

          const releaseNumber =
            manualReleaseNumber ??
            (await this.generateReleaseNumber(tx, new Date(dto.planDate)));

          const forecasts = await tx.productionOrder.findMany({
            where: {
              ...forecastCandidateWhere({ sourceType: dto.sourceType }, null),
              PoId: { in: forecastIds },
            },
            select: { PoId: true, Qty: true },
          });
          if (forecasts.length !== forecastIds.length) {
            throw new ConflictException(
              'One or more forecasts do not exist or are already assigned. Refresh and try again.',
            );
          }
          const created = await tx.productionRelease.create({
            data: {
              SourceType: dto.sourceType ?? 'PO',
              ReleaseNumber: releaseNumber,
              PlanDate: new Date(dto.planDate),
              Notes: dto.notes,
              Status: ProductionStatus.DRAFT,
              CreatedBy: createdBy,
              IsNoAttachment: dto.isNoAttachment ?? false,
              TotalTargetQty: forecasts.reduce(
                (sum, forecast) => sum + forecast.Qty,
                0,
              ),
            },
          });
          const assignment = await tx.productionDemand.updateMany({
            where: {
              Id: { in: forecastIds },
              ProductionReleaseId: null,
            },
            data: { ProductionReleaseId: created.Id },
          });
          if (assignment.count !== forecastIds.length) {
            throw new ConflictException(
              'Forecast assignment changed. Refresh and try again.',
            );
          }
          for (const forecast of forecasts)
            await captureSapDemand(tx, forecast.PoId, createdBy, 'draft');
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Production release created with IsNoAttachment: ${dto.isNoAttachment ?? false}`,
        type: 'INFO',
        location: 'production-release.service.ts:301',
      });

      // Link forecasts to release
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Linking ${dto.forecastIds.length} forecasts to release`,
        type: 'INFO',
        location: 'production-release.service.ts:78',
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Production release created: ${result.ReleaseNumber}`,
        type: 'INFO',
        location: 'production-release.service.ts:101',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return this.findOne(result.Id);
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'production-release.service.ts:115',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      this.releaseConflict(error);
    }
  }

  async update(id: string, dto: UpdateProductionReleaseDto, updatedBy: string) {
    dto = { ...dto, forecastIds: this.selectionIds(dto, false) };
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PROD_RELEASE_002',
        functionName: 'ProductionReleaseService.Update',
        createdBy: updatedBy,
      });

      if (dto.status === ProductionStatus.CANCELLED) {
        throw new BadRequestException(
          'Use the dedicated cancel action to cancel a production release.',
        );
      }

      const result = await auditedTransaction(
        this.prisma,
        async (tx) => {
          await lockProductionFlow(tx);
          const existing = await tx.productionRelease.findUnique({
            where: { Id: id },
          });
          if (!existing) {
            throw new NotFoundException(
              `ProductionRelease with id ${id} not found`,
            );
          }
          const isClosing =
            existing.Status === ProductionStatus.RELEASED &&
            dto.status === ProductionStatus.COMPLETED;
          if (dto.totalProductionMinutes !== undefined && !isClosing) {
            throw new BadRequestException(
              'Production duration can only be recorded when closing a RELEASED production release.',
            );
          }
          if (
            dto.status !== undefined &&
            dto.status !== existing.Status &&
            !(
              (existing.Status === ProductionStatus.DRAFT &&
                dto.status === ProductionStatus.RELEASED) ||
              (existing.Status === ProductionStatus.RELEASED &&
                dto.status === ProductionStatus.COMPLETED)
            )
          ) {
            throw new BadRequestException(
              `Cannot change status from ${existing.Status} to ${dto.status}.`,
            );
          }
          if (
            dto.forecastIds !== undefined &&
            existing.Status !== ProductionStatus.DRAFT
          ) {
            throw new BadRequestException(
              'Forecast assignments can only be edited directly while the production release is DRAFT. Use Manage Forecasts for a RELEASED production release.',
            );
          }
          if (
            existing.Status === ProductionStatus.DRAFT &&
            dto.status === ProductionStatus.RELEASED
          ) {
            const activeRelease = await tx.productionRelease.findFirst({
              where: {
                Status: ProductionStatus.RELEASED,
                Id: { not: id },
              },
              select: { ReleaseNumber: true },
            });
            if (activeRelease) {
              throw new ConflictException(
                `Cannot start production release ${existing.ReleaseNumber} because ${activeRelease.ReleaseNumber} is still active. Only one release can be active at a time. Complete all production and deliveries for ${activeRelease.ReleaseNumber}, then mark it as COMPLETED before starting this release.`,
              );
            }
          }
          if (
            dto.status === ProductionStatus.DRAFT &&
            existing.Status === ProductionStatus.RELEASED
          ) {
            throw new BadRequestException(
              'Cannot change status from RELEASED to DRAFT. Once released, a production release cannot be reverted.',
            );
          }
          if (dto.isNoAttachment === true) {
            const attachmentCount = await tx.productionReleaseAttachment.count({
              where: { ProductionReleaseId: id },
            });
            if (attachmentCount > 0) {
              throw new BadRequestException(
                'Cannot select No Attachment while attachments exist. Delete the attachments first.',
              );
            }
          }

          if (
            existing.SourceType === 'NON_PO' &&
            dto.forecastIds !== undefined &&
            dto.demandIds === undefined
          )
            throw new BadRequestException('Non PO requires demandIds.');
          if (dto.forecastIds !== undefined) {
            const forecastIds = [...new Set(dto.forecastIds)];
            if (forecastIds.length === 0) {
              throw new BadRequestException('forecastIds cannot be empty');
            }
            const forecasts = await tx.productionOrder.findMany({
              where: {
                SourceType: existing.SourceType,
                PoId: { in: forecastIds },
                OR: [
                  { ProductionReleaseId: null },
                  { ProductionReleaseId: id },
                ],
              },
              select: { PoId: true },
            });
            if (forecasts.length !== forecastIds.length) {
              throw new ConflictException(
                'One or more forecasts do not exist or are assigned to another release. Refresh and try again.',
              );
            }
            await tx.productionDemand.updateMany({
              where: { ProductionReleaseId: id },
              data: { ProductionReleaseId: null },
            });
            const linked = await tx.productionDemand.updateMany({
              where: {
                Id: { in: forecastIds },
                ProductionReleaseId: null,
              },
              data: { ProductionReleaseId: id },
            });
            if (linked.count !== forecastIds.length) {
              throw new ConflictException(
                'Forecast assignment changed. Refresh and try again.',
              );
            }
          }

          const linkedForecasts = await tx.productionOrder.findMany({
            where: { ProductionReleaseId: id },
            select: {
              PoId: true,
              SourceType: true,
              Qty: true,
              FinishGoodId: true,
              PartData: {
                select: {
                  PartName: true,
                  IsPassthrough: true,
                  BoxQTY: { select: { Qty: true } },
                },
              },
            },
          });
          const totalTargetQty = linkedForecasts.reduce(
            (sum, forecast) => sum + forecast.Qty,
            0,
          );

          if (
            dto.status === ProductionStatus.RELEASED &&
            existing.Status !== ProductionStatus.RELEASED
          ) {
            await assertNoActiveInventoryCounting(
              tx,
              undefined,
              'Release Production',
            );
            if (linkedForecasts.length === 0) {
              throw new BadRequestException(
                'Cannot release production: no forecast/PO is linked to this release.',
              );
            }
            const missingBoxQty = linkedForecasts.filter(
              (forecast) =>
                !forecast.PartData?.BoxQTY || forecast.PartData.BoxQTY.Qty <= 0,
            );
            if (missingBoxQty.length > 0) {
              const details = missingBoxQty
                .map(
                  (forecast) =>
                    `${forecast.FinishGoodId} (${forecast.PartData?.PartName ?? '-'}, PO ${forecast.PoId})`,
                )
                .join(', ');
              throw new BadRequestException(
                `Cannot release production. Box Qty must be configured with a value greater than 0 for: ${details}.`,
              );
            }
            const bypassAssembly = (
              await tx.assemblyProcessSetting.findUniqueOrThrow({
                where: { Id: 1 },
                select: { BypassAllAssembly: true },
              })
            ).BypassAllAssembly;
            const labels = this.buildLabels(
              id,
              linkedForecasts.map((forecast) => ({
                ...forecast,
                ProductionReleaseId: id,
                _count: {
                  Shopping: 0,
                  ProductionReport: 0,
                  DeliveryHistory: 0,
                  ProductionFindings: 0,
                },
                LabelData: [],
                ShoppingCompletion: null,
              })),
              bypassAssembly,
            );
            const createdLabels = await tx.labelData.createMany({
              data: labels,
            });
            if (createdLabels.count !== labels.length) {
              throw new ConflictException(
                'Not all labels could be generated. Refresh and try again.',
              );
            }
          }

          if (
            dto.status === ProductionStatus.COMPLETED &&
            existing.Status !== ProductionStatus.COMPLETED
          ) {
            const [forecasts, attachmentCount] = await Promise.all([
              tx.productionOrder.findMany({
                where: { ProductionReleaseId: id },
                select: {
                  PoId: true,
                  Qty: true,
                  FinishGoodId: true,
                  DeliveryHistory: { select: { Qty: true } },
                  LabelData: {
                    where: { InvalidatedAt: null },
                    select: {
                      Scanned: true,
                      QtyThisBox: true,
                      FinishGoodId: true,
                      ProductionReleaseId: true,
                      DeliveryHistory: { select: { Qty: true } },
                    },
                  },
                },
              }),
              tx.productionReleaseAttachment.count({
                where: { ProductionReleaseId: id },
              }),
            ]);
            const activeAssy = await tx.assemblySession.count({
              where: {
                Status: 'IN_PROGRESS',
                LabelData: { ProductionReleaseId: id },
              },
            });
            if (activeAssy > 0)
              throw new BadRequestException(
                'Cannot close release with active assembly sessions.',
              );
            const incomplete = forecasts.filter(
              (forecast) =>
                forecast.Qty <= 0 ||
                forecast.LabelData.length === 0 ||
                forecast.DeliveryHistory.reduce(
                  (sum, delivery) => sum + delivery.Qty,
                  0,
                ) !== forecast.Qty ||
                forecast.LabelData.reduce(
                  (sum, label) => sum + label.QtyThisBox,
                  0,
                ) !== forecast.Qty ||
                forecast.LabelData.some(
                  (label) =>
                    !label.Scanned ||
                    label.QtyThisBox <= 0 ||
                    label.ProductionReleaseId !== id ||
                    label.FinishGoodId !== forecast.FinishGoodId ||
                    label.DeliveryHistory?.Qty !== label.QtyThisBox,
                ),
            );
            if (forecasts.length === 0 || incomplete.length > 0) {
              throw new BadRequestException(
                'Cannot complete production release. Every forecast/PO and every label must be fully delivered after POKAYOKE.',
              );
            }
            if (
              !(dto.isNoAttachment ?? existing.IsNoAttachment) &&
              attachmentCount === 0
            ) {
              throw new BadRequestException(
                'Cannot complete production release without an attachment. Upload at least one attachment or select No Attachment.',
              );
            }
            if (
              typeof dto.totalProductionMinutes !== 'number' ||
              !Number.isInteger(dto.totalProductionMinutes) ||
              dto.totalProductionMinutes <= 0 ||
              dto.totalProductionMinutes > 2147483647
            ) {
              throw new BadRequestException(
                'Enter a valid total production duration of at least 1 minute before closing the release.',
              );
            }
            await this.logService.addLog({
              processId: logProcess!.ProcessId,
              message: 'Production duration recorded with release closure.',
              type: 'INFO',
              location: 'ProductionReleaseService.update',
              client: tx,
            });
          }

          if (
            dto.status === ProductionStatus.RELEASED ||
            existing.Status === ProductionStatus.RELEASED
          )
            await snapshotRelease(tx, id, updatedBy, logProcess!.ProcessId);
          if (dto.status && dto.status !== existing.Status) {
            const linkedOrders = await tx.productionOrder.findMany({
              where: { ProductionReleaseId: id },
              select: { PoId: true },
            });
            for (const order of linkedOrders) {
              await captureSapDemand(
                tx,
                order.PoId,
                updatedBy,
                dto.status === ProductionStatus.CANCELLED
                  ? 'cancel'
                  : dto.status === ProductionStatus.COMPLETED
                    ? true
                    : dto.status === ProductionStatus.DRAFT
                      ? 'draft'
                      : false,
              );
            }
            await tx.productionTraceEvent.createMany({
              data: linkedOrders.map((order) => ({
                ProductionDemandId: order.PoId,
                ReleaseId: id,
                Type: 'RELEASE_STATUS_CHANGED',
                SourceType: 'ProductionRelease',
                SourceId: id,
                Actor: updatedBy,
                CorrelationId: logProcess!.ProcessId,
                ProcessId: logProcess!.ProcessId,
                Metadata: { before: existing.Status, after: dto.status! },
              })),
            });
          }
          return tx.productionRelease.update({
            where: { Id: id },
            data: {
              ...(dto.planDate !== undefined
                ? { PlanDate: new Date(dto.planDate) }
                : {}),
              ...(dto.status !== undefined ? { Status: dto.status } : {}),
              ...(isClosing
                ? { TotalProductionMinutes: dto.totalProductionMinutes }
                : {}),
              ...(dto.notes !== undefined ? { Notes: dto.notes } : {}),
              ...(dto.isNoAttachment !== undefined
                ? { IsNoAttachment: dto.isNoAttachment }
                : {}),
              TotalTargetQty: totalTargetQty,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Production release updated: ${result.ReleaseNumber}, status: ${result.Status}`,
        type: 'INFO',
        location: 'production-release.service.ts:202',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return this.findOne(id);
    } catch (error) {
      if (logProcess) {
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      this.releaseConflict(error);
    }
  }

  private async validateBoxQtyForRelease(releaseId: string): Promise<void> {
    const forecasts = await this.prisma.productionOrder.findMany({
      where: { ProductionReleaseId: releaseId },
      select: {
        PoId: true,
        FinishGoodId: true,
        PartData: {
          select: {
            PartName: true,
            BoxQTY: { select: { Qty: true } },
          },
        },
      },
    });

    if (forecasts.length === 0) {
      throw new BadRequestException(
        'Cannot release production: no forecast/PO is linked to this release.',
      );
    }

    const missingBoxQty = forecasts.filter(
      (forecast) =>
        !forecast.PartData?.BoxQTY || forecast.PartData.BoxQTY.Qty <= 0,
    );

    if (missingBoxQty.length > 0) {
      const details = missingBoxQty
        .map(
          (forecast) =>
            `${forecast.FinishGoodId} (${forecast.PartData?.PartName ?? '-'}, PO ${forecast.PoId})`,
        )
        .join(', ');
      throw new BadRequestException(
        `Cannot release production. Box Qty must be configured with a value greater than 0 for: ${details}.`,
      );
    }
  }

  /**
   * Generate LabelData for all forecasts linked to this release
   */
  private async generateLabelsForRelease(releaseId: string, processId: string) {
    const forecasts = await this.prisma.productionOrder.findMany({
      where: { ProductionReleaseId: releaseId },
      select: {
        PoId: true,
        SourceType: true,
        Qty: true,
        FinishGoodId: true,
        PartData: { select: { IsPassthrough: true } },
      },
    });

    await this.logService.addLog({
      processId,
      message: `Found ${forecasts.length} forecasts to generate labels for`,
      type: 'INFO',
      location: 'production-release.service.ts:226',
    });

    const bypassAssembly = (
      await this.prisma.assemblyProcessSetting.findUniqueOrThrow({
        where: { Id: 1 },
        select: { BypassAllAssembly: true },
      })
    ).BypassAllAssembly;
    const labelDataToCreate: {
      LabelNumber: string;
      FinishGoodId: string;
      ProductionDemandId: string;
      Scanned: boolean;
      QtyThisBox: number;
      ProductionReleaseId: string;
      RequiresAssembly: boolean;
      BypassAssembly: boolean;
    }[] = [];

    for (const forecast of forecasts) {
      // Get BoxQTY for this finish good
      const boxDetail = await this.prisma.boxQTY.findUnique({
        where: { PartNumber: forecast.FinishGoodId },
      });

      if (!boxDetail) {
        await this.logService.addLog({
          processId,
          message: `BoxQTY not found for ${forecast.FinishGoodId}, skipping label generation for PO ${forecast.PoId}`,
          type: 'WARN',
          location: 'production-release.service.ts:243',
        });
        continue;
      }

      const totalTags = Math.ceil(forecast.Qty / boxDetail.Qty);

      await this.logService.addLog({
        processId,
        message: `Generating ${totalTags} labels for PO ${forecast.PoId} (Qty: ${forecast.Qty}, BoxSize: ${boxDetail.Qty})`,
        type: 'INFO',
        location: 'production-release.service.ts:251',
      });

      for (let i = 0; i < totalTags; i++) {
        const qtyInBox =
          i === totalTags - 1
            ? forecast.Qty % boxDetail.Qty || boxDetail.Qty
            : boxDetail.Qty;

        // Format: poId + 3 digit box number + 5 digit qty
        const boxNumber = String(i + 1).padStart(3, '0');
        const qtyString = String(qtyInBox).padStart(5, '0');
        const labelNumber = `${forecast.PoId}${boxNumber}${qtyString}`;

        labelDataToCreate.push({
          LabelNumber: labelNumber,
          FinishGoodId: forecast.FinishGoodId,
          ProductionDemandId: forecast.PoId,
          Scanned: false,
          QtyThisBox: qtyInBox,
          ProductionReleaseId: releaseId,
          RequiresAssembly: !forecast.PartData.IsPassthrough,
          BypassAssembly: !forecast.PartData.IsPassthrough && bypassAssembly,
        });
      }
    }

    if (labelDataToCreate.length > 0) {
      await auditedWrite(this.prisma, (tx) =>
        tx.labelData.createMany({
          data: labelDataToCreate,
          skipDuplicates: true,
        }),
      );

      await this.logService.addLog({
        processId,
        message: `Created ${labelDataToCreate.length} label records`,
        type: 'INFO',
        location: 'production-release.service.ts:284',
      });
    }
  }

  async remove(id: string, deletedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PROD_RELEASE_003',
        functionName: 'ProductionReleaseService.Delete',
        createdBy: deletedBy,
      });

      const existing = await this.prisma.productionRelease.findUnique({
        where: { Id: id },
        include: {
          _count: { select: { LabelDatas: true, Forecasts: true } },
        },
      });

      if (!existing) {
        throw new NotFoundException(
          `ProductionRelease with id ${id} not found`,
        );
      }

      // Can only delete if status is DRAFT
      if (existing.Status !== ProductionStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot delete production release with status '${existing.Status}'. Only DRAFT releases can be deleted.`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting production release ${existing.ReleaseNumber} (DRAFT)`,
        type: 'INFO',
        location: 'production-release.service.ts:416',
      });

      // Use transaction to delete related data
      await auditedTransaction(this.prisma, async (tx) => {
        await lockProductionFlow(tx);
        const processId = logProcess!.ProcessId;
        const existing = await tx.productionRelease.findUnique({
          where: { Id: id },
          include: {
            _count: { select: { LabelDatas: true, Forecasts: true } },
          },
        });
        if (!existing || existing.Status !== ProductionStatus.DRAFT) {
          throw new BadRequestException(
            'Only DRAFT releases can be deleted. Refresh and try again.',
          );
        }

        // Delete related LabelData first
        const sapDemands = await tx.productionOrder.findMany({
          where: { ProductionReleaseId: id },
          select: { PoId: true },
        });
        for (const demand of sapDemands)
          await captureSapDemand(tx, demand.PoId, deletedBy, 'cancel');
        if (existing._count.LabelDatas > 0) {
          await this.logService.addLog({
            processId,
            message: `Deleting ${existing._count.LabelDatas} related LabelData records`,
            type: 'INFO',
            location: 'production-release.service.ts:424',
          });
          await tx.labelData.deleteMany({
            where: { ProductionReleaseId: id },
          });
        }

        // Unlink forecasts (set ProductionReleaseId to null)
        if (existing._count.Forecasts > 0) {
          await this.logService.addLog({
            processId,
            message: `Unlinking ${existing._count.Forecasts} related Forecast records`,
            type: 'INFO',
            location: 'production-release.service.ts:433',
          });
          await tx.productionDemand.updateMany({
            where: { ProductionReleaseId: id },
            data: { ProductionReleaseId: null },
          });
        }

        // Delete the release
        await tx.productionRelease.delete({
          where: { Id: id },
        });
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Production release ${existing.ReleaseNumber} deleted successfully`,
        type: 'INFO',
        location: 'production-release.service.ts:445',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id };
    } catch (error) {
      if (logProcess) {
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Get production release by release number
   */
  async findByReleaseNumber(releaseNumber: string) {
    const release = await this.prisma.productionRelease.findUnique({
      where: { ReleaseNumber: releaseNumber },
      include: {
        Forecasts: {
          select: {
            PoId: true,
            Qty: true,
            DeliveryDate: true,
          },
        },
        _count: {
          select: {
            LabelDatas: true,
            Forecasts: true,
          },
        },
      },
    });

    if (!release) {
      throw new NotFoundException(
        `ProductionRelease with release number ${releaseNumber} not found`,
      );
    }

    return release;
  }

  /**
   * Get labels for a production release
   */
  async getLabels(releaseId: string) {
    const release = await this.prisma.productionRelease.findUnique({
      where: { Id: releaseId },
    });

    if (!release) {
      throw new NotFoundException(
        `ProductionRelease with id ${releaseId} not found`,
      );
    }

    return this.prisma.labelData.findMany({
      where: { ProductionReleaseId: releaseId },
      include: {
        PartData: {
          select: {
            PartNumber: true,
            PartName: true,
          },
        },
        POData: {
          select: {
            PoId: true,
            VendorName: true,
          },
        },
      },
      orderBy: {
        LabelNumber: 'asc',
      },
    });
  }

  /**
   * Update production totals (called from production report)
   */
  async updateTotals(id: string, goodQty: number, ngQty: number) {
    const release = await this.prisma.productionRelease.findUnique({
      where: { Id: id },
    });

    if (!release) {
      throw new NotFoundException(`ProductionRelease with id ${id} not found`);
    }

    return auditedWrite(this.prisma, (tx) =>
      tx.productionRelease.update({
        where: { Id: id },
        data: {
          TotalGoodQty: release.TotalGoodQty + goodQty,
          TotalNgQty: release.TotalNgQty + ngQty,
        },
      }),
    );
  }

  async uploadAttachment(
    dto: UploadProductionAttachmentDto,
    files: Express.Multer.File[],
    createdBy: string,
  ) {
    let logProcess: LogProcessModel | undefined;
    const uploadedPaths: string[] = [];

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PROD_RELEASE_ATTACH_001',
        functionName: 'ProductionReleaseService.UploadAttachment',
        createdBy,
      });

      if (!files?.length || files.length > 10) {
        throw new BadRequestException('Upload between 1 and 10 files.');
      }
      files.forEach((file) => this.validateAttachmentFile(file));
      const release = await this.prisma.productionRelease.findUnique({
        where: { Id: dto.productionReleaseId },
      });

      if (!release) {
        throw new NotFoundException(
          `ProductionRelease with id ${dto.productionReleaseId} not found`,
        );
      }

      if (release.IsNoAttachment) {
        throw new BadRequestException(
          `Cannot upload attachments while ${release.ReleaseNumber} is marked No Attachment.`,
        );
      }
      if (
        release.Status !== ProductionStatus.DRAFT &&
        release.Status !== ProductionStatus.RELEASED
      ) {
        throw new BadRequestException(
          `Attachments cannot be uploaded while status is ${release.Status}.`,
        );
      }
      const attachments: ReturnType<
        ProductionReleaseService['toAttachmentResponse']
      >[] = [];
      for (const file of files) {
        const storedFileName = this.createStoredFileName(file.originalname);
        const filePath = await this.nasUploadService.uploadFile({
          fileName: storedFileName,
          fileBuffer: file.buffer,
          subFolder: dto.productionReleaseId,
        });
        uploadedPaths.push(filePath);
        const attachment = await auditedWrite(this.prisma, (tx) =>
          tx.productionReleaseAttachment.create({
            data: {
              FileName: storedFileName,
              FilePath: filePath,
              OriginalFileName: file.originalname,
              FileSize: file.size,
              MimeType: file.mimetype,
              ProductionReleaseId: dto.productionReleaseId,
              CreatedBy: createdBy,
            },
          }),
        );
        attachments.push(this.toAttachmentResponse(attachment));
      }
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Uploaded ${attachments.length} attachment(s) for production release ${dto.productionReleaseId}`,
        type: 'INFO',
        location: 'ProductionReleaseService.uploadAttachment',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return attachments;
    } catch (error) {
      await Promise.all(
        uploadedPaths.map((path) =>
          this.nasUploadService.deleteFile(path).catch(() => undefined),
        ),
      );
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'production-release.service.ts:1025',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Get attachments for a production release
   */
  async getAttachments(productionReleaseId: string) {
    const release = await this.prisma.productionRelease.findUnique({
      where: { Id: productionReleaseId },
    });

    if (!release) {
      throw new NotFoundException(
        `ProductionRelease with id ${productionReleaseId} not found`,
      );
    }

    const attachments = await this.prisma.productionReleaseAttachment.findMany({
      where: { ProductionReleaseId: productionReleaseId },
      orderBy: { CreatedAt: 'desc' },
    });
    return attachments.map((attachment) =>
      this.toAttachmentResponse(attachment),
    );
  }

  async replaceAttachment(
    productionReleaseId: string,
    attachmentId: number,
    file: Express.Multer.File,
    updatedBy: string,
  ) {
    let logProcess: LogProcessModel | undefined;
    let newPath: string | undefined;
    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PROD_RELEASE_ATTACH_003',
        functionName: 'ProductionReleaseService.ReplaceAttachment',
        createdBy: updatedBy,
      });
      this.validateAttachmentFile(file);
      const attachment =
        await this.prisma.productionReleaseAttachment.findFirst({
          where: { id: attachmentId, ProductionReleaseId: productionReleaseId },
        });
      if (!attachment)
        throw new NotFoundException(
          `Attachment with id ${attachmentId} not found for production release ${productionReleaseId}`,
        );
      const storedFileName = this.createStoredFileName(file.originalname);
      newPath = await this.nasUploadService.uploadFile({
        fileName: storedFileName,
        fileBuffer: file.buffer,
        subFolder: productionReleaseId,
      });
      const updated = await auditedWrite(this.prisma, (tx) =>
        tx.productionReleaseAttachment.update({
          where: { id: attachmentId },
          data: {
            FileName: storedFileName,
            FilePath: newPath,
            OriginalFileName: file.originalname,
            FileSize: file.size,
            MimeType: file.mimetype,
            UpdatedBy: updatedBy,
          },
        }),
      );
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Replaced attachment ${attachmentId} for production release ${productionReleaseId}`,
        type: 'INFO',
        location: 'ProductionReleaseService.replaceAttachment',
      });
      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');
      if (attachment.FilePath)
        await this.nasUploadService
          .deleteFile(attachment.FilePath)
          .catch(() => undefined);
      return this.toAttachmentResponse(updated);
    } catch (error) {
      if (newPath)
        await this.nasUploadService.deleteFile(newPath).catch(() => undefined);
      if (logProcess)
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      throw error;
    }
  }

  async downloadAttachment(productionReleaseId: string, attachmentId: number) {
    const attachment = await this.prisma.productionReleaseAttachment.findFirst({
      where: { id: attachmentId, ProductionReleaseId: productionReleaseId },
    });
    if (!attachment?.FilePath)
      throw new NotFoundException(
        `Attachment with id ${attachmentId} not found for production release ${productionReleaseId}`,
      );
    const download = await this.nasUploadService.downloadFile(
      attachment.FilePath,
    );
    return {
      ...download,
      fileName:
        attachment.OriginalFileName ?? attachment.FileName ?? download.fileName,
    };
  }

  /**
   * Delete attachment
   */
  async deleteAttachment(
    productionReleaseId: string,
    attachmentId: number,
    createdBy: string,
  ): Promise<{ deleted: boolean; id: number }> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PROD_RELEASE_ATTACH_002',
        functionName: 'ProductionReleaseService.DeleteAttachment',
        createdBy,
      });

      const attachment =
        await this.prisma.productionReleaseAttachment.findFirst({
          where: { id: attachmentId, ProductionReleaseId: productionReleaseId },
        });

      if (!attachment) {
        throw new NotFoundException(
          `DeliveryAttachment with id ${attachmentId} not found`,
        );
      }

      const release = await this.prisma.productionRelease.findUnique({
        where: { Id: productionReleaseId },
      });
      if (
        release?.Status === ProductionStatus.COMPLETED &&
        !release.IsNoAttachment
      ) {
        const attachmentCount =
          await this.prisma.productionReleaseAttachment.count({
            where: { ProductionReleaseId: productionReleaseId },
          });
        if (attachmentCount <= 1)
          throw new BadRequestException(
            'Cannot delete the final required attachment from a completed production release.',
          );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting attachment ${attachmentId}: ${attachment.FileName}`,
        type: 'INFO',
        location: 'production-release.service.ts:951',
      });

      // Delete file from NAS if exists
      if (attachment.FilePath) {
        try {
          await this.nasUploadService.deleteFile(attachment.FilePath);
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `File deleted from NAS for attachment ${attachmentId}`,
            type: 'INFO',
            location: 'production-release.service.ts:961',
          });
        } catch (nasError) {
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `Warning: Could not delete file from NAS: ${nasError instanceof Error ? nasError.message : 'Unknown error'}`,
            type: 'WARN',
            location: 'production-release.service.ts:968',
          });
        }
      }

      // Delete record from database
      await auditedWrite(this.prisma, (tx) =>
        tx.productionReleaseAttachment.delete({
          where: { id: attachmentId },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Attachment ${attachmentId} deleted successfully`,
        type: 'INFO',
        location: 'production-release.service.ts:980',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id: attachmentId };
    } catch (error) {
      if (logProcess) {
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  private validateAttachmentFile(file: Express.Multer.File): void {
    validateUploadContent(file, ['pdf', 'jpeg', 'png', 'gif', 'webp']);
    if (file.size > MAX_FILE_SIZE)
      throw new BadRequestException('File too large. Maximum size is 10MB');
  }

  private createStoredFileName(originalName: string): string {
    const extension = originalName.split('.').pop()?.toLowerCase() ?? 'bin';
    return `${Date.now()}-${randomUUID()}.${extension}`;
  }

  private toAttachmentResponse(attachment: {
    id: number;
    ProductionReleaseId: string | null;
    OriginalFileName: string | null;
    FileName: string | null;
    FileSize: number | null;
    MimeType: string | null;
    CreatedAt: Date;
    CreatedBy: string | null;
    UpdatedAt: Date;
    UpdatedBy: string | null;
  }) {
    return {
      Id: attachment.id,
      ProductionReleaseId: attachment.ProductionReleaseId,
      FileName: attachment.OriginalFileName ?? attachment.FileName,
      FileSize: attachment.FileSize,
      MimeType: attachment.MimeType,
      CreatedAt: attachment.CreatedAt,
      CreatedBy: attachment.CreatedBy,
      UpdatedAt: attachment.UpdatedAt,
      UpdatedBy: attachment.UpdatedBy,
    };
  }

  /**
   * Get forecast list with shopping data for a specific production release
   */
  async getForecastList(releaseId: string) {
    // Find the production release
    const release = await this.prisma.productionRelease.findUnique({
      where: { Id: releaseId },
    });

    if (!release) {
      throw new NotFoundException(
        `ProductionRelease with id ${releaseId} not found`,
      );
    }

    // Get forecasts for this production release
    const forecastsData = await this.prisma.productionOrder.findMany({
      where: {
        ProductionReleaseId: releaseId,
      },
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
          where: { Purpose: 'STANDARD' },
          select: {
            Id: true,
            SnapshotLineId: true,
            MaterialId: true,
            QtyPick: true,
            MaterialData: {
              select: {
                PartNumber: true,
                PartName: true,
              },
            },
          },
          orderBy: {
            Id: 'asc',
          },
        },
      },
      orderBy: {
        DeliveryDate: 'asc',
      },
    });

    // Get all unique FinishGood PartNumbers
    const finishGoodPartNumbers = [
      ...new Set(forecastsData.map((f) => f.FinishGoodId)),
    ];

    // Get FinishGood data to map PartNumber (string) -> Id (Int)
    const finishGoods =
      finishGoodPartNumbers.length > 0
        ? await this.prisma.finishGood.findMany({
            where: { PartNumber: { in: finishGoodPartNumbers } },
            select: { Id: true, PartNumber: true },
          })
        : [];

    const fgPartNumberToIdMap = new Map<string, number>();
    for (const fg of finishGoods) {
      fgPartNumberToIdMap.set(fg.PartNumber, fg.Id);
    }

    // Get BOM data per FinishGood with MaterialId for detailed calculation
    const fgIds = finishGoods.map((fg) => fg.Id);
    const bomData =
      fgIds.length > 0
        ? await this.prisma.billOfMaterials.findMany({
            where: {
              FinishGoodId: { in: fgIds },
              FGData: { ActiveBomRevisionId: { not: null } },
            },
            select: {
              FinishGoodId: true,
              MaterialId: true,
              Qty: true,
              MaterialData: {
                select: {
                  PartNumber: true,
                  PartName: true,
                },
              },
            },
          })
        : [];

    // Create map: FinishGoodId (Int) -> { MaterialId: QtyPerFg }
    const bomByFgMap = new Map<
      number,
      Map<
        number,
        { qty: number; materialData: { PartNumber: string; PartName: string } }
      >
    >();
    for (const bom of bomData) {
      if (!bomByFgMap.has(bom.FinishGoodId)) {
        bomByFgMap.set(bom.FinishGoodId, new Map());
      }
      bomByFgMap.get(bom.FinishGoodId)!.set(bom.MaterialId, {
        qty: bom.Qty,
        materialData: bom.MaterialData,
      });
    }

    // Create map: FinishGoodId (Int) -> total material qty per 1 FG
    const bomQtyPerFgMap = new Map<number, number>();
    for (const bom of bomData) {
      const current = bomQtyPerFgMap.get(bom.FinishGoodId) ?? 0;
      bomQtyPerFgMap.set(bom.FinishGoodId, current + bom.Qty);
    }

    // Transform data to match the expected format
    const snapshots = new Map(
      await Promise.all(
        forecastsData.map(
          async (f) =>
            [
              f.PoId,
              await latestSnapshot(this.prisma, f.PoId, releaseId),
            ] as const,
        ),
      ),
    );
    const forecasts = forecastsData.map((forecast) => {
      const fgId = fgPartNumberToIdMap.get(forecast.FinishGoodId);
      const snapshot = snapshots.get(forecast.PoId);
      const qtyRequired = snapshot
        ? snapshot.Lines.reduce((total, line) => total + line.RequiredQty, 0)
        : release.Status === 'DRAFT' && fgId
          ? forecast.Qty * (bomQtyPerFgMap.get(fgId) ?? 0)
          : 0;
      const bomMaterials = snapshot
        ? new Map(
            snapshot.Lines.map((line) => [
              line.MaterialId,
              {
                qty: line.QtyPerUnit,
                materialData: {
                  PartNumber: line.PartNumber,
                  PartName: line.PartName,
                },
              },
            ]),
          )
        : release.Status === 'DRAFT' && fgId
          ? bomByFgMap.get(fgId)
          : undefined;

      // Always start with every required material, then apply recorded picks.
      const shoppingByMaterial = new Map<
        string,
        {
          shoppingIds: string[];
          MaterialId: string;
          MaterialPartNumber: string | null;
          MaterialName: string | null;
          QtyPick: number;
          QtyRequired: number;
        }
      >();

      if (snapshot) {
        for (const line of snapshot.Lines) {
          shoppingByMaterial.set(line.PartNumber, {
            shoppingIds: [],
            MaterialId: line.PartNumber,
            MaterialPartNumber: line.PartNumber,
            MaterialName: line.PartName,
            QtyPick: 0,
            QtyRequired: line.RequiredQty,
          });
        }
      } else if (release.Status === 'DRAFT' && bomMaterials) {
        for (const bomInfo of bomMaterials.values()) {
          shoppingByMaterial.set(bomInfo.materialData.PartNumber, {
            shoppingIds: [],
            MaterialId: bomInfo.materialData.PartNumber,
            MaterialPartNumber: bomInfo.materialData.PartNumber,
            MaterialName: bomInfo.materialData.PartName,
            QtyPick: 0,
            QtyRequired: bomInfo.qty * forecast.Qty,
          });
        }
      }

      for (const shop of forecast.Shopping) {
        const existing = shoppingByMaterial.get(shop.MaterialId);
        if (existing) {
          existing.shoppingIds.push(shop.Id);
          existing.QtyPick += shop.QtyPick;
          continue;
        }

        shoppingByMaterial.set(shop.MaterialId, {
          shoppingIds: [shop.Id],
          MaterialId: shop.MaterialId,
          MaterialPartNumber: shop.MaterialData?.PartNumber ?? shop.MaterialId,
          MaterialName: shop.MaterialData?.PartName ?? null,
          QtyPick: shop.QtyPick,
          QtyRequired: 0,
        });
      }

      const shoppingList = [...shoppingByMaterial.values()]
        .map(({ shoppingIds, ...item }) => ({
          Id: shoppingIds.length === 1 ? shoppingIds[0] : null,
          ...item,
        }))
        .sort((a, b) => a.MaterialId.localeCompare(b.MaterialId));

      return {
        PoId: forecast.PoId,
        FinishGoodId: forecast.FinishGoodId,
        Qty: forecast.Qty,
        QtyRequired: qtyRequired,
        DeliveryDate: forecast.DeliveryDate,
        PartData: forecast.PartData,
        Shopping: shoppingList,
      };
    });

    // Rack locations are current master data, not frozen BOM snapshot data.
    const materialPartNumbers = [
      ...new Set(
        forecasts.flatMap((forecast) =>
          forecast.Shopping.map((item) => item.MaterialId),
        ),
      ),
    ];
    const materials = materialPartNumbers.length
      ? await this.prisma.material.findMany({
          where: { PartNumber: { in: materialPartNumbers } },
          select: { PartNumber: true, RackLocation: true },
        })
      : [];
    const rackLocations = new Map(
      materials.map((material) => [material.PartNumber, material.RackLocation]),
    );

    return {
      Forecasts: forecasts.map((forecast) => ({
        ...forecast,
        Shopping: forecast.Shopping.map((item) => ({
          ...item,
          RackLocation: rackLocations.get(item.MaterialId) ?? null,
        })),
      })),
    };
  }

  async getAutocompleteApprovers(): Promise<AutocompleteApproverEntity[]> {
    const users = await this.prisma.mTCUserManagement.findMany({
      where: {
        IsActive: true,
        Role: {
          RoleName: {
            in: ['MANAGER', 'SUPER', 'SUPER_ADMIN', 'MANAGEMENT'],
            mode: 'insensitive',
          },
        },
      },
      select: {
        Id: true,
        UserId: true,
        Name: true,
        PhoneNumber: true,
        Role: {
          select: {
            RoleName: true,
          },
        },
      },
      orderBy: { Name: 'asc' },
    });

    return users.map((u) => {
      const rawPhone = (u.PhoneNumber || '').trim();
      const hasPhone = rawPhone.length >= 8;
      let masked = hasPhone ? rawPhone : 'Belum ada No. WA';
      if (hasPhone) {
        const prefix = rawPhone.slice(0, 4);
        const suffix = rawPhone.slice(-4);
        masked = `${prefix}${'*'.repeat(Math.max(2, rawPhone.length - 8))}${suffix}`;
      }
      return {
        userId: u.UserId,
        name: u.Name,
        roleName: u.Role?.RoleName || 'MANAGER',
        hasPhoneNumber: hasPhone,
        maskedPhoneNumber: masked,
      };
    });
  }

  async requestAutocompleteOtp(
    releaseId: string,
    dto: RequestAutocompleteOtpDto,
    requesterUsername: string,
  ): Promise<RequestAutocompleteOtpResponseEntity> {
    const release = await this.prisma.productionRelease.findUnique({
      where: { Id: releaseId },
      select: { Id: true, ReleaseNumber: true, Status: true },
    });
    if (!release) {
      throw new NotFoundException(
        `Production release with ID ${releaseId} not found`,
      );
    }
    if (release.Status !== ProductionStatus.RELEASED) {
      throw new BadRequestException(
        `Only RELEASED production release can be autocompleted. Current status: ${release.Status}`,
      );
    }

    const approver = await this.prisma.mTCUserManagement.findFirst({
      where: {
        UserId: dto.approverUserId,
        IsActive: true,
        Role: {
          RoleName: {
            in: ['MANAGER', 'SUPER', 'SUPER_ADMIN', 'MANAGEMENT'],
            mode: 'insensitive',
          },
        },
      },
      select: {
        Id: true,
        UserId: true,
        Name: true,
        PhoneNumber: true,
        Role: { select: { RoleName: true } },
      },
    });

    if (!approver) {
      throw new BadRequestException(
        `Approver user ${dto.approverUserId} is not an active manager/super user`,
      );
    }

    let targetPhone = (dto.phoneNumber || approver.PhoneNumber || '').trim();

    if (!targetPhone) {
      throw new BadRequestException(
        `Approver ${approver.Name} belum memiliki nomor WhatsApp terdaftar. Silakan masukkan nomor WhatsApp pada form.`,
      );
    }

    if (dto.phoneNumber && dto.phoneNumber.trim() !== approver.PhoneNumber) {
      targetPhone = dto.phoneNumber.trim();
      await this.prisma.mTCUserManagement.update({
        where: { UserId: approver.UserId },
        data: { PhoneNumber: targetPhone },
      });
    }

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentChallenge =
      await this.prisma.productionReleaseApprovalChallenge.findFirst({
        where: {
          ProductionReleaseId: releaseId,
          RequesterUserId: requesterUsername,
          Status: ApprovalChallengeStatus.PENDING,
          CreatedAt: { gte: oneMinuteAgo },
        },
        orderBy: { CreatedAt: 'desc' },
      });

    if (recentChallenge) {
      const elapsedSeconds = Math.floor(
        (Date.now() - recentChallenge.CreatedAt.getTime()) / 1000,
      );
      const retryAfter = Math.max(1, 60 - elapsedSeconds);
      throw new ConflictException(
        `An OTP was recently requested. Please wait ${retryAfter} seconds before requesting a new OTP.`,
      );
    }

    await this.prisma.productionReleaseApprovalChallenge.updateMany({
      where: {
        ProductionReleaseId: releaseId,
        RequesterUserId: requesterUsername,
        Status: ApprovalChallengeStatus.PENDING,
      },
      data: {
        Status: ApprovalChallengeStatus.EXPIRED,
        UpdatedBy: requesterUsername,
      },
    });

    const rawOtp = randomInt(100000, 1000000).toString();
    const codeHash = createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const challenge =
      await this.prisma.productionReleaseApprovalChallenge.create({
        data: {
          ProductionReleaseId: releaseId,
          RequesterUserId: requesterUsername,
          ApproverUserId: approver.UserId,
          TargetPhoneNumber: targetPhone,
          CodeHash: codeHash,
          Status: ApprovalChallengeStatus.PENDING,
          AttemptCount: 0,
          MaxAttempts: 3,
          ExpiresAt: expiresAt,
          CreatedBy: requesterUsername,
          UpdatedBy: requesterUsername,
        },
      });

    const requester = await this.prisma.mTCUserManagement.findFirst({
      where: {
        OR: [
          { UserId: requesterUsername },
          { SsoObjectId: requesterUsername },
          { Id: requesterUsername },
        ],
      },
      select: { Name: true },
    });
    const requesterName = requester?.Name || 'Pengguna ANSEI';

    const message =
      `*ANSEI - APPROVAL OTP*\n\n` +
      `Halo *${approver.Name}*,\n` +
      `User *${requesterName}* mengajukan *Bypass & Autocomplete All* untuk Jadwal Rilis *${release.ReleaseNumber}*.\n\n` +
      `Kode OTP Anda: *${rawOtp}*\n\n` +
      `Kode ini berlaku selama 5 menit. JANGAN berikan kode ini kepada pihak yang tidak berkepentingan.`;

    await this.fonnteService.sendWhatsApp(targetPhone, message);

    const rawPhone = targetPhone;
    let masked = rawPhone;
    if (rawPhone.length >= 8) {
      const prefix = rawPhone.slice(0, 4);
      const suffix = rawPhone.slice(-4);
      masked = `${prefix}${'*'.repeat(Math.max(2, rawPhone.length - 8))}${suffix}`;
    }

    return {
      challengeId: challenge.Id,
      approverName: approver.Name,
      maskedPhoneNumber: masked,
      expiresInSeconds: 300,
    };
  }

  async executeAutocompleteAll(
    releaseId: string,
    dto: ExecuteAutocompleteDto,
    currentUser: ICurrentUser,
  ): Promise<ExecuteAutocompleteResponseEntity> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PROD_RELEASE_AUTOCOMPLETE_001',
        functionName: 'ProductionReleaseService.executeAutocompleteAll',
        createdBy: currentUser.username,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting autocomplete for release ${releaseId}`,
        type: 'INFO',
        location: 'production-release.service.ts:executeAutocompleteAll',
      });

      const release = await this.prisma.productionRelease.findUnique({
        where: { Id: releaseId },
        include: {
          Demands: true,
          LabelDatas: true,
        },
      });

      if (!release) {
        throw new NotFoundException(
          `Production release with ID ${releaseId} not found`,
        );
      }
      if (release.Status !== ProductionStatus.RELEASED) {
        throw new BadRequestException(
          `Only RELEASED production release can be autocompleted. Current status: ${release.Status}`,
        );
      }

      const challenge =
        await this.prisma.productionReleaseApprovalChallenge.findUnique({
          where: { Id: dto.challengeId },
        });
      if (!challenge) {
        throw new NotFoundException('OTP challenge not found');
      }
      if (challenge.ProductionReleaseId !== releaseId) {
        throw new BadRequestException(
          'OTP challenge does not match this release',
        );
      }
      if (challenge.RequesterUserId !== currentUser.username) {
        throw new BadRequestException(
          'OTP challenge does not belong to the requesting user',
        );
      }
      if (challenge.Status === ApprovalChallengeStatus.CONSUMED) {
        throw new ConflictException('OTP challenge has already been used');
      }
      if (
        challenge.Status === ApprovalChallengeStatus.LOCKED ||
        challenge.AttemptCount >= challenge.MaxAttempts
      ) {
        throw new ConflictException(
          'OTP challenge is locked due to maximum failed attempts exceeded',
        );
      }

      const now = new Date();
      if (
        challenge.Status === ApprovalChallengeStatus.EXPIRED ||
        now > challenge.ExpiresAt
      ) {
        if (challenge.Status !== ApprovalChallengeStatus.EXPIRED) {
          await this.prisma.productionReleaseApprovalChallenge.update({
            where: { Id: challenge.Id },
            data: {
              Status: ApprovalChallengeStatus.EXPIRED,
              UpdatedBy: currentUser.username,
            },
          });
        }
        throw new ConflictException(
          'OTP challenge has expired. Please request a new OTP.',
        );
      }

      const inputHash = createHash('sha256')
        .update(dto.otp.trim())
        .digest('hex');
      const isMatch = timingSafeEqual(
        Buffer.from(challenge.CodeHash, 'utf8'),
        Buffer.from(inputHash, 'utf8'),
      );

      if (!isMatch) {
        const nextAttempt = challenge.AttemptCount + 1;
        const isLocked = nextAttempt >= challenge.MaxAttempts;
        await this.prisma.productionReleaseApprovalChallenge.update({
          where: { Id: challenge.Id },
          data: {
            AttemptCount: nextAttempt,
            Status: isLocked
              ? ApprovalChallengeStatus.LOCKED
              : challenge.Status,
            UpdatedBy: currentUser.username,
          },
        });
        if (isLocked) {
          throw new ConflictException(
            'Too many failed OTP attempts. Challenge is now locked.',
          );
        }
        throw new BadRequestException(
          `Invalid OTP code. Remaining attempts: ${challenge.MaxAttempts - nextAttempt}`,
        );
      }

      await this.prisma.productionReleaseApprovalChallenge.update({
        where: { Id: challenge.Id },
        data: {
          Status: ApprovalChallengeStatus.CONSUMED,
          ConsumedAt: now,
          UpdatedBy: currentUser.username,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `OTP challenge ${challenge.Id} verified and consumed successfully`,
        type: 'INFO',
        location: 'production-release.service.ts:executeAutocompleteAll',
      });

      const activeCounting = await this.prisma.stockOpname.findFirst({
        where: { Status: { in: ['IN_PROGRESS', 'DRAFT'] } },
      });
      if (activeCounting) {
        throw new BadRequestException(
          'Cannot autocomplete production release while Stock Opname / Inventory Counting is active',
        );
      }

      // Assembly requirement and bypass are immutable label snapshots taken when
      // the release was activated. Do not re-read the mutable global setting here.
      const needsAssembly = release.LabelDatas.some(requiresAssemblyCompletion);

      let executorManpowerNik: string | undefined;

      if (needsAssembly && dto.manpowerNik) {
        const selectedManpower = await this.prisma.manPower.findUnique({
          where: { Nik: dto.manpowerNik },
        });
        if (!selectedManpower?.Status) {
          throw new BadRequestException(
            'Selected manpower is not found or inactive.',
          );
        }
        executorManpowerNik = selectedManpower.Nik;
      } else if (needsAssembly) {
        const userRecord = await this.prisma.mTCUserManagement.findUnique({
          where: { UserId: currentUser.username },
          include: { Manpower: true },
        });

        if (userRecord?.Manpower?.Nik && userRecord.Manpower.Status) {
          executorManpowerNik = userRecord.Manpower.Nik;
        } else {
          const manpowerByNik = await this.prisma.manPower.findUnique({
            where: { Nik: currentUser.username },
          });
          if (manpowerByNik && manpowerByNik.Status) {
            executorManpowerNik = manpowerByNik.Nik;
          } else {
            throw new BadRequestException(
              `User ${currentUser.username} is not mapped to an active Manpower record. Select an active manpower operator for assembly.`,
            );
          }
        }
      }

      let shoppingPicksCount = 0;
      let assemblySessionsCount = 0;
      let pokayokeScannedCount = 0;
      let deliveriesCreatedCount = 0;

      for (const demand of release.Demands) {
        const reqStatus = await this.shoppingService.checkRequirement(
          demand.Id,
        );
        if (reqStatus.summary.totalQtyRemaining > 0) {
          for (const item of reqStatus.requirements) {
            if (item.qtyRemaining > 0) {
              const material = await this.prisma.material.findUnique({
                where: { PartNumber: item.materialId },
                select: { QtyRack: true, PartNumber: true, PartName: true },
              });
              if (!material || material.QtyRack < item.qtyRemaining) {
                throw new BadRequestException(
                  `Insufficient rack stock for material ${material?.PartNumber || item.materialId}. Required: ${item.qtyRemaining}, Available: ${material?.QtyRack ?? 0}. Process stopped without creating synthetic stock.`,
                );
              }

              await this.shoppingService.create(
                {
                  requestId: randomUUID(),
                  materialId: item.materialId,
                  qtyPick: item.qtyRemaining,
                  type: 'REGULER',
                  purpose: 'STANDARD',
                  forecastId: demand.Id,
                  description: `Auto-complete pick for demand ${demand.Id}`,
                },
                currentUser.username,
              );
              shoppingPicksCount++;
            }
          }
        }

        const demandLabels = release.LabelDatas.filter(
          (l) => l.ProductionDemandId === demand.Id,
        );

        for (const label of demandLabels) {
          if (requiresAssemblyCompletion(label)) {
            const sessions = await this.prisma.assemblySession.findMany({
              where: { LabelDataId: label.Id },
              include: { ManPower: true },
              orderBy: { StartedAt: 'desc' },
            });

            const completed = sessions.find((s) => s.Status === 'COMPLETED');
            if (!completed) {
              const inProgress = sessions.find(
                (s) => s.Status === 'IN_PROGRESS',
              );
              if (inProgress) {
                await this.assemblyService.complete(
                  inProgress.Id,
                  {
                    requestId: randomUUID(),
                    manPowerNik:
                      inProgress.ManPower?.Nik || executorManpowerNik!,
                  },
                  currentUser.username,
                );
                assemblySessionsCount++;
              } else {
                const session = await this.assemblyService.start(
                  {
                    requestId: randomUUID(),
                    labelNumber: label.LabelNumber,
                    manPowerNik: executorManpowerNik!,
                  },
                  currentUser.username,
                  'INTERNAL',
                  currentUser.username,
                );
                await this.assemblyService.complete(
                  session.Id,
                  {
                    requestId: randomUUID(),
                    manPowerNik: executorManpowerNik!,
                  },
                  currentUser.username,
                );
                assemblySessionsCount++;
              }
            }
          }

          const freshLabel = await this.prisma.labelData.findUnique({
            where: { Id: label.Id },
            select: { Scanned: true },
          });

          if (!freshLabel?.Scanned) {
            await this.pokayokeService.scan(
              {
                labelNumber: label.LabelNumber,
                status: PokayokeCompareStatus.SUKSES,
              },
              currentUser.username,
            );
            pokayokeScannedCount++;
          }

          const existingDelivery = await this.prisma.deliveryHistory.findUnique(
            {
              where: { LabelDataId: label.LabelNumber },
            },
          );

          if (!existingDelivery) {
            await this.deliveryService.create(
              {
                labelNumber: label.LabelNumber,
              },
              currentUser.username,
            );
            deliveriesCreatedCount++;
          }
        }
      }

      const firstReleaseTrace =
        await this.prisma.productionTraceEvent.findFirst({
          where: {
            ReleaseId: releaseId,
            Type: 'RELEASE_STATUS_CHANGED',
          },
          orderBy: { CreatedAt: 'asc' },
        });
      const startTime = firstReleaseTrace
        ? firstReleaseTrace.CreatedAt.getTime()
        : release.CreatedAt.getTime();
      const durationMinutes = Math.max(
        1,
        Math.round((Date.now() - startTime) / 60000),
      );

      const attachmentCount =
        await this.prisma.productionReleaseAttachment.count({
          where: { ProductionReleaseId: releaseId },
        });

      await this.update(
        releaseId,
        {
          status: ProductionStatus.COMPLETED,
          totalProductionMinutes: durationMinutes,
          isNoAttachment:
            release.IsNoAttachment || attachmentCount > 0
              ? release.IsNoAttachment
              : true,
        },
        currentUser.username,
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Autocomplete completed successfully for release ${release.ReleaseNumber}. Duration: ${durationMinutes} mins.`,
        type: 'INFO',
        location: 'production-release.service.ts:executeAutocompleteAll',
      });
      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return {
        releaseId: release.Id,
        releaseNumber: release.ReleaseNumber,
        status: ProductionStatus.COMPLETED,
        totalProductionMinutes: durationMinutes,
        demandsProcessed: release.Demands.length,
        shoppingPicksCompleted: shoppingPicksCount,
        assemblySessionsCompleted: assemblySessionsCount,
        pokayokeScanned: pokayokeScannedCount,
        deliveriesCreated: deliveriesCreatedCount,
        message: `Production release ${release.ReleaseNumber} has been successfully autocompleted and marked COMPLETED.`,
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'production-release.service.ts:executeAutocompleteAll',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
