import {
  auditedTransaction,
  auditedWrite,
} from '../../common/helpers/audited-transaction.helper';
import {
  snapshotRelease,
  assertNoOutstandingReplacement,
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
} from './dto';
import type { LogProcessModel } from '../../generated/prisma/models';
import { ProductionStatus } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';
import { assertNoActiveInventoryCounting } from '../../common/helpers/inventory-counting-check.helper';
import { randomUUID } from 'node:crypto';
import { validateUploadContent } from '../../common/utils/upload-security.util';
import {
  buildProductionLabels,
  lockProductionFlow,
} from '../../common/helpers/production-flow.helper';

// Allowed file extensions and max size
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class ProductionReleaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
    private readonly nasUploadService: NasUploadService,
  ) {}

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private releaseConflict(error: unknown): never {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        'Production release conflicts with current database state. Refresh and try again.',
      );
    }
    throw error;
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

      return {
        ...release,
        TotalGoodQty: totalGoodQty,
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

    return {
      data: releasesWithProgress,
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
            ForecastId: true,
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

    return {
      ...release,
      TotalGoodQty: totalGoodQty,
    };
  }

  async getForecastCandidates(
    id: string,
    query: ProductionReleaseForecastCandidatesQueryDto,
  ) {
    const release = await this.prisma.productionRelease.findUnique({
      where: { Id: id },
      select: { Status: true },
    });
    if (!release)
      throw new NotFoundException(`ProductionRelease with id ${id} not found`);
    if (release.Status !== ProductionStatus.RELEASED)
      throw new ConflictException(
        'Forecasts can only be managed for a RELEASED production release.',
      );
    const where: Prisma.ForecastWhereInput = {
      ProductionReleaseId: query.mode === 'untag' ? id : null,
      ...(query.search
        ? {
            OR: [
              { PoId: { contains: query.search, mode: 'insensitive' } },
              {
                FinishGoodId: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              { VendorName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [totalItems, data] = await Promise.all([
      this.prisma.forecast.count({ where }),
      this.prisma.forecast.findMany({
        where,
        select: {
          Id: true,
          PoId: true,
          Qty: true,
          FinishGoodId: true,
          ProductionReleaseId: true,
          DeliveryDate: true,
          VendorName: true,
          PartData: { select: { PartNumber: true, PartName: true } },
        },
        orderBy: [{ DeliveryDate: 'asc' }, { PoId: 'asc' }],
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

  private async getAmendmentForecasts(
    tx: Prisma.TransactionClient,
    forecastIds: string[],
  ) {
    const forecasts = await tx.forecast.findMany({
      where: { PoId: { in: forecastIds } },
      select: {
        PoId: true,
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
      throw new NotFoundException(
        `Forecast(s) not found: ${missing.join(', ')}`,
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
        forecast._count.Shopping > 0 ||
        forecast._count.ProductionReport > 0 ||
        forecast._count.DeliveryHistory > 0 ||
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
            await tx.forecast.findMany({
              where: { ProductionReleaseId: id },
              select: { PoId: true },
            })
          ).map((item) => item.PoId);
          const forecasts = await this.getAmendmentForecasts(tx, forecastIds);
          this.assertNoOperationalActivity(forecasts);
          await tx.labelData.deleteMany({ where: { ProductionReleaseId: id } });
          await tx.forecast.updateMany({
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
          await this.requireReleased(tx, id);
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
          this.assertNoOperationalActivity(forecasts);
          const labels = this.buildLabels(id, forecasts);
          const result = await tx.forecast.updateMany({
            where: { PoId: { in: dto.forecastIds }, ProductionReleaseId: null },
            data: { ProductionReleaseId: id },
          });
          if (result.count !== forecasts.length)
            throw new ConflictException(
              'Forecast assignment changed. Refresh and try again.',
            );
          await snapshotRelease(tx, id, actor, log.ProcessId);
          const createdLabels = await tx.labelData.createMany({ data: labels });
          if (createdLabels.count !== labels.length)
            throw new ConflictException(
              'Not all labels could be generated. Refresh and try again.',
            );
          const aggregate = await tx.forecast.aggregate({
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
          await this.requireReleased(tx, id);
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
          this.assertNoOperationalActivity(forecasts);
          const linkedCount = await tx.forecast.count({
            where: { ProductionReleaseId: id },
          });
          if (linkedCount === forecasts.length)
            throw new ConflictException(
              'Cannot remove all forecasts. Cancel the production release instead.',
            );
          await tx.labelData.deleteMany({
            where: {
              ProductionReleaseId: id,
              ForecastId: { in: dto.forecastIds },
            },
          });
          const result = await tx.forecast.updateMany({
            where: { PoId: { in: dto.forecastIds }, ProductionReleaseId: id },
            data: { ProductionReleaseId: null },
          });
          if (result.count !== forecasts.length)
            throw new ConflictException(
              'Forecast assignment changed. Refresh and try again.',
            );
          const aggregate = await tx.forecast.aggregate({
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
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PROD_RELEASE_001',
        functionName: 'ProductionReleaseService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating production release: ${dto.releaseNumber}`,
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
          const forecasts = await tx.forecast.findMany({
            where: { PoId: { in: forecastIds }, ProductionReleaseId: null },
            select: { PoId: true, Qty: true },
          });
          if (forecasts.length !== forecastIds.length) {
            throw new ConflictException(
              'One or more forecasts do not exist or are already assigned. Refresh and try again.',
            );
          }
          const created = await tx.productionRelease.create({
            data: {
              ReleaseNumber: dto.releaseNumber,
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
          const assignment = await tx.forecast.updateMany({
            where: {
              PoId: { in: forecastIds },
              ProductionReleaseId: null,
            },
            data: { ProductionReleaseId: created.Id },
          });
          if (assignment.count !== forecastIds.length) {
            throw new ConflictException(
              'Forecast assignment changed. Refresh and try again.',
            );
          }
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

          if (dto.forecastIds !== undefined) {
            const forecastIds = [...new Set(dto.forecastIds)];
            if (forecastIds.length === 0) {
              throw new BadRequestException('forecastIds cannot be empty');
            }
            const forecasts = await tx.forecast.findMany({
              where: {
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
            await tx.forecast.updateMany({
              where: { ProductionReleaseId: id },
              data: { ProductionReleaseId: null },
            });
            const linked = await tx.forecast.updateMany({
              where: {
                PoId: { in: forecastIds },
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

          const linkedForecasts = await tx.forecast.findMany({
            where: { ProductionReleaseId: id },
            select: {
              PoId: true,
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
            const labels = this.buildLabels(
              id,
              linkedForecasts.map((forecast) => ({
                ...forecast,
                ProductionReleaseId: id,
                _count: {
                  Shopping: 0,
                  ProductionReport: 0,
                  DeliveryHistory: 0,
                },
                LabelData: [],
              })),
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
              tx.forecast.findMany({
                where: { ProductionReleaseId: id },
                select: {
                  PoId: true,
                  Qty: true,
                  FinishGoodId: true,
                  DeliveryHistory: { select: { Qty: true } },
                  LabelData: {
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

          if (isClosing) await assertNoOutstandingReplacement(tx, id);
          if (
            dto.status === ProductionStatus.RELEASED ||
            existing.Status === ProductionStatus.RELEASED
          )
            await snapshotRelease(tx, id, updatedBy, logProcess!.ProcessId);
          if (dto.status && dto.status !== existing.Status) {
            const linkedOrders = await tx.forecast.findMany({
              where: { ProductionReleaseId: id },
              select: { PoId: true },
            });
            await tx.productionTraceEvent.createMany({
              data: linkedOrders.map((order) => ({
                ForecastId: order.PoId,
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
    const forecasts = await this.prisma.forecast.findMany({
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
    const forecasts = await this.prisma.forecast.findMany({
      where: { ProductionReleaseId: releaseId },
      select: {
        PoId: true,
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

    const labelDataToCreate: {
      LabelNumber: string;
      FinishGoodId: string;
      ForecastId: string;
      Scanned: boolean;
      QtyThisBox: number;
      ProductionReleaseId: string;
      RequiresAssembly: boolean;
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
          ForecastId: forecast.PoId,
          Scanned: false,
          QtyThisBox: qtyInBox,
          ProductionReleaseId: releaseId,
          RequiresAssembly: !forecast.PartData.IsPassthrough,
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
          await tx.forecast.updateMany({
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
    const forecastsData = await this.prisma.forecast.findMany({
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
      const bomQtyPerFg = snapshot
        ? snapshot.Lines.reduce((n, l) => n + l.QtyPerUnit, 0)
        : release.Status === 'DRAFT' && fgId
          ? (bomQtyPerFgMap.get(fgId) ?? 0)
          : 0;
      const qtyRequired = forecast.Qty * bomQtyPerFg;
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

      // Get shopping data or generate from BOM if empty
      let shoppingList: Array<{
        Id: string | null;
        MaterialId: string;
        MaterialPartNumber: string | null;
        MaterialName: string | null;
        QtyPick: number;
        QtyRequired: number;
      }>;

      if (forecast.Shopping.length > 0) {
        // Use existing shopping data with QtyRequired from BOM
        shoppingList = forecast.Shopping.map((shop) => {
          // Get QtyRequired for this material from BOM
          const bomEntry = bomMaterials?.get(
            shop.MaterialData?.PartNumber
              ? // MaterialData uses PartNumber which needs to be mapped to MaterialId
                // For now, calculate based on shopping material ID match with BOM material
                0
              : 0,
          );

          // Find matching BOM entry by material ID
          let qtyRequiredPerMaterial =
            snapshot?.Lines.find((line) => line.Id === shop.SnapshotLineId)
              ?.RequiredQty ?? 0;
          if (!qtyRequiredPerMaterial && bomMaterials) {
            for (const [bomMaterialId, bomInfo] of bomMaterials) {
              if (shop.MaterialId === bomInfo.materialData.PartNumber) {
                qtyRequiredPerMaterial = bomInfo.qty * forecast.Qty;
                break;
              }
            }
          }

          return {
            Id: shop.Id,
            MaterialId: shop.MaterialId,
            MaterialPartNumber:
              shop.MaterialData?.PartNumber ?? shop.MaterialId,
            MaterialName: shop.MaterialData?.PartName,
            QtyPick: shop.QtyPick,
            QtyRequired: qtyRequiredPerMaterial,
          };
        });
      } else if (bomMaterials && bomMaterials.size > 0) {
        // No shopping data - generate from BOM with QtyRequired
        shoppingList = [];
        for (const [materialId, bomInfo] of bomMaterials) {
          shoppingList.push({
            Id: null,
            MaterialId: bomInfo.materialData.PartNumber,
            MaterialPartNumber: bomInfo.materialData.PartNumber,
            MaterialName: bomInfo.materialData.PartName,
            QtyPick: 0,
            QtyRequired: bomInfo.qty * forecast.Qty,
          });
        }
        // Sort by MaterialId
        shoppingList.sort((a, b) => a.MaterialId.localeCompare(b.MaterialId));
      } else {
        shoppingList = [];
      }

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

    return { Forecasts: forecasts };
  }
}
