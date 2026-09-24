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
  CreateMaterialDto,
  UpdateMaterialDto,
  TransferMaterialStockDto,
  MaterialQueryDto,
} from './dto';
import type {
  LogProcessModel,
  MaterialModel,
} from '../../generated/prisma/models';
import type { Prisma } from '../../generated/prisma/client';
import {
  ItemCategory,
  LocationType,
  TransactionType,
  MaterialSource,
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
export class MaterialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async exportExcel(query: MaterialQueryDto): Promise<Buffer> {
    const where: Prisma.MaterialWhereInput = {};
    if (query.search) {
      where.OR = [
        { PartNumber: { contains: query.search, mode: 'insensitive' } },
        { PartName: { contains: query.search, mode: 'insensitive' } },
        { Supplier: { contains: query.search, mode: 'insensitive' } },
        { RackLocation: { contains: query.search, mode: 'insensitive' } },
        { Remark: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.supplierId) {
      where.SupplierId = query.supplierId;
    }

    const data = await this.prisma.material.findMany({
      where,
      orderBy: [{ Id: 'asc' }],
      include: {
        SatuanData: true,
        SupplierData: true,
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ANSEI System';
    const worksheet = workbook.addWorksheet('Materials');

    worksheet.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Part Number', key: 'partNumber', width: 20 },
      { header: 'Part Name', key: 'partName', width: 35 },
      { header: 'Supplier', key: 'supplier', width: 25 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Rack Location', key: 'rackLocation', width: 20 },
      { header: 'Qty Rack', key: 'qtyRack', width: 15 },
      { header: 'Minimum Stock', key: 'minStock', width: 15 },
      { header: 'Active', key: 'isActive', width: 10 },
      { header: 'Discontinue Date', key: 'discontinueDate', width: 20 },
    ];

    // Header styling
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF004B87' }, // corporate blue
    };
    worksheet.getRow(1).alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    data.forEach((item, index) => {
      worksheet.addRow({
        no: index + 1,
        partNumber: item.PartNumber,
        partName: item.PartName,
        supplier: item.SupplierData?.Name || item.Supplier || '-',
        unit: item.SatuanData?.Name || '-',
        rackLocation: item.RackLocation || '-',
        qtyRack: item.QtyRack,
        minStock: item.MinimumStock,
        isActive: item.IsActive ? 'Yes' : 'No',
        discontinueDate: item.DiscontinueDate
          ? item.DiscontinueDate.toISOString().split('T')[0]
          : '-',
      });
    });

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        if (rowNumber > 1) {
          cell.alignment = { vertical: 'middle' };
        }
      });
    });

    return (await workbook.xlsx.writeBuffer()) as Buffer;
  }

  async findAll(
    query: MaterialQueryDto,
  ): Promise<ApiResult<MaterialModel[], PaginationMeta>> {
    const where: Prisma.MaterialWhereInput = {};
    if (query.search) {
      where.OR = [
        { PartNumber: { contains: query.search, mode: 'insensitive' } },
        { PartName: { contains: query.search, mode: 'insensitive' } },
        { Supplier: { contains: query.search, mode: 'insensitive' } },
        { RackLocation: { contains: query.search, mode: 'insensitive' } },
        { Remark: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.supplierId) {
      where.SupplierId = query.supplierId;
    }
    const [totalItems, data] = await Promise.all([
      this.prisma.material.count({ where }),
      this.prisma.material.findMany({
        where,
        include: {
          SatuanData: true,
          SupplierData: true,
        },
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

  async findOne(id: number): Promise<MaterialModel> {
    const result = await this.prisma.material.findUnique({
      where: { Id: id },
      include: {
        SatuanData: true,
        SupplierData: true,
      },
    });

    if (!result) {
      throw new NotFoundException(`Material with id ${id} not found`);
    }

    return result;
  }

  async findByPartNumber(partNumber: string): Promise<MaterialModel> {
    const result = await this.prisma.material.findUnique({
      where: { PartNumber: partNumber },
      include: {
        SatuanData: true,
        SupplierData: true,
      },
    });

    if (!result) {
      throw new NotFoundException(
        `Material with part number ${partNumber} not found`,
      );
    }

    return result;
  }

  async create(
    dto: CreateMaterialDto,
    createdBy: string,
  ): Promise<MaterialModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MATERIAL_001',
        functionName: 'MaterialService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating material with part number: ${dto.partNumber}`,
        type: 'INFO',
        location: 'material.service.ts:45',
      });

      // Check if part number already exists
      const existing = await this.prisma.material.findUnique({
        where: { PartNumber: dto.partNumber },
      });

      if (existing) {
        throw new ConflictException(
          `Material with part number ${dto.partNumber} already exists`,
        );
      }

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.material.create({
          data: {
            PartNumber: dto.partNumber,
            PartName: dto.partName,
            Supplier: dto.supplier,
            SupplierId: dto.supplierId,
            SatuanId: dto.satuanId,
            RackLocation: dto.rackLocation,
            QtyRack: 0,
            QtyWarehouse: 0,
            MinimumStock: dto.minimumStock ?? 0,
            MaximumStock: dto.maximumStock ?? 0,
            QtyPerBox: dto.qtyPerBox ?? 0,
            MaterialSource: dto.materialSource ?? MaterialSource.LOKAL,
            Remark: dto.remark,
            CreatedBy: createdBy,
            UpdatedBy: createdBy,
          },
          include: {
            SatuanData: true,
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Material created successfully with id: ${result.Id}`,
        type: 'INFO',
        location: 'material.service.ts:68',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'material.service.ts:78',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateMaterialDto,
    createdBy: string,
  ): Promise<MaterialModel> {
    const rawDto = dto as UpdateMaterialDto & {
      qtyRack?: number;
      qtyWarehouse?: number;
    };
    if (rawDto.qtyRack !== undefined || rawDto.qtyWarehouse !== undefined) {
      throw new BadRequestException(
        'Direct modification of Qty Rack or Qty Warehouse is not allowed. Stock quantities must be updated through inventory transactions.',
      );
    }

    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MATERIAL_002',
        functionName: 'MaterialService.Update',
        createdBy,
      });

      const existing = await this.prisma.material.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`Material with id ${id} not found`);
      }

      // Check if new part number conflicts with existing or violates immutability after transactions
      if (dto.partNumber && dto.partNumber !== existing.PartNumber) {
        // POKAYOKE / AUDIT GUARDRAIL: Part number cannot be changed if ledger transactions already exist
        const ledgerCount = await this.prisma.inventoryLedger.count({
          where: { MaterialId: existing.PartNumber },
        });

        if (ledgerCount > 0) {
          throw new BadRequestException(
            `Cannot change part number from "${existing.PartNumber}" to "${dto.partNumber}" because this material already has ${ledgerCount} ledger transaction history. Please create a new Material and discontinue the old one.`,
          );
        }

        const partNumberConflict = await this.prisma.material.findUnique({
          where: { PartNumber: dto.partNumber },
        });

        if (partNumberConflict) {
          throw new ConflictException(
            `Material with part number ${dto.partNumber} already exists`,
          );
        }
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating material id: ${id} with data: ${JSON.stringify(dto)}`,
        type: 'INFO',
        location: 'material.service.ts:112',
      });

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.material.update({
          where: { Id: id },
          data: {
            PartNumber: dto.partNumber,
            PartName: dto.partName,
            Supplier: dto.supplier,
            SupplierId: dto.supplierId,
            SatuanId: dto.satuanId,
            RackLocation: dto.rackLocation,
            MinimumStock: dto.minimumStock,
            MaximumStock: dto.maximumStock,
            QtyPerBox: dto.qtyPerBox,
            MaterialSource: dto.materialSource,
            Remark: dto.remark,
            UpdatedBy: createdBy,
          },
          include: {
            SatuanData: true,
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Material updated successfully: ${result.Id}`,
        type: 'INFO',
        location: 'material.service.ts:131',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'material.service.ts:141',
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
        functionId: 'MATERIAL_003',
        functionName: 'MaterialService.Delete',
        createdBy,
      });

      const existing = await this.prisma.material.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`Material with id ${id} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting material id: ${id}`,
        type: 'INFO',
        location: 'material.service.ts:162',
      });

      await auditedWrite(this.prisma, (tx) =>
        tx.material.delete({
          where: { Id: id },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Material deleted successfully: ${id}`,
        type: 'INFO',
        location: 'material.service.ts:170',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'material.service.ts:180',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Discontinue a material - set IsActive=false and DiscontinueDate
   * Discontinued materials cannot be used in transactions (except inventory counting)
   *
   * Validations before discontinue:
   * 1. Material must not have any Incoming with Closed=false
   * 2. Material must not be used in any BOM for FG that has active ProductionRelease (DRAFT/RELEASED)
   */
  async discontinue(
    partNumber: string,
    reason: string | undefined,
    discontinuedBy: string,
  ): Promise<MaterialModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MATERIAL_004',
        functionName: 'MaterialService.Discontinue',
        createdBy: discontinuedBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Discontinuing material with part number: ${partNumber}${reason ? `, reason: ${reason}` : ''}`,
        type: 'INFO',
        location: 'material.service.ts:215',
      });

      // Check if material exists
      const existing = await this.prisma.material.findUnique({
        where: { PartNumber: partNumber },
      });

      if (!existing) {
        throw new NotFoundException(
          `Material with part number ${partNumber} not found`,
        );
      }

      // Check if already discontinued
      if (!existing.IsActive) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Material ${partNumber} is already discontinued (IsActive=false, DiscontinueDate=${existing.DiscontinueDate?.toISOString() ?? 'N/A'})`,
          type: 'WARN',
          location: 'material.service.ts:233',
        });
        throw new ConflictException(
          `Material with part number ${partNumber} is already discontinued on ${existing.DiscontinueDate?.toISOString() ?? 'N/A'}`,
        );
      }

      // ========== POKAYOKE: VALIDATION BEFORE DISCONTINUE ==========

      // 1. Check for open incoming (Closed=false) that contains this material
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Checking for open incoming transactions for material: ${partNumber}`,
        type: 'INFO',
        location: 'material.service.ts:245',
      });

      const openIncomings = await this.prisma.incoming.findMany({
        where: { Closed: false },
        include: {
          IncomingMaterial: {
            where: { MaterialId: existing.Id },
            select: { Id: true },
          },
        },
      });

      const openIncomingIds = openIncomings
        .filter((inc) => inc.IncomingMaterial.length > 0)
        .map((inc) => inc.PoId);

      if (openIncomingIds.length > 0) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE FAILED: Material ${partNumber} has ${openIncomingIds.length} open incoming(s): ${openIncomingIds.join(', ')}`,
          type: 'ERROR',
          location: 'material.service.ts:260',
        });
        throw new BadRequestException(
          `POKAYOKE: Material ${partNumber} cannot be discontinued because it has ${openIncomingIds.length} open incoming transaction(s): ${openIncomingIds.join(', ')}. Please close or delete the incoming(s) first.`,
        );
      }

      // 2. Check if material is used in any BOM for FG with active ProductionRelease (DRAFT/RELEASED)
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Checking if material is used in BOM for active production: ${partNumber}`,
        type: 'INFO',
        location: 'material.service.ts:270',
      });

      // Get all BOM entries that use this material
      const bomEntries = await this.prisma.billOfMaterials.findMany({
        where: { MaterialId: existing.Id },
        include: {
          FGData: {
            select: { PartNumber: true, Id: true },
          },
        },
      });

      if (bomEntries.length > 0) {
        // Get FinishGood.PartNumber from BOM entries
        const finishGoodPartNumbers = bomEntries.map(
          (bom) => bom.FGData.PartNumber,
        );

        // Check if any Forecast for these FinishGoods has active ProductionRelease (DRAFT/RELEASED)
        const activeForecasts = await this.prisma.forecast.findMany({
          where: {
            FinishGoodId: { in: finishGoodPartNumbers },
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
              `PO:${f.PoId} (FG:${f.FinishGoodId}, Release:${f.ProductionRelease?.ReleaseNumber}, Status:${f.ProductionRelease?.Status})`,
          );

          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `POKAYOKE FAILED: Material ${partNumber} is used in BOM for ${activeForecasts.length} active production(s): ${activeForecastDetails.join('; ')}`,
            type: 'ERROR',
            location: 'material.service.ts:300',
          });
          throw new BadRequestException(
            `POKAYOKE: Material ${partNumber} cannot be discontinued because it is used in BOM for ${activeForecasts.length} finish good(s) with active production: ${activeForecastDetails.join('; ')}. Please complete or cancel the production(s) first.`,
          );
        }
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Validation passed: Material ${partNumber} has no open incoming and not used in active production`,
        type: 'INFO',
        location: 'material.service.ts:310',
      });

      // ========== PERFORM DISCONTINUE ==========
      const now = new Date();
      const result = await auditedWrite(this.prisma, (tx) =>
        tx.material.update({
          where: { PartNumber: partNumber },
          data: {
            IsActive: false,
            DiscontinueDate: now,
            UpdatedBy: discontinuedBy,
          },
          include: {
            SatuanData: true,
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Material ${partNumber} (Id=${result.Id}) discontinued successfully. IsActive=false, DiscontinueDate=${now.toISOString()}${reason ? `, reason: ${reason}` : ''}`,
        type: 'INFO',
        location: 'material.service.ts:322',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'material.service.ts:334',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Reactivate a discontinued material - set IsActive=true and DiscontinueDate=null
   */
  async reactivate(
    partNumber: string,
    reactivatedBy: string,
  ): Promise<MaterialModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MATERIAL_005',
        functionName: 'MaterialService.Reactivate',
        createdBy: reactivatedBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Reactivating material with part number: ${partNumber}`,
        type: 'INFO',
        location: 'material.service.ts:293',
      });

      // Check if material exists
      const existing = await this.prisma.material.findUnique({
        where: { PartNumber: partNumber },
      });

      if (!existing) {
        throw new NotFoundException(
          `Material with part number ${partNumber} not found`,
        );
      }

      // Check if already active
      if (existing.IsActive) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Material ${partNumber} is already active (IsActive=true)`,
          type: 'WARN',
          location: 'material.service.ts:311',
        });
        throw new ConflictException(
          `Material with part number ${partNumber} is already active`,
        );
      }

      // Perform reactivation
      const result = await auditedWrite(this.prisma, (tx) =>
        tx.material.update({
          where: { PartNumber: partNumber },
          data: {
            IsActive: true,
            DiscontinueDate: null,
            UpdatedBy: reactivatedBy,
          },
          include: {
            SatuanData: true,
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Material ${partNumber} (Id=${result.Id}) reactivated successfully. IsActive=true, DiscontinueDate=null`,
        type: 'INFO',
        location: 'material.service.ts:332',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'material.service.ts:344',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Transfer stock from one material part number to another (Supersession stock transfer)
   * Validations:
   * 1. Source and Target must not be identical
   * 2. Qty must be a positive integer
   * 3. Target material must exist and be active (IsActive = true)
   * 4. Source material must exist and have sufficient stock at the given location
   * 5. No active inventory counting session
   *
   * Ledger Invariant:
   * - OUT entry for Source (ADJUSTMENT_MANUAL, QtyOut = qty, BalanceAfter = BalanceBefore - qty)
   * - IN entry for Target (ADJUSTMENT_MANUAL, QtyIn = qty, BalanceAfter = BalanceBefore + qty)
   */
  async transferStock(
    dto: TransferMaterialStockDto,
    transferredBy: string,
  ): Promise<{
    sourcePartNumber: string;
    targetPartNumber: string;
    location: LocationType;
    qty: number;
    sourceBalanceBefore: number;
    sourceBalanceAfter: number;
    targetBalanceBefore: number;
    targetBalanceAfter: number;
    reason: string;
  }> {
    if (dto.sourcePartNumber === dto.targetPartNumber) {
      throw new BadRequestException(
        'Source part number and target part number cannot be the same.',
      );
    }

    if (!Number.isSafeInteger(dto.qty) || dto.qty <= 0) {
      throw new BadRequestException(
        'Transfer quantity must be a positive integer.',
      );
    }

    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MATERIAL_006',
        functionName: 'MaterialService.TransferStock',
        createdBy: transferredBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting material stock transfer: Source=${dto.sourcePartNumber}, Target=${dto.targetPartNumber}, Location=${dto.location}, Qty=${dto.qty}, Reason=${dto.reason}`,
        type: 'INFO',
        location: 'material.service.ts:transferStock',
      });

      const result = await withInventoryTransaction(
        this.prisma,
        ItemCategory.MATERIAL,
        async (tx) => {
          await assertNoActiveInventoryCounting(
            tx,
            ItemCategory.MATERIAL,
            'Material Stock Transfer',
          );

          const source = await tx.material.findUnique({
            where: { PartNumber: dto.sourcePartNumber },
            select: {
              Id: true,
              PartNumber: true,
              IsActive: true,
              QtyWarehouse: true,
              QtyRack: true,
            },
          });

          if (!source) {
            throw new NotFoundException(
              `Source material "${dto.sourcePartNumber}" not found`,
            );
          }

          const target = await tx.material.findUnique({
            where: { PartNumber: dto.targetPartNumber },
            select: {
              Id: true,
              PartNumber: true,
              IsActive: true,
              QtyWarehouse: true,
              QtyRack: true,
            },
          });

          if (!target) {
            throw new NotFoundException(
              `Target material "${dto.targetPartNumber}" not found`,
            );
          }

          if (!target.IsActive) {
            throw new BadRequestException(
              `Target material "${dto.targetPartNumber}" is discontinued. Cannot transfer stock to an inactive material.`,
            );
          }

          const sourceStock =
            dto.location === LocationType.WAREHOUSE
              ? source.QtyWarehouse
              : source.QtyRack;
          const targetStock =
            dto.location === LocationType.WAREHOUSE
              ? target.QtyWarehouse
              : target.QtyRack;

          if (sourceStock < dto.qty) {
            throw new BadRequestException(
              `Insufficient stock for material "${dto.sourcePartNumber}" at ${dto.location}. Available: ${sourceStock}, Requested: ${dto.qty}`,
            );
          }

          const sourceBalanceAfter = sourceStock - dto.qty;
          const targetBalanceAfter = targetStock + dto.qty;
          const now = new Date();

          // 1. OUT Ledger for Source Material
          await tx.inventoryLedger.create({
            data: {
              Id: crypto.randomUUID(),
              TransactionDate: now,
              ItemCategory: ItemCategory.MATERIAL,
              MaterialId: dto.sourcePartNumber,
              Location: dto.location,
              TransactionType: TransactionType.ADJUSTMENT_MANUAL,
              ReferenceDoc: 'SUPERSESSION_TRANSFER',
              BalanceBefore: sourceStock,
              QtyIn: 0,
              QtyOut: dto.qty,
              BalanceAfter: sourceBalanceAfter,
              CreatedBy: transferredBy,
              Notes: `Transfer stock to ${dto.targetPartNumber}: ${dto.reason}`,
            },
          });

          // 2. IN Ledger for Target Material
          await tx.inventoryLedger.create({
            data: {
              Id: crypto.randomUUID(),
              TransactionDate: now,
              ItemCategory: ItemCategory.MATERIAL,
              MaterialId: dto.targetPartNumber,
              Location: dto.location,
              TransactionType: TransactionType.ADJUSTMENT_MANUAL,
              ReferenceDoc: 'SUPERSESSION_TRANSFER',
              BalanceBefore: targetStock,
              QtyIn: dto.qty,
              QtyOut: 0,
              BalanceAfter: targetBalanceAfter,
              CreatedBy: transferredBy,
              Notes: `Received stock from ${dto.sourcePartNumber}: ${dto.reason}`,
            },
          });

          // 3. Update stock caches
          await tx.material.update({
            where: { PartNumber: dto.sourcePartNumber },
            data: {
              QtyWarehouse:
                dto.location === LocationType.WAREHOUSE
                  ? sourceBalanceAfter
                  : source.QtyWarehouse,
              QtyRack:
                dto.location === LocationType.RACK
                  ? sourceBalanceAfter
                  : source.QtyRack,
              UpdatedBy: transferredBy,
            },
          });

          await tx.material.update({
            where: { PartNumber: dto.targetPartNumber },
            data: {
              QtyWarehouse:
                dto.location === LocationType.WAREHOUSE
                  ? targetBalanceAfter
                  : target.QtyWarehouse,
              QtyRack:
                dto.location === LocationType.RACK
                  ? targetBalanceAfter
                  : target.QtyRack,
              UpdatedBy: transferredBy,
            },
          });

          return {
            sourcePartNumber: dto.sourcePartNumber,
            targetPartNumber: dto.targetPartNumber,
            location: dto.location,
            qty: dto.qty,
            sourceBalanceBefore: sourceStock,
            sourceBalanceAfter,
            targetBalanceBefore: targetStock,
            targetBalanceAfter,
            reason: dto.reason,
          };
        },
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Material stock transfer completed successfully: Source ${dto.sourcePartNumber} (${result.sourceBalanceBefore} -> ${result.sourceBalanceAfter}), Target ${dto.targetPartNumber} (${result.targetBalanceBefore} -> ${result.targetBalanceAfter})`,
        type: 'INFO',
        location: 'material.service.ts:transferStock',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'material.service.ts:transferStock',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
