import { auditedWrite } from '../../common/helpers/audited-transaction.helper';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import {
  CreateSupplierDto,
  SupplierBarcodeField,
  UpdateSupplierDto,
  UpsertSupplierBarcodeFormatDto,
} from './dto';
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

type SupplierBarcodeFormatView = {
  Id: number;
  SupplierId: number;
  Delimiter: string;
  Fields: SupplierBarcodeField[];
  FieldOffsets: number[];
  CreatedAt: Date;
  CreatedBy: string;
  UpdatedAt: Date;
  UpdatedBy: string;
};

@Injectable()
export class SupplierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async getBarcodeFormat(
    id: number,
  ): Promise<SupplierBarcodeFormatView | null> {
    await this.findOne(id);
    const result = await this.prisma.supplierBarcodeFormat.findUnique({
      where: { SupplierId: id },
    });
    return result ? this.toBarcodeFormatView(result) : null;
  }

  async upsertBarcodeFormat(
    id: number,
    dto: UpsertSupplierBarcodeFormatDto,
    updatedBy: string,
  ) {
    let logProcess: LogProcessModel | undefined;
    try {
      logProcess = await this.logService.startProcess({
        functionId: 'SUPPLIER_004',
        functionName: 'SupplierService.UpsertBarcodeFormat',
        createdBy: updatedBy,
      });
      await this.findOne(id);
      const fieldOffsets = dto.fieldOffsets ?? dto.fields.map(() => 0);
      const storedFields = {
        fields: dto.fields,
        fieldOffsets,
      };
      const result = await auditedWrite(this.prisma, (tx) =>
        tx.supplierBarcodeFormat.upsert({
          where: { SupplierId: id },
          create: {
            SupplierId: id,
            Delimiter: dto.delimiter,
            Fields: storedFields,
            CreatedBy: updatedBy,
            UpdatedBy: updatedBy,
          },
          update: {
            Delimiter: dto.delimiter,
            Fields: storedFields,
            UpdatedBy: updatedBy,
          },
        }),
      );
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Supplier barcode format saved for supplier id: ${id}`,
        type: 'INFO',
        location: 'supplier.service.ts:upsertBarcodeFormat',
      });
      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');
      return this.toBarcodeFormatView(result);
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'supplier.service.ts:upsertBarcodeFormat',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  private toBarcodeFormatView(format: {
    Id: number;
    SupplierId: number;
    Delimiter: string;
    Fields: Prisma.JsonValue;
    CreatedAt: Date;
    CreatedBy: string;
    UpdatedAt: Date;
    UpdatedBy: string;
  }): SupplierBarcodeFormatView {
    const stored = format.Fields;
    const fields = Array.isArray(stored)
      ? (stored as SupplierBarcodeField[])
      : this.isRecord(stored) && Array.isArray(stored.fields)
        ? (stored.fields as SupplierBarcodeField[])
        : [];
    const storedOffsets =
      this.isRecord(stored) && Array.isArray(stored.fieldOffsets)
        ? stored.fieldOffsets
        : [];
    const fieldOffsets = fields.map((_, index) => {
      const offset = storedOffsets[index];
      return typeof offset === 'number' &&
        Number.isInteger(offset) &&
        offset >= 0
        ? offset
        : 0;
    });

    return { ...format, Fields: fields, FieldOffsets: fieldOffsets };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

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
            CreatedBy: createdBy,
            UpdatedBy: createdBy,
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
            UpdatedBy: createdBy,
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
