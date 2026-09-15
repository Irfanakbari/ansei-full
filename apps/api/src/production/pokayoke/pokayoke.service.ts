import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import {
  CreatePokayokeScanDto,
  PokayokeScanQueryDto,
} from './dto/pokayoke-scan.dto';
import type { LogProcessModel } from '../../generated/prisma/models';
import { PokayokeCompareStatus } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { PaginatedPokayokeScanEntity } from './entities/pokayoke.entity';
import { ShoppingService } from '../shopping/shopping.service';

@Injectable()
export class PokayokeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
    private readonly shoppingService: ShoppingService,
  ) {}

  async scan(dto: CreatePokayokeScanDto, createdBy: string): Promise<any> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'POKAYOKE_001',
        functionName: 'PokayokeService.Scan',
        createdBy,
      });

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

      try {
        const requirements = await this.shoppingService.checkRequirement(
          labelData.ForecastId,
        );

        if (requirements.summary.overallPercentage < 100) {
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
      } catch (error) {
        // Re-throw BadRequestException as-is
        if (error instanceof BadRequestException) {
          throw error;
        }
        // For other errors (e.g., Forecast not found in shopping), log and continue
        // This allows scan even if forecast doesn't have shopping records yet
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Shopping check skipped: ${error instanceof Error ? error.message : 'Unknown error'}. Continuing scan...`,
          type: 'WARN',
          location: 'pokayoke.service.ts:138',
        });
      }

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

      const scanResult = await this.prisma.pokayokeScanHistory.create({
        data: {
          LabelNumber: dto.labelNumber,
          PoId: labelData.ForecastId,
          PartNumber: finishGood.PartNumber,
          PartName: finishGood.PartName,
          Status: statusValue,
          CreatedBy: createdBy,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `PokayokeScanHistory created: ID=${scanResult.Id}`,
        type: 'INFO',
        location: 'pokayoke.service.ts:172',
      });

      // STEP 7: Update LabelData.Scanned only if SUKSES
      if (dto.status === 'SUKSES') {
        await this.prisma.labelData.update({
          where: { Id: labelData.Id },
          data: { Scanned: true },
        });

        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `LabelData ${labelData.Id} updated: Scanned=true (SUKSES)`,
          type: 'INFO',
          location: 'pokayoke.service.ts:184',
        });
      } else {
        // GAGAL - do NOT update Scanned, label can be re-scanned later
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `LabelData ${labelData.Id} NOT updated: Scanned stays false (GAGAL - can retry)`,
          type: 'INFO',
          location: 'pokayoke.service.ts:190',
        });
      }

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

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
    query: PokayokeScanQueryDto,
  ): Promise<PaginatedPokayokeScanEntity> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;

    const where: Prisma.PokayokeScanHistoryWhereInput = {};

    if (query.labelNumber) {
      where.LabelNumber = {
        contains: query.labelNumber,
        mode: 'insensitive',
      };
    }

    if (query.poId) {
      where.PoId = query.poId;
    }

    if (query.status) {
      where.Status = query.status;
    }

    if (query.createdBy) {
      where.CreatedBy = {
        contains: query.createdBy,
        mode: 'insensitive',
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
