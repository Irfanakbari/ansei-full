import { snapshotBomEntries } from '../../common/helpers/bom-snapshot.helper';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { CreateDeliveryDto, DeliveryQueryDto } from './dto/create-delivery.dto';
import { DeliveryDto, PaginatedDeliveryDto } from './dto/delivery-response.dto';
import type { LogProcessModel } from '../../generated/prisma/models';
import {
  LocationType,
  TransactionType,
  ItemCategory,
} from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { assertNoActiveInventoryCounting } from '../../common/helpers/inventory-counting-check.helper';
import { withInventoryTransaction } from '../../common/helpers/inventory-transaction.helper';
import {
  assertLabelReady,
  lockProductionFlow,
} from '../../common/helpers/production-flow.helper';
import { OutboxService } from '../../common/outbox/outbox.service';
import { getDeliveryProgress } from '../../common/helpers/delivery-progress.helper';

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
    private readonly outboxService: OutboxService,
  ) {}

  async getPalletOptions(): Promise<
    Array<{ kode: string; name?: string; partName?: string }>
  > {
    const palletsUrl =
      process.env.PALLET_CONNECTOR_PALLETS_URL ||
      'https://apps2.vuteq.co.id/connector/v2/pallets?customer=P';
    const apiKey = process.env.PALLET_CONNECTOR_API_KEY?.trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }
      const res = await fetch(palletsUrl, {
        headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        return [];
      }
      const json = (await res.json()) as {
        data?: Array<{
          kode: string;
          name?: string;
          partName?: string;
          isActive?: number;
        }>;
      };
      const list = Array.isArray(json?.data) ? json.data : [];
      return list
        .filter(
          (item) =>
            item &&
            item.isActive === 1 &&
            typeof item.kode === 'string' &&
            item.kode.trim().length > 0,
        )
        .map((item) => ({
          kode: item.kode.trim(),
          name: item.name ?? undefined,
          partName: item.partName ?? undefined,
        }));
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  async create(dto: CreateDeliveryDto, createdBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'DELIVERY_001',
        functionName: 'DeliveryService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting delivery process: LabelNumber=${dto.labelNumber}`,
        type: 'INFO',
        location: 'delivery.service.ts:30',
      });

      // POKAYOKE: Tolak pengiriman jika sesi Inventory Counting sedang aktif
      await assertNoActiveInventoryCounting(
        this.prisma,
        ItemCategory.FINISH_GOOD,
        'Delivery Finish Good',
      );

      // ========== POKAYOKE 1: Validate LabelData exists ==========
      const labelData = await this.prisma.labelData.findUnique({
        where: { LabelNumber: dto.labelNumber },
        include: {
          PartData: {
            select: {
              PartNumber: true,
              PartName: true,
              Qty: true,
            },
          },
          POData: {
            select: {
              PoId: true,
              Qty: true,
            },
          },
        },
      });

      if (!labelData) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE 1 FAILED: LabelData with LabelNumber ${dto.labelNumber} not found`,
          type: 'ERROR',
          location: 'delivery.service.ts:48',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE 1: LabelData with LabelNumber ${dto.labelNumber} not found in system`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `POKAYOKE 1 PASSED: LabelData ${labelData.Id} found (LabelNumber=${labelData.LabelNumber}, FinishGood=${labelData.FinishGoodId})`,
        type: 'INFO',
        location: 'delivery.service.ts:60',
      });

      // ========== POKAYOKE 2: Check if LabelData is Scanned (POKAYOKE validated) ==========
      if (!labelData.Scanned) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE 2 FAILED: LabelData ${labelData.Id} not scanned yet (Scanned=false)`,
          type: 'ERROR',
          location: 'delivery.service.ts:70',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE 2: LabelData ${labelData.LabelNumber} has not been validated by POKAYOKE scan yet. Please scan the part tag first.`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `POKAYOKE 2 PASSED: LabelData ${labelData.Id} already scanned (Scanned=true)`,
        type: 'INFO',
        location: 'delivery.service.ts:82',
      });

      // ========== POKAYOKE 3: Validate ForecastId exists ==========
      if (!labelData.ForecastId) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE 3 FAILED: No ForecastId associated with LabelData ${labelData.Id}`,
          type: 'ERROR',
          location: 'delivery.service.ts:92',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE 3: No Forecast/PO associated with LabelData ${labelData.LabelNumber}`,
        );
      }

      const forecast = await this.prisma.forecast.findUnique({
        where: { PoId: labelData.ForecastId },
      });

      if (!forecast) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE 3 FAILED: Forecast ${labelData.ForecastId} not found`,
          type: 'ERROR',
          location: 'delivery.service.ts:106',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE 3: Forecast/PO ${labelData.ForecastId} not found in system`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `POKAYOKE 3 PASSED: Forecast ${forecast.PoId} found (Vendor=${forecast.VendorName}, Qty=${forecast.Qty})`,
        type: 'INFO',
        location: 'delivery.service.ts:118',
      });

      // ========== POKAYOKE 4: Check if Forecast shopping is complete (all materials picked) ==========
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `POKAYOKE 4: Checking if shopping is complete for Forecast ${forecast.PoId}`,
        type: 'INFO',
        location: 'delivery.service.ts:128',
      });

      // Get BOM for this FinishGood
      const bomEntries = await snapshotBomEntries(this.prisma, forecast.PoId);

      // Get all shopping for this forecast
      const shoppings = await this.prisma.shopping.findMany({
        where: { ForecastId: forecast.PoId, Purpose: 'STANDARD' },
        select: { MaterialId: true, QtyPick: true },
      });

      // Calculate total picked per material
      const pickedByMaterial = new Map<string, number>();
      for (const shop of shoppings) {
        const current = pickedByMaterial.get(shop.MaterialId) || 0;
        pickedByMaterial.set(shop.MaterialId, current + shop.QtyPick);
      }

      // Check if all materials are fully picked
      const incompletelyPickedMaterials: string[] = [];
      for (const bom of bomEntries) {
        const totalRequired = forecast.Qty * bom.Qty;
        const alreadyPicked =
          pickedByMaterial.get(bom.MaterialData?.PartNumber || '') || 0;

        if (alreadyPicked < totalRequired) {
          incompletelyPickedMaterials.push(
            `${bom.MaterialData?.PartNumber || 'Unknown'} (Needed: ${totalRequired}, Picked: ${alreadyPicked})`,
          );
        }
      }

      if (incompletelyPickedMaterials.length > 0) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE 4 FAILED: Incomplete shopping for Forecast ${forecast.PoId}: ${incompletelyPickedMaterials.join(', ')}`,
          type: 'ERROR',
          location: 'delivery.service.ts:158',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE 4: Shopping for Forecast ${forecast.PoId} is not complete. Incomplete materials: ${incompletelyPickedMaterials.join('; ')}. Please complete all material picking before delivery.`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `POKAYOKE 4 PASSED: All materials for Forecast ${forecast.PoId} are fully picked`,
        type: 'INFO',
        location: 'delivery.service.ts:170',
      });

      // ========== POKAYOKE 5: Check if ProductionRelease status is RELEASED ==========
      if (!forecast.ProductionReleaseId) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE 5 FAILED: No ProductionRelease associated with Forecast ${forecast.PoId}`,
          type: 'ERROR',
          location: 'delivery.service.ts:180',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE 5: Forecast ${forecast.PoId} is not scheduled in any Production Release`,
        );
      }

      const productionRelease = await this.prisma.productionRelease.findUnique({
        where: { Id: forecast.ProductionReleaseId },
      });

      if (!productionRelease) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE 5 FAILED: ProductionRelease ${forecast.ProductionReleaseId} not found`,
          type: 'ERROR',
          location: 'delivery.service.ts:194',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE 5: ProductionRelease not found`,
        );
      }

      if (productionRelease.Status !== 'RELEASED') {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE 5 FAILED: ProductionRelease ${productionRelease.ReleaseNumber} status is ${productionRelease.Status}, must be RELEASED`,
          type: 'ERROR',
          location: 'delivery.service.ts:208',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE 5: Production Release ${productionRelease.ReleaseNumber} is in "${productionRelease.Status}" status. Only "RELEASED" production can proceed with delivery.`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `POKAYOKE 5 PASSED: ProductionRelease ${productionRelease.ReleaseNumber} is RELEASED`,
        type: 'INFO',
        location: 'delivery.service.ts:220',
      });

      // ========== POKAYOKE 6: Check for duplicate delivery ==========
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `POKAYOKE 6: Checking if label ${labelData.LabelNumber} has already been delivered`,
        type: 'INFO',
        location: 'delivery.service.ts:254',
      });

      const existingDelivery = await this.prisma.deliveryHistory.findFirst({
        where: { LabelDataId: labelData.LabelNumber },
        orderBy: { CreatedAt: 'desc' },
      });

      if (existingDelivery) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE 6 FAILED: Label ${labelData.LabelNumber} already delivered (ID=${existingDelivery.Id}, Qty=${existingDelivery.Qty})`,
          type: 'WARN',
          location: 'delivery.service.ts:268',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        return {
          success: false,
          isDuplicate: true,
          message: `Label ${labelData.LabelNumber} has already been delivered`,
          data: {
            id: existingDelivery.Id,
            forecastId: existingDelivery.ForecastId,
            qty: existingDelivery.Qty,
            deliveredAt: existingDelivery.CreatedAt,
            deliveredBy: existingDelivery.CreatedBy,
          },
        };
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `POKAYOKE 6 PASSED: Label ${labelData.LabelNumber} has not been delivered yet`,
        type: 'INFO',
        location: 'delivery.service.ts:286',
      });

      // ========== EXECUTE: Create DeliveryHistory and update stock ==========
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `All POKAYOKE checks passed. Creating DeliveryHistory for LabelData ${labelData.Id}`,
        type: 'INFO',
        location: 'delivery.service.ts:230',
      });

      // Store processId in local variable to avoid shadowing with Node.js global process
      const localProcessId = logProcess.ProcessId;
      const internalLabelDataId = labelData.Id;

      // Create DeliveryHistory and update stock in transaction
      const result = await withInventoryTransaction(
        this.prisma,
        ItemCategory.FINISH_GOOD,
        async (tx) => {
          await lockProductionFlow(tx);
          const { label: labelData, forecast: currentForecast } =
            await assertLabelReady(tx, internalLabelDataId, true);
          await this.assertEarlierDeliveryPeriodsComplete(tx, currentForecast);
          await assertNoActiveInventoryCounting(
            tx,
            ItemCategory.FINISH_GOOD,
            'Delivery Finish Good',
          );
          const concurrentDelivery = await tx.deliveryHistory.findUnique({
            where: { LabelDataId: labelData.LabelNumber },
          });
          if (concurrentDelivery) {
            return { delivery: concurrentDelivery, isDuplicate: true };
          }
          const delivered = await tx.deliveryHistory.aggregate({
            where: { ForecastId: currentForecast.PoId },
            _sum: { Qty: true },
          });
          if (
            (delivered._sum.Qty ?? 0) + labelData.QtyThisBox >
            currentForecast.Qty
          ) {
            throw new BadRequestException(
              'Delivery quantity exceeds the forecast target.',
            );
          }
          const finishGood = await tx.finishGood.findUnique({
            where: { PartNumber: labelData.FinishGoodId },
          });
          if (!finishGood) {
            throw new BadRequestException(
              `FinishGood ${labelData.FinishGoodId} not found in system`,
            );
          }
          if (finishGood.Qty < labelData.QtyThisBox) {
            throw new BadRequestException(
              `POKAYOKE: Insufficient stock for delivery. Available: ${finishGood.Qty}, Required: ${labelData.QtyThisBox}`,
            );
          }
          const balanceBefore = finishGood.Qty;
          const balanceAfter = balanceBefore - labelData.QtyThisBox;
          // Create DeliveryHistory record
          // Note: LabelDataId references LabelData.LabelNumber (String), not LabelData.Id (Int)
          const delivery = await tx.deliveryHistory.create({
            data: {
              ForecastId: labelData.ForecastId,
              Qty: labelData.QtyThisBox,
              PalletNumber: dto.palletNumber?.trim() || null,
              CreatedBy: createdBy,
              LabelDataId: labelData.LabelNumber,
            },
          });

          const palletSuffix = delivery.PalletNumber
            ? ` (Pallet=${delivery.PalletNumber})`
            : '';
          await this.logService.addLog({
            processId: localProcessId,
            message: `DeliveryHistory created: ID=${delivery.Id}${palletSuffix}`,
            type: 'INFO',
            location: 'delivery.service.ts:266',
            client: tx,
          });

          if (dto.palletNumber?.trim()) {
            await this.outboxService.create(tx, {
              idempotencyKey: `DELIVERY_PALLET_${delivery.Id}_${dto.palletNumber.trim()}`,
              type: 'PALLET_CONNECTOR_HISTORY',
              payload: {
                kode: dto.palletNumber.trim(),
                deliveryId: delivery.Id,
              },
              actor: createdBy,
              referenceType: 'DeliveryHistory',
              referenceId: String(delivery.Id),
            });
          }

          // Update FinishGood stock
          await tx.finishGood.update({
            where: { PartNumber: labelData.FinishGoodId },
            data: { Qty: balanceAfter, UpdatedBy: createdBy },
          });

          await this.logService.addLog({
            processId: localProcessId,
            message: `FinishGood ${labelData.FinishGoodId} stock decremented: ${balanceBefore} -> ${balanceAfter}`,
            type: 'INFO',
            location: 'delivery.service.ts:276',
            client: tx,
          });

          // Create InventoryLedger entry (OUTGOING - barang keluar ke customer)
          await tx.inventoryLedger.create({
            data: {
              Id: crypto.randomUUID(),
              TransactionDate: new Date(),
              ItemCategory: 'FINISH_GOOD',
              FinishGoodId: labelData.FinishGoodId,
              Location: 'FINISH_GOOD_AREA',
              TransactionType: 'DELIVERY_TO_CUSTOMER',
              ReferenceDoc: `DELIVERY-${delivery.Id}`,
              BalanceBefore: balanceBefore,
              QtyIn: 0,
              QtyOut: labelData.QtyThisBox,
              BalanceAfter: balanceAfter,
              CreatedBy: createdBy,
              Notes: `Delivery for PO: ${labelData.ForecastId}, Label: ${labelData.LabelNumber}`,
            },
          });

          await this.logService.addLog({
            processId: localProcessId,
            message: `InventoryLedger created for delivery: -${labelData.QtyThisBox} units (OUTGOING)`,
            type: 'INFO',
            location: 'delivery.service.ts:294',
            client: tx,
          });

          await this.logService.addLog({
            processId: localProcessId,
            message: `Delivery completed successfully: ID=${delivery.Id}, Label=${labelData.LabelNumber}, Qty=${labelData.QtyThisBox}`,
            type: 'INFO',
            location: 'DeliveryService.create',
            client: tx,
          });
          await this.logService.completeProcess(
            localProcessId,
            'SUCCESS',
            undefined,
            tx,
          );

          await tx.productionTraceEvent.create({
            data: {
              ForecastId: labelData.ForecastId,
              ReleaseId: labelData.ProductionReleaseId,
              Type: 'DELIVERED',
              SourceType: 'DeliveryHistory',
              SourceId: String(delivery.Id),
              Actor: createdBy,
              CorrelationId: localProcessId,
              ProcessId: localProcessId,
            },
          });
          return { delivery, isDuplicate: false };
        },
      );

      if (result.isDuplicate) {
        return {
          success: false,
          isDuplicate: true,
          message: `Label ${labelData.LabelNumber} has already been delivered`,
          data: {
            id: result.delivery.Id,
            forecastId: result.delivery.ForecastId,
            qty: result.delivery.Qty,
            palletNumber: result.delivery.PalletNumber ?? null,
            deliveredAt: result.delivery.CreatedAt,
            deliveredBy: result.delivery.CreatedBy,
          },
        };
      }

      return {
        success: true,
        message: `Delivery successful for LabelNumber ${labelData.LabelNumber}`,
        data: {
          id: result.delivery.Id,
          forecastId: result.delivery.ForecastId,
          qty: result.delivery.Qty,
          palletNumber: result.delivery.PalletNumber ?? null,
          createdAt: result.delivery.CreatedAt,
          createdBy: result.delivery.CreatedBy,
          labelDataId: result.delivery.LabelDataId,
        },
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'delivery.service.ts:326',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  private async assertEarlierDeliveryPeriodsComplete(
    tx: Prisma.TransactionClient,
    forecast: {
      PoId: string;
      DeliveryPeriod: number;
      ProductionReleaseId: string | null;
      ProductionRelease: { ReleaseNumber: string } | null;
    },
  ): Promise<void> {
    if (!forecast.ProductionReleaseId) {
      throw new BadRequestException(
        'Forecast is not linked to a production release.',
      );
    }

    const earlierForecasts = await tx.forecast.findMany({
      where: {
        ProductionReleaseId: forecast.ProductionReleaseId,
        DeliveryPeriod: { lt: forecast.DeliveryPeriod },
      },
      orderBy: [{ DeliveryPeriod: 'asc' }, { PoId: 'asc' }],
      select: {
        PoId: true,
        Qty: true,
        DeliveryPeriod: true,
        LabelData: {
          select: {
            LabelNumber: true,
            QtyThisBox: true,
          },
        },
        DeliveryHistory: {
          select: { ForecastId: true, LabelDataId: true, Qty: true },
        },
      },
    });

    for (const earlier of earlierForecasts) {
      const progress = getDeliveryProgress(earlier);
      if (progress.complete) continue;
      throw new ConflictException(
        `Delivery period ${forecast.DeliveryPeriod} is blocked in production release ${forecast.ProductionRelease?.ReleaseNumber ?? forecast.ProductionReleaseId}: period ${earlier.DeliveryPeriod} is incomplete. PO ${earlier.PoId}: ${progress.deliveredLabels}/${earlier.LabelData.length} labels delivered, ${progress.deliveredQty}/${earlier.Qty} units delivered (${progress.pendingLabels} labels and ${progress.pendingQty} units pending). ${progress.issue} Complete period ${earlier.DeliveryPeriod} before scanning period ${forecast.DeliveryPeriod}.`,
      );
    }
  }

  async findAll(query: DeliveryQueryDto = {}) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 50;
    const offset = (page - 1) * limit;

    const where: Prisma.DeliveryHistoryWhereInput = {};

    if (query?.forecastId) {
      where.ForecastId = query.forecastId;
    }

    if (query?.createdBy) {
      where.CreatedBy = {
        contains: query.createdBy,
        mode: 'insensitive',
      };
    }

    if (query?.activeReleaseOnly) {
      where.LabelData = {
        ProductionRelease: { Status: 'RELEASED' },
      };
    }

    const [total, data] = await Promise.all([
      this.prisma.deliveryHistory.count({ where }),
      this.prisma.deliveryHistory.findMany({
        where,
        include: {
          LabelData: {
            select: {
              LabelNumber: true,
              ProductionRelease: { select: { ReleaseNumber: true } },
            },
          },
        },
        orderBy: [{ CreatedAt: 'desc' }, { Id: 'desc' }],
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      data: data.map((item) => ({
        id: item.Id,
        forecastId: item.ForecastId,
        qty: item.Qty,
        palletNumber: item.PalletNumber ?? null,
        createdAt: item.CreatedAt,
        createdBy: item.CreatedBy,
        labelDataId: item.LabelDataId,
        labelNumber: item.LabelData?.LabelNumber ?? item.LabelDataId,
        releaseNumber: item.LabelData?.ProductionRelease?.ReleaseNumber ?? null,
      })),
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
