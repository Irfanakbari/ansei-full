import { auditedWrite } from '../../common/helpers/audited-transaction.helper';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import {
  CreateFinishGoodDto,
  UpdateFinishGoodDto,
  TransferFinishGoodStockDto,
} from './dto';
import type {
  LogProcessModel,
  FinishGoodModel,
} from '../../generated/prisma/models';
import type { Prisma } from '../../generated/prisma/client';
import {
  ItemCategory,
  LocationType,
  TransactionType,
} from '../../generated/prisma/enums';
import { assertNoActiveInventoryCounting } from '../../common/helpers/inventory-counting-check.helper';
import { withInventoryTransaction } from '../../common/helpers/inventory-transaction.helper';
import * as crypto from 'crypto';
import * as ExcelJS from 'exceljs';
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

  async exportExcel(query: SearchPaginationQueryDto): Promise<Buffer> {
    const where: Prisma.FinishGoodWhereInput = query.search
      ? {
          OR: [
            { PartNumber: { contains: query.search, mode: 'insensitive' } },
            { PartName: { contains: query.search, mode: 'insensitive' } },
            { Alias: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const data = await this.prisma.finishGood.findMany({
      where,
      orderBy: [{ Id: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ANSEI System';
    const worksheet = workbook.addWorksheet('Finish Goods', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    worksheet.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Part Number', key: 'partNumber', width: 25 },
      { header: 'Part Name', key: 'partName', width: 40 },
      { header: 'Alias', key: 'alias', width: 25 },
      { header: 'Price (Rp)', key: 'price', width: 15 },
      { header: 'Qty', key: 'qty', width: 15 },
      { header: 'Passthrough', key: 'isPassthrough', width: 15 },
      { header: 'Status', key: 'isActive', width: 15 },
      { header: 'Disc. Date', key: 'discontinueDate', width: 18 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    data.forEach((item, index) => {
      worksheet.addRow({
        no: index + 1,
        partNumber: item.PartNumber,
        partName: item.PartName,
        alias: item.Alias || '-',
        price: item.Price || 0,
        qty: item.Qty,
        isPassthrough: item.IsPassthrough ? 'YES' : 'NO',
        isActive: item.IsActive ? 'ACTIVE' : 'DISCONTINUED',
        discontinueDate: item.DiscontinueDate
          ? item.DiscontinueDate.toISOString().split('T')[0]
          : '-',
      });
    });

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
        if (rowNumber > 1) {
          cell.alignment = { vertical: 'middle' };
          if ([1, 5, 6, 7, 8, 9].includes(colNumber)) {
            cell.alignment.horizontal = 'center';
          }
          if (colNumber === 5 && cell.value !== '-') {
            // Price column format
            cell.numFmt = '#,##0';
          }
        }
      });
    });

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async findAll(
    query: SearchPaginationQueryDto,
  ): Promise<ApiResult<FinishGoodModel[], PaginationMeta>> {
    const where: Prisma.FinishGoodWhereInput = query.search
      ? {
          OR: [
            { PartNumber: { contains: query.search, mode: 'insensitive' } },
            { PartName: { contains: query.search, mode: 'insensitive' } },
            { Alias: { contains: query.search, mode: 'insensitive' } },
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

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.finishGood.create({
          data: {
            PartNumber: dto.partNumber,
            PartName: dto.partName,
            Alias: dto.alias,
            Price: dto.price ?? 0,
            IsPassthrough: dto.isPassthrough ?? false,
            Qty: dto.qty ?? 0,
            IsActive: true,
            DiscontinueDate: null,
            CreatedBy: createdBy,
            UpdatedBy: createdBy,
          },
        }),
      );

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
    if ((dto as any).qty !== undefined) {
      throw new BadRequestException(
        'Direct modification of Qty is not allowed. Stock quantity must be updated via inventory transactions.',
      );
    }

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

      // Check if new part number conflicts with existing or violates immutability after transactions
      if (dto.partNumber && dto.partNumber !== existing.PartNumber) {
        const ledgerCount = await this.prisma.inventoryLedger.count({
          where: { FinishGoodId: existing.PartNumber },
        });

        if (ledgerCount > 0) {
          throw new BadRequestException(
            `Cannot change part number from "${existing.PartNumber}" to "${dto.partNumber}" because this finish good already has ${ledgerCount} ledger transaction history. Please create a new Finish Good and discontinue the old one.`,
          );
        }

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

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.finishGood.update({
          where: { Id: id },
          data: {
            PartNumber: dto.partNumber,
            PartName: dto.partName,
            Alias: dto.alias,
            Price: dto.price,
            IsPassthrough: dto.isPassthrough,
            UpdatedBy: createdBy,
          },
        }),
      );

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

      await auditedWrite(this.prisma, (tx) =>
        tx.finishGood.delete({
          where: { Id: id },
        }),
      );

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

  /**
   * Discontinue a finish good - set IsActive=false and DiscontinueDate
   * Validations before discontinue:
   * 1. FinishGood must not have active Forecast with ProductionRelease (DRAFT/RELEASED)
   */
  async discontinue(
    id: number,
    reason: string | undefined,
    discontinuedBy: string,
  ): Promise<FinishGoodModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'FINISHGOOD_004',
        functionName: 'FinishGoodService.Discontinue',
        createdBy: discontinuedBy,
      });

      const existing = await this.prisma.finishGood.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`FinishGood with id ${id} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Discontinuing finish good with part number: ${existing.PartNumber}${reason ? `, reason: ${reason}` : ''}`,
        type: 'INFO',
        location: 'finish-good.service.ts:discontinue',
      });

      if (!existing.IsActive) {
        throw new ConflictException(
          `FinishGood with part number ${existing.PartNumber} is already discontinued on ${existing.DiscontinueDate?.toISOString() ?? 'N/A'}`,
        );
      }

      // POKAYOKE: Check if FG is in active Forecast with ProductionRelease (DRAFT/RELEASED)
      const activeForecasts = await this.prisma.forecast.findMany({
        where: {
          FinishGoodId: existing.PartNumber,
          ProductionReleaseId: { not: null },
          ProductionRelease: {
            Status: { in: ['DRAFT', 'RELEASED'] },
          },
        },
        select: {
          PoId: true,
          FinishGoodId: true,
          ProductionRelease: {
            select: {
              ReleaseNumber: true,
              Status: true,
            },
          },
        },
      });

      if (activeForecasts.length > 0) {
        const activeForecastDetails = activeForecasts.map(
          (f) =>
            `PO:${f.PoId} (Release:${f.ProductionRelease?.ReleaseNumber}, Status:${f.ProductionRelease?.Status})`,
        );
        throw new BadRequestException(
          `POKAYOKE: Finish Good "${existing.PartNumber}" cannot be discontinued because it is associated with active production release(s): ${activeForecastDetails.join('; ')}. Please complete or cancel the production(s) first.`,
        );
      }

      const now = new Date();
      const result = await auditedWrite(this.prisma, (tx) =>
        tx.finishGood.update({
          where: { Id: id },
          data: {
            IsActive: false,
            DiscontinueDate: now,
            UpdatedBy: discontinuedBy,
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `FinishGood ${existing.PartNumber} (Id=${result.Id}) discontinued successfully. IsActive=false, DiscontinueDate=${now.toISOString()}${reason ? `, reason: ${reason}` : ''}`,
        type: 'INFO',
        location: 'finish-good.service.ts:discontinue',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'finish-good.service.ts:discontinue',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Reactivate a discontinued finish good - set IsActive=true and DiscontinueDate=null
   */
  async reactivate(
    id: number,
    reactivatedBy: string,
  ): Promise<FinishGoodModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'FINISHGOOD_005',
        functionName: 'FinishGoodService.Reactivate',
        createdBy: reactivatedBy,
      });

      const existing = await this.prisma.finishGood.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`FinishGood with id ${id} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Reactivating finish good with part number: ${existing.PartNumber}`,
        type: 'INFO',
        location: 'finish-good.service.ts:reactivate',
      });

      if (existing.IsActive) {
        throw new ConflictException(
          `FinishGood with part number ${existing.PartNumber} is already active`,
        );
      }

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.finishGood.update({
          where: { Id: id },
          data: {
            IsActive: true,
            DiscontinueDate: null,
            UpdatedBy: reactivatedBy,
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `FinishGood ${existing.PartNumber} (Id=${result.Id}) reactivated successfully. IsActive=true, DiscontinueDate=null`,
        type: 'INFO',
        location: 'finish-good.service.ts:reactivate',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'finish-good.service.ts:reactivate',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Transfer stock from one finish good part number to another (Supersession stock transfer)
   * Validations:
   * 1. Source and Target must not be identical
   * 2. Qty must be a positive integer
   * 3. Target finish good must exist and be active (IsActive = true)
   * 4. Source finish good must exist and have sufficient stock
   * 5. No active inventory counting session
   *
   * Ledger Invariant:
   * - OUT entry for Source (ADJUSTMENT_MANUAL, QtyOut = qty, BalanceAfter = BalanceBefore - qty)
   * - IN entry for Target (ADJUSTMENT_MANUAL, QtyIn = qty, BalanceAfter = BalanceBefore + qty)
   */
  async transferStock(
    id: number,
    dto: TransferFinishGoodStockDto,
    transferredBy: string,
  ): Promise<{
    sourcePartNumber: string;
    targetPartNumber: string;
    qty: number;
    sourceBalanceBefore: number;
    sourceBalanceAfter: number;
    targetBalanceBefore: number;
    targetBalanceAfter: number;
    reason: string;
  }> {
    if (!Number.isSafeInteger(dto.qty) || dto.qty <= 0) {
      throw new BadRequestException(
        'Transfer quantity must be a positive integer.',
      );
    }

    let logProcess: LogProcessModel | undefined;

    try {
      const source = await this.prisma.finishGood.findUnique({
        where: { Id: id },
      });

      if (!source) {
        throw new NotFoundException(
          `Source finish good with id ${id} not found`,
        );
      }

      if (source.PartNumber === dto.targetPartNumber) {
        throw new BadRequestException(
          'Source part number and target part number cannot be the same.',
        );
      }

      logProcess = await this.logService.startProcess({
        functionId: 'FINISHGOOD_006',
        functionName: 'FinishGoodService.TransferStock',
        createdBy: transferredBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting finish good stock transfer: Source=${source.PartNumber}, Target=${dto.targetPartNumber}, Qty=${dto.qty}, Reason=${dto.reason}`,
        type: 'INFO',
        location: 'finish-good.service.ts:transferStock',
      });

      const result = await withInventoryTransaction(
        this.prisma,
        ItemCategory.FINISH_GOOD,
        async (tx) => {
          await assertNoActiveInventoryCounting(
            tx,
            ItemCategory.FINISH_GOOD,
            'Finish Good Stock Transfer',
          );

          // Need to refetch source inside transaction to lock it and get latest qty
          const sourceTx = await tx.finishGood.findUnique({
            where: { Id: id },
            select: {
              Id: true,
              PartNumber: true,
              IsActive: true,
              Qty: true,
            },
          });

          if (!sourceTx) {
            throw new NotFoundException(`Source finish good not found`);
          }

          const target = await tx.finishGood.findUnique({
            where: { PartNumber: dto.targetPartNumber },
            select: {
              Id: true,
              PartNumber: true,
              IsActive: true,
              Qty: true,
            },
          });

          if (!target) {
            throw new NotFoundException(
              `Target finish good "${dto.targetPartNumber}" not found`,
            );
          }

          if (!target.IsActive) {
            throw new BadRequestException(
              `Target finish good "${dto.targetPartNumber}" is discontinued. Cannot transfer stock to an inactive finish good.`,
            );
          }

          if (sourceTx.Qty < dto.qty) {
            throw new BadRequestException(
              `Insufficient stock for finish good "${sourceTx.PartNumber}". Available: ${sourceTx.Qty}, Requested: ${dto.qty}`,
            );
          }

          const sourceBalanceAfter = sourceTx.Qty - dto.qty;
          const targetBalanceAfter = target.Qty + dto.qty;
          const now = new Date();

          // 1. OUT Ledger for Source Finish Good
          await tx.inventoryLedger.create({
            data: {
              Id: crypto.randomUUID(),
              TransactionDate: now,
              ItemCategory: ItemCategory.FINISH_GOOD,
              FinishGoodId: sourceTx.PartNumber,
              Location: LocationType.FINISH_GOOD_AREA,
              TransactionType: TransactionType.ADJUSTMENT_MANUAL,
              ReferenceDoc: 'SUPERSESSION_TRANSFER',
              BalanceBefore: sourceTx.Qty,
              QtyIn: 0,
              QtyOut: dto.qty,
              BalanceAfter: sourceBalanceAfter,
              CreatedBy: transferredBy,
              Notes: `Transfer stock to ${dto.targetPartNumber}: ${dto.reason}`,
            },
          });

          // 2. IN Ledger for Target Finish Good
          await tx.inventoryLedger.create({
            data: {
              Id: crypto.randomUUID(),
              TransactionDate: now,
              ItemCategory: ItemCategory.FINISH_GOOD,
              FinishGoodId: dto.targetPartNumber,
              Location: LocationType.FINISH_GOOD_AREA,
              TransactionType: TransactionType.ADJUSTMENT_MANUAL,
              ReferenceDoc: 'SUPERSESSION_TRANSFER',
              BalanceBefore: target.Qty,
              QtyIn: dto.qty,
              QtyOut: 0,
              BalanceAfter: targetBalanceAfter,
              CreatedBy: transferredBy,
              Notes: `Received stock from ${sourceTx.PartNumber}: ${dto.reason}`,
            },
          });

          // 3. Update stock caches
          await tx.finishGood.update({
            where: { Id: id },
            data: {
              Qty: sourceBalanceAfter,
              UpdatedBy: transferredBy,
            },
          });

          await tx.finishGood.update({
            where: { PartNumber: dto.targetPartNumber },
            data: {
              Qty: targetBalanceAfter,
              UpdatedBy: transferredBy,
            },
          });

          return {
            sourcePartNumber: sourceTx.PartNumber,
            targetPartNumber: dto.targetPartNumber,
            qty: dto.qty,
            sourceBalanceBefore: sourceTx.Qty,
            sourceBalanceAfter,
            targetBalanceBefore: target.Qty,
            targetBalanceAfter,
            reason: dto.reason,
          };
        },
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Finish good stock transfer completed successfully: Source ${result.sourcePartNumber} (${result.sourceBalanceBefore} -> ${result.sourceBalanceAfter}), Target ${result.targetPartNumber} (${result.targetBalanceBefore} -> ${result.targetBalanceAfter})`,
        type: 'INFO',
        location: 'finish-good.service.ts:transferStock',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'finish-good.service.ts:transferStock',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
