import { OutboxService } from '../../common/outbox/outbox.service';
import {
  materialSapValues,
  parseSapMaterialPayload,
} from '../../common/sap/sap-material-write.service';
import {
  SapItemSyncService,
  type SapSync,
} from '../../common/sap/sap-item-sync.service';
import {
  auditedWrite,
  auditedTransaction,
} from '../../common/helpers/audited-transaction.helper';
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

export interface MaterialOption {
  Id: number;
  PartNumber: string;
  PartName: string;
}

@Injectable()
export class MaterialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
    private readonly sap: SapItemSyncService,
    private readonly outbox: OutboxService,
  ) {}

  private async decorateSap<T extends MaterialModel>(items: T[]) {
    const enabled = this.sap.materialWritesEnabled();
    const events =
      enabled && items.length
        ? await this.prisma.outboxEvent.findMany({
            where: {
              Type: 'SAP_MATERIAL_UPDATE',
              ReferenceType: 'SAP_MATERIAL',
              ReferenceId: { in: items.map((row) => String(row.Id)) },
            },
            distinct: ['ReferenceId'],
            orderBy: [
              { ReferenceId: 'asc' },
              { CreatedAt: 'desc' },
              { Id: 'desc' },
            ],
            select: {
              ReferenceId: true,
              Status: true,
              LastErrorCode: true,
              SucceededAt: true,
              UpdatedAt: true,
              Payload: true,
            },
          })
        : [];
    const byId = new Map(events.map((event) => [event.ReferenceId, event]));
    return this.sap.decorate(items).map((row) => {
      const event = byId.get(String(row.Id));
      let current = false;
      if (event) {
        try {
          current =
            JSON.stringify(parseSapMaterialPayload(event.Payload)) ===
            JSON.stringify(materialSapValues(row));
        } catch {
          /* Historical payload is not a current sync result. */
        }
      }
      const status = !enabled
        ? 'DISABLED'
        : !current || !event
          ? 'NOT_REQUESTED'
          : event.Status === 'SUCCEEDED'
            ? event.LastErrorCode === 'SAP_MATERIAL_SYNCED'
              ? 'SYNCED'
              : 'NOT_REQUESTED'
            : event.Status === 'FAILED'
              ? 'FAILED'
              : 'PENDING';
      return {
        ...row,
        SAPUpdateStatus: status,
        SAPUpdateCheckedAt:
          current && event ? event.UpdatedAt.toISOString() : null,
      };
    });
  }

  async exportExcel(query: MaterialQueryDto): Promise<Buffer> {
    const where: Prisma.MaterialWhereInput = {};
    if (query.search) {
      where.OR = [
        { PartNumber: { contains: query.search, mode: 'insensitive' } },
        { PartNumberSAP: { contains: query.search, mode: 'insensitive' } },
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
    const worksheet = workbook.addWorksheet('Materials', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    worksheet.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Part Number', key: 'partNumber', width: 22 },
      { header: 'Part Name', key: 'partName', width: 40 },
      { header: 'Supplier', key: 'supplier', width: 30 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Rack Location', key: 'rackLocation', width: 20 },
      { header: 'Source', key: 'source', width: 15 },
      { header: 'Qty Rack', key: 'qtyRack', width: 15 },
      { header: 'Qty WHS', key: 'qtyWarehouse', width: 15 },
      { header: 'Min Stock', key: 'minStock', width: 15 },
      { header: 'Max Stock', key: 'maxStock', width: 15 },
      { header: 'Qty/Box', key: 'qtyPerBox', width: 15 },
      { header: 'Status', key: 'isActive', width: 15 },
      { header: 'Disc. Date', key: 'discontinueDate', width: 18 },
      { header: 'Remark', key: 'remark', width: 35 },
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
        supplier: item.SupplierData?.Name || item.Supplier || '-',
        unit: item.SatuanData?.Name || '-',
        rackLocation: item.RackLocation || '-',
        source: item.MaterialSource || '-',
        qtyRack: item.QtyRack,
        qtyWarehouse: item.QtyWarehouse,
        minStock: item.MinimumStock,
        maxStock: item.MaximumStock,
        qtyPerBox: item.QtyPerBox,
        isActive: item.IsActive ? 'ACTIVE' : 'DISCONTINUED',
        discontinueDate: item.DiscontinueDate
          ? item.DiscontinueDate.toISOString().split('T')[0]
          : '-',
        remark: item.Remark || '-',
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
          if ([1, 5, 7, 8, 9, 10, 11, 12, 13, 14].includes(colNumber)) {
            cell.alignment.horizontal = 'center';
          }
        }
      });
    });

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async findAll(
    query: MaterialQueryDto,
  ): Promise<
    ApiResult<(MaterialModel & SapSync)[], PaginationMeta> | MaterialOption[]
  > {
    const where: Prisma.MaterialWhereInput = {};
    if (query.search) {
      where.OR = [
        { PartNumber: { contains: query.search, mode: 'insensitive' } },
        { PartNumberSAP: { contains: query.search, mode: 'insensitive' } },
        { PartName: { contains: query.search, mode: 'insensitive' } },
        { Supplier: { contains: query.search, mode: 'insensitive' } },
        { RackLocation: { contains: query.search, mode: 'insensitive' } },
        { Remark: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.supplierId) {
      where.SupplierId = query.supplierId;
    }

    if (query.option) {
      return this.prisma.material.findMany({
        where,
        select: {
          Id: true,
          PartNumber: true,
          PartName: true,
        },
        orderBy: [{ PartNumber: 'asc' }],
      });
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
      data: await this.decorateSap(data),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }

  async findOne(id: number): Promise<MaterialModel & SapSync> {
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

    return (await this.decorateSap([result]))[0];
  }

  async findByPartNumber(partNumber: string): Promise<MaterialModel & SapSync> {
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

    return (await this.decorateSap([result]))[0];
  }

  async create(
    dto: CreateMaterialDto,
    createdBy: string,
  ): Promise<MaterialModel> {
    const partNumberSAP =
      dto.partNumberSAP === undefined
        ? undefined
        : dto.partNumberSAP?.trim() || null;
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

      if (partNumberSAP) {
        const sapConflict = await this.prisma.material.findUnique({
          where: { PartNumberSAP: partNumberSAP },
        });
        if (sapConflict) {
          throw new ConflictException(
            'Material with this SAP part number already exists',
          );
        }
      }

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.material.create({
          data: {
            PartNumber: dto.partNumber,
            PartNumberSAP: partNumberSAP,
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

    const partNumberSAP =
      dto.partNumberSAP === undefined
        ? undefined
        : dto.partNumberSAP?.trim() || null;
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
        message: `Updating material id: ${id} (master data updated)`,
        type: 'INFO',
        location: 'material.service.ts:112',
      });

      if (partNumberSAP) {
        const sapConflict = await this.prisma.material.findUnique({
          where: { PartNumberSAP: partNumberSAP },
        });
        if (sapConflict && sapConflict.Id !== id) {
          throw new ConflictException(
            'Material with this SAP part number already exists',
          );
        }
      }

      const result = await auditedTransaction(
        this.prisma,
        async (tx) => {
          await tx.$queryRaw`SELECT "Id" FROM "Material" WHERE "Id" = ${id} FOR UPDATE`;
          const before = await tx.material.findUnique({ where: { Id: id } });
          if (!before) throw new NotFoundException('Material not found');
          const updated = await tx.material.update({
            where: { Id: id },
            data: {
              PartNumber: dto.partNumber,
              PartNumberSAP: partNumberSAP,
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
          });
          const oldValues = materialSapValues(before);
          const newValues = materialSapValues(updated);
          if (
            this.sap.materialWritesEnabled() &&
            JSON.stringify(oldValues) !== JSON.stringify(newValues)
          ) {
            await this.outbox.create(tx, {
              idempotencyKey: `SAP_MATERIAL:${id}:${crypto.randomUUID()}`,
              type: 'SAP_MATERIAL_UPDATE',
              payload: newValues,
              actor: createdBy,
              referenceType: 'SAP_MATERIAL',
              referenceId: String(id),
            });
            const audit = await this.logService.startProcess({
              functionId: 'MATERIAL_SAP',
              functionName: 'Material.SapSyncRequested',
              createdBy,
              client: tx,
            });
            await tx.actionAuditEvent.create({
              data: {
                SourceType: 'Material',
                SourceId: String(id),
                Action: 'SAP_SYNC_REQUESTED',
                Actor: createdBy,
                ActorSource: 'AUTHENTICATED_COMMAND',
                ProcessId: audit.ProcessId,
                Before: { ...oldValues },
                After: { ...newValues, ManageStockByWarehouse: 'tNO' },
              },
            });
            await this.logService.completeProcess(
              audit.ProcessId,
              'SUCCESS',
              'SAP material sync queued',
              tx,
            );
          }
          return updated;
        },
        { maxWait: 5000, timeout: 15000 },
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
        const activeForecasts = await this.prisma.productionOrder.findMany({
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
