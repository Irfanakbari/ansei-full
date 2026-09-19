import { auditedWrite } from '../../common/helpers/audited-transaction.helper';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto';
import type {
  LogProcessModel,
  SupplierModel,
} from '../../generated/prisma/models';
import type { Prisma } from '../../generated/prisma/client';
import type {
  ApiResult,
  PaginationMeta,
} from '../../common/interceptors/api-response.interface';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';

@Injectable()
export class SupplierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async findAll(
    query: SearchPaginationQueryDto,
  ): Promise<ApiResult<SupplierModel[], PaginationMeta>> {
    const where: Prisma.SupplierWhereInput = query.search
      ? { Name: { contains: query.search, mode: 'insensitive' } }
      : {};
    const [totalItems, data] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
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

  async findOne(id: number): Promise<SupplierModel> {
    const result = await this.prisma.supplier.findUnique({
      where: { Id: id },
    });

    if (!result) {
      throw new NotFoundException(`Supplier with id ${id} not found`);
    }

    return result;
  }

  async create(
    dto: CreateSupplierDto,
    createdBy: string,
  ): Promise<SupplierModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'SUPPLIER_001',
        functionName: 'SupplierService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating supplier with name: ${dto.name}`,
        type: 'INFO',
        location: 'supplier.service.ts:35',
      });

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.supplier.create({
          data: {
            Name: dto.name,
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Supplier created successfully with id: ${result.Id}`,
        type: 'INFO',
        location: 'supplier.service.ts:44',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'supplier.service.ts:54',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateSupplierDto,
    createdBy: string,
  ): Promise<SupplierModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'SUPPLIER_002',
        functionName: 'SupplierService.Update',
        createdBy,
      });

      const existing = await this.prisma.supplier.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`Supplier with id ${id} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating supplier id: ${id} with data: ${JSON.stringify(dto)}`,
        type: 'INFO',
        location: 'supplier.service.ts:79',
      });

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.supplier.update({
          where: { Id: id },
          data: {
            ...(dto.name !== undefined && { Name: dto.name }),
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Supplier updated successfully: ${result.Id}`,
        type: 'INFO',
        location: 'supplier.service.ts:88',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'supplier.service.ts:98',
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
        functionId: 'SUPPLIER_003',
        functionName: 'SupplierService.Delete',
        createdBy,
      });

      const existing = await this.prisma.supplier.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`Supplier with id ${id} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting supplier id: ${id}`,
        type: 'INFO',
        location: 'supplier.service.ts:119',
      });

      await auditedWrite(this.prisma, (tx) =>
        tx.supplier.delete({
          where: { Id: id },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Supplier deleted successfully: ${id}`,
        type: 'INFO',
        location: 'supplier.service.ts:127',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'supplier.service.ts:137',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
