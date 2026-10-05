import { auditedTransaction } from '../../common/helpers/audited-transaction.helper';
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import {
  CreatePokayokeScanDto,
  PokayokeScanOptionsQueryDto,
  PokayokeScanQueryDto,
} from './dto/pokayoke-scan.dto';
import type { LogProcessModel } from '../../generated/prisma/models';
import { PokayokeCompareStatus } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { PaginatedPokayokeScanEntity } from './entities/pokayoke.entity';
import { PokayokeScanOptionsEntity } from './entities/pokayoke.entity';
import { ShoppingService } from '../shopping/shopping.service';
import {
  assertLabelReady,
  isShoppingComplete,
  lockProductionFlow,
} from '../../common/helpers/production-flow.helper';

@Injectable()
export class PokayokeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
    private readonly shoppingService: ShoppingService,
  ) {}

  async getScanOptions(
    query: PokayokeScanOptionsQueryDto = { limit: 100 },
  ): Promise<PokayokeScanOptionsEntity> {
    const limit = query.limit ?? 100;
    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.labelData.findMany({
        where: {
          Scanned: false,
          DeliveryHistory: null,
          QtyThisBox: { gt: 0 },
          ProductionRelease: { is: { Status: 'RELEASED' } },
          ...(query.labelNumber
            ? {
                LabelNumber: {
                  contains: query.labelNumber,
                  mode: 'insensitive' as const,
                },
              }
            : {}),
        },
        orderBy: { LabelNumber: 'asc' },
        take: limit,
        include: {
          PartData: { select: { PartName: true } },
          ProductionRelease: { select: { ReleaseNumber: true } },
        },
      });

      const labels: PokayokeScanOptionsEntity['labels'] = [];
      for (const candidate of candidates) {
        try {
          await assertLabelReady(tx, candidate.Id, false);
        } catch (error) {
          if (error instanceof BadRequestException) continue;
          throw error;
        }
        if (!candidate.ProductionReleaseId || !candidate.ProductionRelease)
          continue;
        labels.push({
          id: candidate.Id,
          labelNumber: candidate.LabelNumber,
          forecastId: candidate.ForecastId,
          finishGoodId: candidate.FinishGoodId,
          finishGoodName: candidate.PartData.PartName,
          qtyThisBox: candidate.QtyThisBox,
          productionReleaseId: candidate.ProductionReleaseId,
          productionReleaseNumber: candidate.ProductionRelease.ReleaseNumber,
          requiresAssembly: candidate.RequiresAssembly === true,
        });
      }
      return { labels };
    });
  }

  async scan(dto: CreatePokayokeScanDto, createdBy: string): Promise<any> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'POKAYOKE_001',
        functionName: 'PokayokeService.Scan',
        createdBy,
      });
      const processId = logProcess.ProcessId;

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting POKAYOKE scan for LabelNumber: ${dto.labelNumber}`,
        type: 'INFO',
        location: 'pokayoke.service.ts:30',
      });

      // STEP 1: POKAYOKE - Check if LabelNumber exists in LabelData
      const labelData = await this.prisma.labelData.findUnique({
        where: { LabelNumber: dto.labelNumber },
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
      });

      if (!labelData) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE FAILED: LabelNumber ${dto.labelNumber} not found in LabelData`,
          type: 'ERROR',
          location: 'pokayoke.service.ts:48',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE: LabelNumber ${dto.labelNumber} not found in system`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `POKAYOKE: LabelNumber ${dto.labelNumber} found in LabelData, Scanned=${labelData.Scanned}`,
        type: 'INFO',
        location: 'pokayoke.service.ts:60',
      });

      // STEP 2: POKAYOKE - Check if already scanned
      if (labelData.Scanned) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE FAILED: LabelNumber ${dto.labelNumber} already validated (Scanned=true)`,
          type: 'ERROR',
          location: 'pokayoke.service.ts:68',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE: LabelNumber ${dto.labelNumber} already validated. Cannot scan again.`,
        );
      }

      // STEP 3: POKAYOKE - Validate Forecast from LabelData.ForecastId
      if (!labelData.ForecastId) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE FAILED: No ForecastId found for LabelNumber ${dto.labelNumber}`,
          type: 'ERROR',
          location: 'pokayoke.service.ts:80',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE: No Forecast/PO associated with LabelNumber ${dto.labelNumber}`,
        );
      }

      const forecast = await this.prisma.forecast.findUnique({
        where: { PoId: labelData.ForecastId },
      });

      if (!forecast) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE FAILED: Forecast ${labelData.ForecastId} not found`,
          type: 'ERROR',
          location: 'pokayoke.service.ts:94',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE: Forecast/PO ${labelData.ForecastId} not found in system`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `POKAYOKE: Forecast ${forecast.PoId} validated (Vendor: ${forecast.VendorName})`,
        type: 'INFO',
        location: 'pokayoke.service.ts:106',
      });

      // STEP 4: POKAYOKE - Check shopping completion (BOM materials must be 100% picked)
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `POKAYOKE: Checking shopping completion for Forecast ${labelData.ForecastId}`,
        type: 'INFO',
        location: 'pokayoke.service.ts:110',
      });

      const requirements = await this.shoppingService.checkRequirement(
        labelData.ForecastId,
      );

      if (!isShoppingComplete(requirements)) {
        const msg = `POKAYOKE FAILED: Shopping belum selesai untuk Forecast ${labelData.ForecastId}. Progress: ${requirements.summary.overallPercentage}% (${requirements.summary.totalQtyPicked}/${requirements.summary.totalQtyNeeded}). Selesaikan shopping terlebih dahulu.`;
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: msg,
          type: 'ERROR',
          location: 'pokayoke.service.ts:120',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(msg);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `POKAYOKE: Shopping COMPLETE (${requirements.summary.overallPercentage}%) - All ${requirements.summary.totalMaterials} materials picked`,
        type: 'INFO',
        location: 'pokayoke.service.ts:128',
      });

      // STEP 5: POKAYOKE - Validate FinishGood/PartNumber
      if (!labelData.FinishGoodId) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE FAILED: No FinishGoodId found for LabelNumber ${dto.labelNumber}`,
          type: 'ERROR',
          location: 'pokayoke.service.ts:116',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE: No FinishGood associated with LabelNumber ${dto.labelNumber}`,
        );
      }

      const finishGood = await this.prisma.finishGood.findUnique({
        where: { PartNumber: labelData.FinishGoodId },
      });

      if (!finishGood) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE FAILED: FinishGood ${labelData.FinishGoodId} not found`,
          type: 'ERROR',
          location: 'pokayoke.service.ts:130',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE: FinishGood ${labelData.FinishGoodId} not found in system`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `POKAYOKE: FinishGood ${finishGood.PartNumber} validated (${finishGood.PartName})`,
        type: 'INFO',
        location: 'pokayoke.service.ts:142',
      });

      // STEP 6: Create PokayokeScanHistory record
      const statusValue =
        dto.status === 'SUKSES'
          ? PokayokeCompareStatus.SUKSES
          : PokayokeCompareStatus.GAGAL;

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating PokayokeScanHistory: Label=${dto.labelNumber}, Status=${statusValue}`,
        type: 'INFO',
        location: 'pokayoke.service.ts:154',
      });

      const scanResult = await auditedTransaction(this.prisma, async (tx) => {
        await lockProductionFlow(tx);
        const { label } = await assertLabelReady(tx, labelData.Id, false);
        if (label.Scanned) {
          throw new BadRequestException(
            'Label already validated. Cannot scan again.',
          );
        }
        if (dto.status === PokayokeCompareStatus.SUKSES) {
          const claimed = await tx.labelData.updateMany({
            where: { Id: labelData.Id, Scanned: false },
            data: { Scanned: true },
          });

          if (claimed.count !== 1) {
            throw new BadRequestException(
              `POKAYOKE: LabelNumber ${dto.labelNumber} already validated. Cannot scan again.`,
            );
          }
        }

        const history = await tx.pokayokeScanHistory.create({
          data: {
            LabelNumber: dto.labelNumber,
            PoId: labelData.ForecastId,
            PartNumber: finishGood.PartNumber,
            PartName: finishGood.PartName,
            Status: statusValue,
            CreatedBy: createdBy,
            LabelDataId: labelData.Id,
          },
        });

        if (
          dto.status === PokayokeCompareStatus.SUKSES &&
          labelData.ProductionReleaseId
        ) {
          await tx.productionRelease.update({
            where: { Id: labelData.ProductionReleaseId },
            data: {
              TotalGoodQty: { increment: labelData.QtyThisBox },
            },
          });
        }

        await this.logService.addLog({
          processId,
          message: `PokayokeScanHistory created: ID=${history.Id}; Status=${statusValue}`,
          type: 'INFO',
          location: 'PokayokeService.scan',
          client: tx,
        });
        await this.logService.completeProcess(
          processId,
          'SUCCESS',
          undefined,
          tx,
        );

        await tx.productionTraceEvent.create({
          data: {
            ForecastId: labelData.ForecastId,
            ReleaseId: labelData.ProductionReleaseId,
            Type: 'POKAYOKE_' + statusValue,
            SourceType: 'PokayokeScanHistory',
            SourceId: String(history.Id),
            Actor: createdBy,
            CorrelationId: processId,
            ProcessId: processId,
          },
        });
        return history;
      });

      if (dto.status !== PokayokeCompareStatus.SUKSES) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `PokayokeScanHistory created: ID=${scanResult.Id}`,
          type: 'INFO',
          location: 'pokayoke.service.ts:172',
        });
      }

      // STEP 7: Update scanned label and release cache atomically only if SUKSES.
      // LabelData.Scanned + QtyThisBox remains the source of truth for actual output.
      if (dto.status !== 'SUKSES') {
        // GAGAL - do NOT update Scanned, label can be re-scanned later
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `LabelData ${labelData.Id} NOT updated: Scanned stays false (GAGAL - can retry)`,
          type: 'INFO',
          location: 'pokayoke.service.ts:190',
        });
      }

      if (dto.status !== PokayokeCompareStatus.SUKSES) {
        await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');
      }

      const message =
        dto.status === 'SUKSES'
          ? `POKAYOKE scan SUCCESS for LabelNumber ${dto.labelNumber}`
          : `POKAYOKE scan FAILED for LabelNumber ${dto.labelNumber} - Label can be re-scanned`;

      return {
        success: dto.status === 'SUKSES',
        message,
        data: {
          id: scanResult.Id,
          labelNumber: scanResult.LabelNumber,
          poId: scanResult.PoId,
          partNumber: scanResult.PartNumber,
          partName: scanResult.PartName,
          status: scanResult.Status,
          scanned: dto.status === 'SUKSES',
          createdAt: scanResult.CreatedAt,
          createdBy: scanResult.CreatedBy,
        },
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'pokayoke.service.ts:208',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async findAll(
    query: PokayokeScanQueryDto = { page: 1, limit: 50 },
  ): Promise<PaginatedPokayokeScanEntity> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 50;
    const offset = (page - 1) * limit;

    const where: Prisma.PokayokeScanHistoryWhereInput = {};

    if (query?.labelNumber) {
      where.LabelNumber = {
        contains: query.labelNumber,
        mode: 'insensitive',
      };
    }

    if (query?.poId) {
      where.PoId = query.poId;
    }

    if (query?.status) {
      where.Status = query.status;
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
      this.prisma.pokayokeScanHistory.count({ where }),
      this.prisma.pokayokeScanHistory.findMany({
        where,
        orderBy: [{ CreatedAt: 'desc' }, { Id: 'desc' }],
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      data: data.map((item) => ({
        id: item.Id,
        labelNumber: item.LabelNumber,
        poId: item.PoId,
        partNumber: item.PartNumber,
        partName: item.PartName,
        status: item.Status,
        createdAt: item.CreatedAt,
        createdBy: item.CreatedBy,
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
