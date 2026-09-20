import { auditedWrite } from '../../common/helpers/audited-transaction.helper';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { CreateSatuanDto, UpdateSatuanDto } from './dto';
import type {
  LogProcessModel,
  SatuanModel,
} from '../../generated/prisma/models';
import type { Prisma } from '../../generated/prisma/client';
import type {
  ApiResult,
  PaginationMeta,
} from '../../common/interceptors/api-response.interface';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';

@Injectable()
export class SatuanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async findAll(
    query: SearchPaginationQueryDto,
  ): Promise<ApiResult<SatuanModel[], PaginationMeta>> {
    const where: Prisma.SatuanWhereInput = query.search
      ? { Name: { contains: query.search, mode: 'insensitive' } }
      : {};
    const [totalItems, data] = await Promise.all([
      this.prisma.satuan.count({ where }),
      this.prisma.satuan.findMany({
        where,
        orderBy: { Id: 'asc' },
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

  async findOne(id: number): Promise<SatuanModel> {
    const result = await this.prisma.satuan.findUnique({
      where: { Id: id },
    });

    if (!result) {
      throw new NotFoundException(`Satuan with id ${id} not found`);
    }

    return result;
  }

  async create(dto: CreateSatuanDto, createdBy: string): Promise<SatuanModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'SATUAN_001',
        functionName: 'SatuanService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating satuan with name: ${dto.name}`,
        type: 'INFO',
        location: 'satuan.service.ts:35',
      });

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.satuan.create({
          data: {
            Name: dto.name,
            CreatedBy: createdBy,
            UpdatedBy: createdBy,
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Satuan created successfully with id: ${result.Id}`,
        type: 'INFO',
        location: 'satuan.service.ts:44',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'satuan.service.ts:54',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateSatuanDto,
    createdBy: string,
  ): Promise<SatuanModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'SATUAN_002',
        functionName: 'SatuanService.Update',
        createdBy,
      });

      const existing = await this.prisma.satuan.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`Satuan with id ${id} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating satuan id: ${id} with data: ${JSON.stringify(dto)}`,
        type: 'INFO',
        location: 'satuan.service.ts:79',
      });

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.satuan.update({
          where: { Id: id },
          data: {
            ...(dto.name !== undefined && { Name: dto.name }),
            UpdatedBy: createdBy,
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Satuan updated successfully: ${result.Id}`,
        type: 'INFO',
        location: 'satuan.service.ts:88',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'satuan.service.ts:98',
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
        functionId: 'SATUAN_003',
        functionName: 'SatuanService.Delete',
        createdBy,
      });

      const existing = await this.prisma.satuan.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`Satuan with id ${id} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting satuan id: ${id}`,
        type: 'INFO',
        location: 'satuan.service.ts:119',
      });

      await auditedWrite(this.prisma, (tx) =>
        tx.satuan.delete({
          where: { Id: id },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Satuan deleted successfully: ${id}`,
        type: 'INFO',
        location: 'satuan.service.ts:127',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'satuan.service.ts:137',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
