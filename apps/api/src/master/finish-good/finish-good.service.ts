import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { CreateFinishGoodDto, UpdateFinishGoodDto } from './dto';
import type {
  LogProcessModel,
  FinishGoodModel,
} from '../../generated/prisma/models';
import type { Prisma } from '../../generated/prisma/client';
import type {
  ApiResult,
  PaginationMeta,
} from '../../common/interceptors/api-response.interface';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';

@Injectable()
export class FinishGoodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async findAll(
    query: SearchPaginationQueryDto,
  ): Promise<ApiResult<FinishGoodModel[], PaginationMeta>> {
    const where: Prisma.FinishGoodWhereInput = query.search
      ? {
          OR: [
            { PartNumber: { contains: query.search, mode: 'insensitive' } },
            { PartName: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [totalItems, data] = await Promise.all([
      this.prisma.finishGood.count({ where }),
      this.prisma.finishGood.findMany({
        where,
        orderBy: [{ Id: 'asc' }],
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

  async findOne(id: number): Promise<FinishGoodModel> {
    const result = await this.prisma.finishGood.findUnique({
      where: { Id: id },
    });

    if (!result) {
      throw new NotFoundException(`FinishGood with id ${id} not found`);
    }

    return result;
  }

  async findByPartNumber(partNumber: string): Promise<FinishGoodModel> {
    const result = await this.prisma.finishGood.findUnique({
      where: { PartNumber: partNumber },
    });

    if (!result) {
      throw new NotFoundException(
        `FinishGood with part number ${partNumber} not found`,
      );
    }

    return result;
  }

  async create(
    dto: CreateFinishGoodDto,
    createdBy: string,
  ): Promise<FinishGoodModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'FINISHGOOD_001',
        functionName: 'FinishGoodService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating finish good with part number: ${dto.partNumber}`,
        type: 'INFO',
        location: 'finish-good.service.ts:45',
      });

      // Check if part number already exists
      const existing = await this.prisma.finishGood.findUnique({
        where: { PartNumber: dto.partNumber },
      });

      if (existing) {
        throw new ConflictException(
          `FinishGood with part number ${dto.partNumber} already exists`,
        );
      }

      const result = await this.prisma.finishGood.create({
        data: {
          PartNumber: dto.partNumber,
          PartName: dto.partName,
          Price: dto.price ?? 0,
          Qty: dto.qty ?? 0,
          CreatedBy: createdBy,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `FinishGood created successfully with id: ${result.Id}`,
        type: 'INFO',
        location: 'finish-good.service.ts:68',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'finish-good.service.ts:80',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateFinishGoodDto,
    createdBy: string,
  ): Promise<FinishGoodModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'FINISHGOOD_002',
        functionName: 'FinishGoodService.Update',
        createdBy,
      });

      const existing = await this.prisma.finishGood.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`FinishGood with id ${id} not found`);
      }

      // Check if new part number conflicts with existing
      if (dto.partNumber && dto.partNumber !== existing.PartNumber) {
        const partNumberConflict = await this.prisma.finishGood.findUnique({
          where: { PartNumber: dto.partNumber },
        });

        if (partNumberConflict) {
          throw new ConflictException(
            `FinishGood with part number ${dto.partNumber} already exists`,
          );
        }
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating finish good id: ${id} with data: ${JSON.stringify(dto)}`,
        type: 'INFO',
        location: 'finish-good.service.ts:112',
      });

      const result = await this.prisma.finishGood.update({
        where: { Id: id },
        data: {
          PartNumber: dto.partNumber,
          PartName: dto.partName,
          Price: dto.price,
          Qty: dto.qty,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `FinishGood updated successfully: ${result.Id}`,
        type: 'INFO',
        location: 'finish-good.service.ts:128',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'finish-good.service.ts:140',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async remove(
    id: number,
    createdBy: string,
  ): Promise<{ deleted: boolean; id: number }> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'FINISHGOOD_003',
        functionName: 'FinishGoodService.Delete',
        createdBy,
      });

      const existing = await this.prisma.finishGood.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`FinishGood with id ${id} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting finish good id: ${id}`,
        type: 'INFO',
        location: 'finish-good.service.ts:161',
      });

      await this.prisma.finishGood.delete({
        where: { Id: id },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `FinishGood deleted successfully: ${id}`,
        type: 'INFO',
        location: 'finish-good.service.ts:169',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'finish-good.service.ts:181',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
