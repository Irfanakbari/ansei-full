import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NasUploadService } from '../../common/utils/nas-upload.service';
import {
  CreateProductionReleaseDto,
  UpdateProductionReleaseDto,
  UploadProductionAttachmentDto,
} from './dto';
import type { LogProcessModel } from '../../generated/prisma/models';
import { ProductionStatus } from '../../generated/prisma/enums';

// Allowed file extensions and max size
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class ProductionReleaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
    private readonly nasUploadService: NasUploadService,
  ) {}

  async findAll(status?: ProductionStatus) {
    const where = status ? { Status: status } : undefined;

    const releases = await this.prisma.productionRelease.findMany({
      where,
      include: {
        Forecasts: {
          select: {
            PoId: true,
            FinishGoodId: true,
            Qty: true,
            DeliveryDate: true,
            AttachmentDelivery: true,
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
            DeliveryAttachment: true,
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

    return releasesWithProgress;
  }

  async findOne(id: string) {
    const release = await this.prisma.productionRelease.findUnique({
      where: { Id: id },
      include: {
        Forecasts: {
          include: {
            PartData: {
              select: {
                PartNumber: true,
                PartName: true,
              },
            },
            Shopping: {
              select: {
                Id: true,
                QtyPick: true,
              },
            },
            AttachmentDelivery: true,
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
        DeliveryAttachment: {
          orderBy: {
            CreatedAt: 'desc',
          },
        },
      },
    });

    if (!release) {
      throw new NotFoundException(`ProductionRelease with id ${id} not found`);
    }

    return release;
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

      // Check if there's already a RELEASED release (only one RELEASED allowed at a time)
      const existingReleased = await this.prisma.productionRelease.findFirst({
        where: {
          Status: ProductionStatus.RELEASED,
        },
      });

      if (existingReleased) {
        throw new BadRequestException(
          `Cannot create new release. There is already a RELEASED production release (${existingReleased.ReleaseNumber}). Only one RELEASED release is allowed at a time.`,
        );
      }

      const result = await this.prisma.productionRelease.create({
        data: {
          ReleaseNumber: dto.releaseNumber,
          PlanDate: new Date(dto.planDate),
          Notes: dto.notes,
          Status: ProductionStatus.DRAFT,
          CreatedBy: createdBy,
          IsNoAttachment: dto.isNoAttachment ?? false,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Production release created with IsNoAttachment: ${dto.isNoAttachment ?? false}`,
        type: 'INFO',
        location: 'production-release.service.ts:301',
      });

      // Validate forecastIds (now required via DTO validation)
      if (dto.forecastIds.length === 0) {
        throw new BadRequestException('forecastIds cannot be empty');
      }

      // Link forecasts to release
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Linking ${dto.forecastIds.length} forecasts to release`,
        type: 'INFO',
        location: 'production-release.service.ts:78',
      });

      // Update Forecasts with ProductionReleaseId
      await this.prisma.forecast.updateMany({
        where: {
          PoId: { in: dto.forecastIds },
        },
        data: {
          ProductionReleaseId: result.Id,
        },
      });

      // Calculate and update TotalTargetQty
      const forecasts = await this.prisma.forecast.findMany({
        where: { PoId: { in: dto.forecastIds } },
        select: { Qty: true },
      });
      const totalTargetQty = forecasts.reduce((sum, f) => sum + f.Qty, 0);

      await this.prisma.productionRelease.update({
        where: { Id: result.Id },
        data: { TotalTargetQty: totalTargetQty },
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
      throw error;
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

      const existing = await this.prisma.productionRelease.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(
          `ProductionRelease with id ${id} not found`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating production release ${existing.ReleaseNumber}, current status: ${existing.Status}`,
        type: 'INFO',
        location: 'production-release.service.ts:140',
      });

      // Check if trying to change from RELEASED back to DRAFT
      if (
        dto.status === ProductionStatus.DRAFT &&
        existing.Status === ProductionStatus.RELEASED
      ) {
        throw new BadRequestException(
          'Cannot change status from RELEASED to DRAFT. Once released, a production release cannot be reverted.',
        );
      }

      // If status is being changed to RELEASED, generate LabelData
      if (
        dto.status === ProductionStatus.RELEASED &&
        existing.Status !== ProductionStatus.RELEASED
      ) {
        // Check if there's already another RELEASED release (only one RELEASED allowed at a time)
        const existingReleased = await this.prisma.productionRelease.findFirst({
          where: {
            Status: ProductionStatus.RELEASED,
            Id: { not: id }, // Exclude current release being updated
          },
        });

        if (existingReleased) {
          throw new BadRequestException(
            `Cannot release. There is already another RELEASED production release (${existingReleased.ReleaseNumber}). Only one RELEASED release is allowed at a time.`,
          );
        }

        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message:
            'Status changing to RELEASED - generating LabelData for all linked forecasts',
          type: 'INFO',
          location: 'production-release.service.ts:155',
        });

        await this.generateLabelsForRelease(id, logProcess.ProcessId);
      }

      // Update forecast links if provided
      if (dto.forecastIds !== undefined) {
        // First, unlink all existing forecasts
        await this.prisma.forecast.updateMany({
          where: { ProductionReleaseId: id },
          data: { ProductionReleaseId: null },
        });

        // Then link new forecasts
        if (dto.forecastIds.length > 0) {
          await this.prisma.forecast.updateMany({
            where: { PoId: { in: dto.forecastIds } },
            data: { ProductionReleaseId: id },
          });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (dto.planDate !== undefined)
        updateData.PlanDate = new Date(dto.planDate);
      if (dto.status !== undefined) updateData.Status = dto.status;
      if (dto.notes !== undefined) updateData.Notes = dto.notes;
      if (dto.isNoAttachment !== undefined)
        updateData.IsNoAttachment = dto.isNoAttachment;

      // Recalculate TotalTargetQty from linked forecasts
      const linkedForecasts = await this.prisma.forecast.findMany({
        where: { ProductionReleaseId: id },
        select: { Qty: true },
      });

      updateData.TotalTargetQty = linkedForecasts.reduce(
        (sum, f) => sum + f.Qty,
        0,
      );

      const result = await this.prisma.productionRelease.update({
        where: { Id: id },
        data: updateData,
      });

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
      throw error;
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
        });
      }
    }

    if (labelDataToCreate.length > 0) {
      await this.prisma.labelData.createMany({
        data: labelDataToCreate,
        skipDuplicates: true,
      });

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
      await this.prisma.$transaction(async (tx) => {
        const processId = logProcess!.ProcessId;

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

    return this.prisma.productionRelease.update({
      where: { Id: id },
      data: {
        TotalGoodQty: release.TotalGoodQty + goodQty,
        TotalNgQty: release.TotalNgQty + ngQty,
      },
    });
  }

  /**
   * Upload attachment for production release
   * Only accepts PDF or image files (jpg, jpeg, png, gif, webp), max 10MB
   */
  async uploadAttachment(
    dto: UploadProductionAttachmentDto,
    file: Express.Multer.File,
    createdBy: string,
  ): Promise<any[]> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PROD_RELEASE_ATTACH_001',
        functionName: 'ProductionReleaseService.UploadAttachment',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting attachment upload for production release: ${dto.productionReleaseId}`,
        type: 'INFO',
        location: 'production-release.service.ts:770',
      });

      // Validate file extension
      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
      if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Invalid file extension: ${fileExtension}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
          type: 'ERROR',
          location: 'production-release.service.ts:782',
        });
        throw new UnsupportedMediaTypeException(
          `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `File too large: ${file.size} bytes. Max: ${MAX_FILE_SIZE} bytes`,
          type: 'ERROR',
          location: 'production-release.service.ts:793',
        });
        throw new BadRequestException(`File too large. Maximum size is 10MB`);
      }

      // Check if production release exists
      const release = await this.prisma.productionRelease.findUnique({
        where: { Id: dto.productionReleaseId },
      });

      if (!release) {
        throw new NotFoundException(
          `ProductionRelease with id ${dto.productionReleaseId} not found`,
        );
      }

      // POKAYOKE: Cannot upload attachment if IsNoAttachment is true
      if (release.IsNoAttachment) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE FAILED: Cannot upload attachment - Production Release ${release.ReleaseNumber} is marked as IsNoAttachment`,
          type: 'ERROR',
          location: 'production-release.service.ts:813',
        });
        throw new BadRequestException(
          `Cannot upload attachment. Production Release ${release.ReleaseNumber} is marked as "Tanpa Lampiran" (IsNoAttachment). Please update the release to allow attachments first.`,
        );
      }

      // POKAYOKE: Cannot upload attachment if status is not DRAFT or RELEASED
      if (
        release.Status !== ProductionStatus.DRAFT &&
        release.Status !== ProductionStatus.RELEASED
      ) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE FAILED: Cannot upload attachment - Production Release status is ${release.Status}`,
          type: 'ERROR',
          location: 'production-release.service.ts:878',
        });
        throw new BadRequestException(
          `Cannot upload attachment. Production Release status is ${release.Status}. Attachments can only be uploaded when status is DRAFT or RELEASED.`,
        );
      }

      // Determine which forecasts to attach the file to and get PoNumber for filename
      let forecastIdsToAttach: string[] = [];
      let poNumberForFilename = '';

      if (dto.forecastId) {
        const forecast = await this.prisma.forecast.findUnique({
          where: { PoId: dto.forecastId },
        });

        if (!forecast) {
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `POKAYOKE FAILED: Forecast ${dto.forecastId} not found`,
            type: 'ERROR',
            location: 'production-release.service.ts:910',
          });
          throw new NotFoundException(
            `Forecast with id ${dto.forecastId} not found`,
          );
        }

        if (forecast.ProductionReleaseId !== dto.productionReleaseId) {
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `POKAYOKE FAILED: Forecast ${dto.forecastId} is not linked to production release ${dto.productionReleaseId}`,
            type: 'ERROR',
            location: 'production-release.service.ts:922',
          });
          throw new BadRequestException(
            `Forecast ${dto.forecastId} is not linked to this production release`,
          );
        }

        poNumberForFilename = forecast.PoNumber;

        const relatedForecasts = await this.prisma.forecast.findMany({
          where: { PoNumber: forecast.PoNumber },
          select: { PoId: true },
        });

        forecastIdsToAttach = relatedForecasts.map((f) => f.PoId);

        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Found ${forecastIdsToAttach.length} forecasts with PoNumber ${forecast.PoNumber}`,
          type: 'INFO',
          location: 'production-release.service.ts:950',
        });
      }

      // Generate filename: PoNumber_ddMMyyyy.extension
      const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
      const dateStr = new Date()
        .toLocaleDateString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        .replace(/\//g, '');
      const newFileName = poNumberForFilename
        ? `${poNumberForFilename}_${dateStr}.${ext}`
        : `${dateStr}.${ext}`;

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Uploading file as: ${newFileName}`,
        type: 'INFO',
        location: 'production-release.service.ts:965',
      });

      // Upload file to NAS with formatted filename
      const fileUrl = await this.nasUploadService.uploadFile({
        fileName: newFileName,
        fileBuffer: file.buffer,
        subFolder: dto.productionReleaseId,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `File uploaded to NAS: ${fileUrl}`,
        type: 'INFO',
        location: 'production-release.service.ts:962',
      });

      // Create delivery attachments
      // If forecastId provided: create ONE attachment per PoNumber (all forecasts with same PoNumber share this attachment)
      // If no forecastId: create ONE attachment for production release only

      let attachments: any[] = [];

      // Create single attachment (point to same file for all)
      const attachment = await this.prisma.deliveryAttachment.create({
        data: {
          FileName: newFileName,
          FilePath: fileUrl,
          ProductionReleaseId: dto.productionReleaseId,
          CreatedBy: createdBy,
        },
      });

      attachments = [attachment];

      // Link all forecasts with same PoNumber to this attachment
      if (forecastIdsToAttach.length > 0) {
        await this.prisma.forecast.updateMany({
          where: { PoId: { in: forecastIdsToAttach } },
          data: { AttachmentDeliveryId: attachment.id },
        });

        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Linked ${forecastIdsToAttach.length} forecasts to attachment ${attachment.id}`,
          type: 'INFO',
          location: 'production-release.service.ts:1010',
        });
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message:
          forecastIdsToAttach.length > 0
            ? `Created 1 delivery attachment for PoNumber group (${forecastIdsToAttach.length} forecasts share this attachment): ${fileUrl}`
            : `Created delivery attachment with id: ${attachment.id} (production release only)`,
        type: 'INFO',
        location: 'production-release.service.ts:1020',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return attachments;
    } catch (error) {
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

    return this.prisma.deliveryAttachment.findMany({
      where: { ProductionReleaseId: productionReleaseId },
      orderBy: { CreatedAt: 'desc' },
    });
  }

  /**
   * Delete attachment
   */
  async deleteAttachment(
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

      const attachment = await this.prisma.deliveryAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment) {
        throw new NotFoundException(
          `DeliveryAttachment with id ${attachmentId} not found`,
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
            message: `File deleted from NAS: ${attachment.FilePath}`,
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
      await this.prisma.deliveryAttachment.delete({
        where: { id: attachmentId },
      });

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
        AttachmentDelivery: {
          select: {
            FileName: true,
          },
        },
        PartData: {
          select: {
            PartNumber: true,
            PartName: true,
          },
        },
        Shopping: {
          select: {
            Id: true,
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
    const forecasts = forecastsData.map((forecast) => {
      const fgId = fgPartNumberToIdMap.get(forecast.FinishGoodId);
      const bomQtyPerFg = fgId ? (bomQtyPerFgMap.get(fgId) ?? 0) : 0;
      const qtyRequired = forecast.Qty * bomQtyPerFg;
      const bomMaterials = fgId ? bomByFgMap.get(fgId) : undefined;

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
          let qtyRequiredPerMaterial = 0;
          if (bomMaterials) {
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
        AttachmentDelivery: forecast.AttachmentDelivery?.FileName ?? null,
        PartData: forecast.PartData,
        Shopping: shoppingList,
      };
    });

    return { Forecasts: forecasts };
  }
}
