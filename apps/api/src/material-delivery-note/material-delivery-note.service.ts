import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';
import { SmtpService } from '../common/utils/smtp.service';
import {
  CreateMaterialDeliveryNoteDto,
  PickMaterialDto,
  UpdateMaterialDeliveryNoteDto,
  SendDeliveryNoteEmailDto,
} from './dto';
import {
  DeliveryNoteStatus,
  ItemCategory,
  LocationType,
  TransactionType,
} from '../generated/prisma/enums';
import type { LogProcessModel } from '../generated/prisma/models';
import { Prisma } from '../generated/prisma/client';
import { Workbook } from 'exceljs';
import dayjs from 'dayjs';
import * as bwipjs from 'bwip-js';
import sharp from 'sharp';
import { excelToPdf } from '../common/utils/document-converter.util';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MaterialDeliveryNoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
    private readonly smtpService: SmtpService,
  ) {}

  // Generate delivery note number: SJ-MAT/YYYY/MM/XXXX
  private async generateDeliveryNoteNum(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');

    // Get latest DN number for current month
    const prefix = `SJ-MAT/${year}/${month}/`;
    const latest = await this.prisma.materialDeliveryNote.findFirst({
      where: {
        DeliveryNoteNum: { startsWith: prefix },
      },
      orderBy: { DeliveryNoteNum: 'desc' },
      select: { DeliveryNoteNum: true },
    });

    let sequence = 1;
    if (latest) {
      const lastSeq = parseInt(
        latest.DeliveryNoteNum.split('/').pop() || '0',
        10,
      );
      sequence = lastSeq + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }

  // Create draft delivery note
  async create(dto: CreateMaterialDeliveryNoteDto, createdBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MAT_DEL_001',
        functionName: 'createMaterialDeliveryNote',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating draft delivery note with ${dto.items.length} items to destination: ${dto.destination}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:55',
      });

      // Validate materials exist and are active
      const materialIds = dto.items.map((i) => i.materialId);
      const materials = await this.prisma.material.findMany({
        where: { PartNumber: { in: materialIds } },
        select: {
          PartNumber: true,
          PartName: true,
          QtyWarehouse: true,
          IsActive: true,
        },
      });

      const foundMaterialIds = materials.map((m) => m.PartNumber);
      const missingMaterials = materialIds.filter(
        (id) => !foundMaterialIds.includes(id),
      );
      const discontinuedMaterials = materials
        .filter((m) => !m.IsActive)
        .map((m) => m.PartNumber);

      if (missingMaterials.length > 0) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Material not found: ${missingMaterials.join(', ')}`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:68',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new NotFoundException(
          `Material not found: ${missingMaterials.join(', ')}`,
        );
      }

      if (discontinuedMaterials.length > 0) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Material(s) discontinued: ${discontinuedMaterials.join(', ')}`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:80',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `POKAYOKE: Material(s) ${discontinuedMaterials.join(', ')} are discontinued and cannot be used in transactions. Please reactivate the material(s) first.`,
        );
      }

      // Generate DN number
      const deliveryNoteNum = await this.generateDeliveryNoteNum();

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Generated DeliveryNoteNum: ${deliveryNoteNum}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:79',
      });

      // Create DN with details in transaction
      const processId = logProcess.ProcessId;

      const dn = await this.prisma.$transaction(async (tx) => {
        // Create header
        const header = await tx.materialDeliveryNote.create({
          data: {
            DeliveryNoteNum: deliveryNoteNum,
            Destination: dto.destination,
            Notes: dto.notes || null,
            Status: DeliveryNoteStatus.DRAFT,
            CreatedBy: createdBy,
          },
        });

        await this.logService.addLog({
          processId: processId,
          message: `Created DN header: ${header.Id}`,
          type: 'INFO',
          location: 'material-delivery-note.service.ts:94',
        });

        // Create details
        const details = await tx.materialDeliveryNoteDetail.createMany({
          data: dto.items.map((item) => ({
            DeliveryNoteId: header.Id,
            MaterialId: item.materialId,
            FinishGoodPartTemp: item.FinishGoodPartTemp ?? null,
            QtyRequested: item.qtyRequested,
            QtyPicking: 0, // Initially 0, will be picked later
          })),
        });

        await this.logService.addLog({
          processId: processId,
          message: `Created ${details.count} DN details`,
          type: 'INFO',
          location: 'material-delivery-note.service.ts:107',
        });

        return header;
      });

      await this.logService.completeProcess(processId, 'SUCCESS');

      return this.findOne(dn.Id);
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:123',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  // List all delivery notes with pagination
  async findAll(params: {
    page?: number;
    limit?: number;
    status?: DeliveryNoteStatus;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.MaterialDeliveryNoteWhereInput = {};
    if (params.status) {
      where.Status = params.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.materialDeliveryNote.findMany({
        where,
        include: {
          Details: {
            select: {
              MaterialId: true,
              FinishGoodPartTemp: true,
              QtyRequested: true,
              QtyPicking: true,
              QtyReceived: true,
            },
          },
        },
        orderBy: { CreatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.materialDeliveryNote.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get one delivery note
  async findOne(id: string) {
    const dn = await this.prisma.materialDeliveryNote.findUnique({
      where: { Id: id },
      include: {
        Details: {
          include: {
            MaterialData: {
              select: {
                PartNumber: true,
                PartName: true,
                QtyWarehouse: true,
                QtyRack: true,
              },
            },
          },
        },
      },
    });

    if (!dn) {
      throw new NotFoundException(`Delivery note not found: ${id}`);
    }

    return dn;
  }

  // Get details only
  async getDetails(id: string) {
    const details = await this.prisma.materialDeliveryNoteDetail.findMany({
      where: { DeliveryNoteId: id },
      include: {
        MaterialData: {
          select: {
            PartNumber: true,
            PartName: true,
            QtyWarehouse: true,
            QtyRack: true,
          },
        },
      },
    });

    return details;
  }

  // Update header (DRAFT only)
  async update(
    id: string,
    dto: UpdateMaterialDeliveryNoteDto,
    updatedBy: string,
  ) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MAT_DEL_001B',
        functionName: 'updateMaterialDeliveryNote',
        createdBy: updatedBy,
      });

      const existing = await this.prisma.materialDeliveryNote.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`Delivery note not found: ${id}`);
      }

      if (existing.Status !== DeliveryNoteStatus.DRAFT) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Cannot update DN with status ${existing.Status}. Must be DRAFT.`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:219',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException('Can only update DRAFT delivery notes');
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating DN: ${id}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:227',
      });

      const updated = await this.prisma.materialDeliveryNote.update({
        where: { Id: id },
        data: {
          Destination: dto.destination ?? existing.Destination,
          Notes: dto.notes ?? existing.Notes,
        },
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return this.findOne(id);
    } catch (error) {
      if (logProcess) {
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  // Delete (DRAFT only)
  async remove(id: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MAT_DEL_001C',
        functionName: 'deleteMaterialDeliveryNote',
      });

      const existing = await this.prisma.materialDeliveryNote.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`Delivery note not found: ${id}`);
      }

      if (existing.Status !== DeliveryNoteStatus.DRAFT) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Cannot delete DN with status ${existing.Status}. Must be DRAFT.`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:265',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException('Can only delete DRAFT delivery notes');
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting DN: ${id}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:273',
      });

      await this.prisma.materialDeliveryNote.delete({
        where: { Id: id },
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id };
    } catch (error) {
      if (logProcess) {
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  // Pick material (operator shopping) - DRAFT only
  async pick(id: string, dto: PickMaterialDto, pickedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MAT_DEL_002',
        functionName: 'pickMaterial',
        createdBy: pickedBy,
      });

      const dn = await this.prisma.materialDeliveryNote.findUnique({
        where: { Id: id },
        include: { Details: true },
      });

      if (!dn) {
        throw new NotFoundException(`Delivery note not found: ${id}`);
      }

      // POKAYOKE: Check status is DRAFT
      if (dn.Status !== DeliveryNoteStatus.DRAFT) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Cannot pick - DN status is ${dn.Status}, must be DRAFT`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:313',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException('Can only pick DRAFT delivery notes');
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting pick for DN: ${dn.DeliveryNoteNum}, ${dto.items.length} items`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:320',
      });

      // Validate and update picking
      const updatedDetails: string[] = [];

      for (const item of dto.items) {
        // Find existing detail
        const detail = dn.Details.find((d) => d.MaterialId === item.materialId);
        if (!detail) {
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `Material ${item.materialId} not found in DN`,
            type: 'ERROR',
            location: 'material-delivery-note.service.ts:333',
          });
          await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
          throw new BadRequestException(
            `Material ${item.materialId} not found in delivery note`,
          );
        }

        // POKAYOKE: QtyPicking tidak boleh lebih dari QtyRequested
        if (item.qtyPicking > detail.QtyRequested) {
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `POKAYOKE FAIL: QtyPicking (${item.qtyPicking}) > QtyRequested (${detail.QtyRequested}) for ${item.materialId}`,
            type: 'ERROR',
            location: 'material-delivery-note.service.ts:343',
          });
          await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
          throw new BadRequestException(
            `Qty picking tidak boleh lebih dari qty requested untuk ${item.materialId}`,
          );
        }

        // POKAYOKE: QtyPicking tidak boleh lebih dari stock warehouse
        const material = await this.prisma.material.findUnique({
          where: { PartNumber: item.materialId },
          select: { QtyWarehouse: true, IsActive: true, PartName: true },
        });

        if (!material) {
          throw new NotFoundException(`Material ${item.materialId} not found`);
        }

        // POKAYOKE: Material tidak boleh discontinue
        if (!material.IsActive) {
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `POKAYOKE FAIL: Material ${item.materialId} is discontinued (IsActive=false)`,
            type: 'ERROR',
            location: 'material-delivery-note.service.ts:365',
          });
          await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
          throw new BadRequestException(
            `Material ${item.materialId} (${material.PartName}) is discontinued and cannot be used in transactions. Please reactivate the material first.`,
          );
        }

        if (item.qtyPicking > material.QtyWarehouse) {
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `POKAYOKE FAIL: QtyPicking (${item.qtyPicking}) > Stock (${material.QtyWarehouse}) for ${item.materialId}`,
            type: 'ERROR',
            location: 'material-delivery-note.service.ts:378',
          });
          await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
          throw new BadRequestException(
            `Stock tidak cukup untuk picking material ${item.materialId}. Available: ${material.QtyWarehouse}`,
          );
        }

        // Update QtyPicking
        await this.prisma.materialDeliveryNoteDetail.update({
          where: { Id: detail.Id },
          data: { QtyPicking: item.qtyPicking },
        });

        updatedDetails.push(`${item.materialId}: ${item.qtyPicking}`);

        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Picked ${item.materialId}: ${item.qtyPicking}/${detail.QtyRequested}`,
          type: 'INFO',
          location: 'material-delivery-note.service.ts:377',
        });
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Pick completed: ${updatedDetails.join(', ')}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:383',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return this.findOne(id);
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:394',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  // Ship (change status to SHIPPED) - DRAFT only, with stock cut
  async ship(id: string, shippedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MAT_DEL_003',
        functionName: 'shipMaterialDeliveryNote',
        createdBy: shippedBy,
      });

      const dn = await this.prisma.materialDeliveryNote.findUnique({
        where: { Id: id },
        include: { Details: true },
      });

      if (!dn) {
        throw new NotFoundException(`Delivery note not found: ${id}`);
      }

      // POKAYOKE: Check status is DRAFT
      if (dn.Status !== DeliveryNoteStatus.DRAFT) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE FAIL: Cannot ship - DN status is ${dn.Status}, must be DRAFT`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:427',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `Cannot ship - delivery note status is ${dn.Status}`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting ship process for DN: ${dn.DeliveryNoteNum}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:434',
      });

      // POKAYOKE: Check all items have QtyPicking = QtyRequested
      const unpickedItems = dn.Details.filter(
        (d) => d.QtyPicking !== d.QtyRequested,
      );
      if (unpickedItems.length > 0) {
        const msg = unpickedItems
          .map(
            (d) => `${d.MaterialId}: picked ${d.QtyPicking}/${d.QtyRequested}`,
          )
          .join(', ');
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE FAIL: Items not fully picked - ${msg}`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:445',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `Qty picking harus sama dengan qty requested sebelum kirim. Items: ${msg}`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `POKAYOKE PASS: All ${dn.Details.length} items fully picked`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:452',
      });

      // POKAYOKE: Validate stock sufficiency before cutting
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Validating stock for ${dn.Details.length} items`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:458',
      });

      for (const detail of dn.Details) {
        const material = await this.prisma.material.findUnique({
          where: { PartNumber: detail.MaterialId },
          select: { QtyWarehouse: true, PartName: true },
        });

        if (!material) {
          throw new NotFoundException(
            `Material ${detail.MaterialId} not found`,
          );
        }

        if (material.QtyWarehouse < detail.QtyPicking) {
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `POKAYOKE FAIL: Insufficient stock for ${detail.MaterialId}. Needed: ${detail.QtyPicking}, Available: ${material.QtyWarehouse}`,
            type: 'ERROR',
            location: 'material-delivery-note.service.ts:472',
          });
          await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
          throw new BadRequestException(
            `Stock tidak cukup untuk ${detail.MaterialId} (${material.PartName}). Needed: ${detail.QtyPicking}, Available: ${material.QtyWarehouse}`,
          );
        }

        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Stock OK: ${detail.MaterialId} - ${material.QtyWarehouse} >= ${detail.QtyPicking}`,
          type: 'INFO',
          location: 'material-delivery-note.service.ts:480',
        });
      }

      // Execute ship with stock cut and ledger entry
      const localProcessId = logProcess.ProcessId;

      await this.prisma.$transaction(async (tx) => {
        const ledgerEntries: Prisma.InventoryLedgerCreateManyInput[] = [];

        for (const detail of dn.Details) {
          // Get current stock
          const material = await tx.material.findUnique({
            where: { PartNumber: detail.MaterialId },
            select: { QtyWarehouse: true },
          });

          if (!material) continue;

          const balanceBefore = material.QtyWarehouse;
          const qtyOut = detail.QtyPicking;
          const balanceAfter = balanceBefore - qtyOut;

          // POKAYOKE: Verify balance calculation
          await this.logService.addLog({
            processId: localProcessId,
            message: `Stock mutation: ${detail.MaterialId} | Before: ${balanceBefore} | Out: ${qtyOut} | After: ${balanceAfter}`,
            type: 'INFO',
            location: 'material-delivery-note.service.ts:503',
          });

          // Cut stock
          await tx.material.update({
            where: { PartNumber: detail.MaterialId },
            data: { QtyWarehouse: balanceAfter },
          });

          // Create ledger entry
          ledgerEntries.push({
            ItemCategory: ItemCategory.MATERIAL,
            MaterialId: detail.MaterialId,
            Location: LocationType.WAREHOUSE,
            TransactionType: TransactionType.MATERIAL_OUT_DELIVERY,
            ReferenceDoc: dn.DeliveryNoteNum,
            BalanceBefore: balanceBefore,
            QtyIn: 0,
            QtyOut: qtyOut,
            BalanceAfter: balanceAfter,
            CreatedBy: shippedBy,
            Notes: `Delivery Note: ${dn.DeliveryNoteNum}`,
          });
        }

        // Bulk create ledger entries
        if (ledgerEntries.length > 0) {
          await tx.inventoryLedger.createMany({ data: ledgerEntries });
        }

        await this.logService.addLog({
          processId: localProcessId,
          message: `Created ${ledgerEntries.length} InventoryLedger entries`,
          type: 'INFO',
          location: 'material-delivery-note.service.ts:531',
        });

        // Update DN status to SHIPPED
        await tx.materialDeliveryNote.update({
          where: { Id: id },
          data: {
            Status: DeliveryNoteStatus.SHIPPED,
            ShippedAt: new Date(),
            ShippedBy: shippedBy,
          },
        });

        await this.logService.addLog({
          processId: localProcessId,
          message: `DN status updated to SHIPPED`,
          type: 'INFO',
          location: 'material-delivery-note.service.ts:540',
        });
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Ship completed successfully for DN: ${dn.DeliveryNoteNum}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:548',
      });

      return this.findOne(id);
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:558',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  // Receive (change status to RECEIVED) - SHIPPED only
  async receive(id: string, receivedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MAT_DEL_004',
        functionName: 'receiveMaterialDeliveryNote',
        createdBy: receivedBy,
      });

      const dn = await this.prisma.materialDeliveryNote.findUnique({
        where: { Id: id },
      });

      if (!dn) {
        throw new NotFoundException(`Delivery note not found: ${id}`);
      }

      // POKAYOKE: Check status is SHIPPED
      if (dn.Status !== DeliveryNoteStatus.SHIPPED) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE FAIL: Cannot receive - DN status is ${dn.Status}, must be SHIPPED`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:586',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `Cannot receive - delivery note status is ${dn.Status}`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting receive confirmation for DN: ${dn.DeliveryNoteNum}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:593',
      });

      // Update to RECEIVED
      await this.prisma.materialDeliveryNote.update({
        where: { Id: id },
        data: {
          Status: DeliveryNoteStatus.RECEIVED,
          ReceivedAt: new Date(),
          ReceivedBy: receivedBy,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `DN status updated to RECEIVED by ${receivedBy}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:604',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return this.findOne(id);
    } catch (error) {
      if (logProcess) {
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  // Cancel (DRAFT only)
  async cancel(id: string, cancelledBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MAT_DEL_005',
        functionName: 'cancelMaterialDeliveryNote',
        createdBy: cancelledBy,
      });

      const dn = await this.prisma.materialDeliveryNote.findUnique({
        where: { Id: id },
      });

      if (!dn) {
        throw new NotFoundException(`Delivery note not found: ${id}`);
      }

      // POKAYOKE: Check status is DRAFT
      if (dn.Status !== DeliveryNoteStatus.DRAFT) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE FAIL: Cannot cancel - DN status is ${dn.Status}, must be DRAFT`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:638',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `Cannot cancel - delivery note status is ${dn.Status}`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Cancelling DN: ${dn.DeliveryNoteNum}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:645',
      });

      await this.prisma.materialDeliveryNote.update({
        where: { Id: id },
        data: { Status: DeliveryNoteStatus.CANCELLED },
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { cancelled: true, id };
    } catch (error) {
      if (logProcess) {
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Generate Surat Jalan (Delivery Note) Excel
   * Follows the worksheet pattern from inventory-counting service
   */
  async generateDeliveryNotePDF(id: string): Promise<Buffer> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MAT_DEL_006',
        functionName: 'generateDeliveryNotePDF',
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Generating Surat Jalan for DN ID: ${id}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:650',
      });

      // Fetch DN with details
      const dn = await this.prisma.materialDeliveryNote.findUnique({
        where: { Id: id },
        include: {
          Details: {
            include: {
              MaterialData: {
                select: {
                  PartNumber: true,
                  PartName: true,
                },
              },
            },
          },
        },
      });

      if (!dn) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `DN not found: ${id}`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:665',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new NotFoundException(`Delivery note not found: ${id}`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Found DN: ${dn.DeliveryNoteNum}, ${dn.Details.length} items`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:673',
      });

      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Delivery Note');
      const dateStr = dayjs().format('DD-MM-YYYY HH:mm');
      const code = dn.DeliveryNoteNum;

      // Page Setup A4 Portrait
      worksheet.pageSetup = {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: '1:17',
      };
      worksheet.views = [{ showGridLines: false }];

      // Watermark
      const watermark = worksheet.getCell('A1');
      watermark.value = 'This document autogenerated by IPC System';
      watermark.font = { size: 8, italic: true, color: { argb: 'FF808080' } };

      // Signature Boxes - Row 1 - 4 columns: Created, Sent, Received, (empty/Checked)
      // Header row with labels
      worksheet.getCell('I1').value = 'Created';
      worksheet.getCell('J1').value = 'Sent';
      worksheet.getCell('K1').value = 'Received';
      worksheet.getCell('L1').value = 'Checked';

      ['I1', 'J1', 'K1', 'L1'].forEach((cellRef) => {
        const cell = worksheet.getCell(cellRef);
        cell.font = { bold: true, size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFCE4D6' },
        };
      });

      // Row 2-3: Space for stamp area (thin border only on sides)
      ['I2', 'J2', 'K2', 'L2'].forEach((cellRef) => {
        const cell = worksheet.getCell(cellRef);
        cell.border = { left: { style: 'thin' }, right: { style: 'thin' } };
      });
      ['I3', 'J3', 'K3', 'L3'].forEach((cellRef) => {
        const cell = worksheet.getCell(cellRef);
        cell.border = {
          left: { style: 'thin' },
          right: { style: 'thin' },
          bottom: { style: 'thin' },
        };
      });

      // Row 4: Signature cells with stamp images
      // Read signature image - use process.cwd() for reliable path
      const assetsPath = process.cwd();
      const signatureImagePath = path.join(
        assetsPath,
        'dist',
        'assets',
        'signed.png',
      );
      let signatureImage: Buffer | undefined;
      try {
        if (fs.existsSync(signatureImagePath)) {
          signatureImage = fs.readFileSync(signatureImagePath);
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `Signature image loaded: ${signatureImagePath}, size: ${signatureImage?.length} bytes`,
            type: 'DEBUG',
            location: 'material-delivery-note.service.ts:1000',
          });
        } else {
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `Signature image not found at: ${signatureImagePath}`,
            type: 'WARN',
            location: 'material-delivery-note.service.ts:1005',
          });
        }
      } catch (err) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Error loading signature image: ${err instanceof Error ? err.message : 'Unknown'}`,
          type: 'WARN',
          location: 'material-delivery-note.service.ts:1012',
        });
      }

      const stampCells = [
        { cell: 'I4', name: dn.CreatedBy || '-', hasName: true },
        { cell: 'J4', name: dn.ShippedBy || '', hasName: !!dn.ShippedBy },
        { cell: 'K4', name: dn.ReceivedBy || '', hasName: !!dn.ReceivedBy },
        { cell: 'L4', name: '', hasName: false },
      ];

      stampCells.forEach(({ cell, name, hasName }) => {
        const nameCell = worksheet.getCell(cell);
        nameCell.value = hasName ? name : '';
        nameCell.font = { bold: false, size: 9, color: { argb: 'FF000000' } };
        nameCell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: false,
        };
        nameCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        nameCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' },
        };
      });

      // Add signature images if available - position in the empty box ABOVE the name (rows 2-3)
      if (signatureImage) {
        const sigImageId = workbook.addImage({
          buffer: signatureImage as any,
          extension: 'png',
        } as any);

        // Add signature images to each stamp column (I, J, K, L)
        // Image size: 70x35 pixels - larger and centered in the box
        let imagesAdded = 0;
        stampCells.forEach((stamp, idx) => {
          if (stamp.hasName) {
            worksheet.addImage(sigImageId, {
              tl: { col: 8 + idx, row: 1 },
              ext: { width: 70, height: 35 },
              editAs: 'absolute',
            });
            imagesAdded++;
          }
        });

        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Added ${imagesAdded} signature images to delivery note`,
          type: 'DEBUG',
          location: 'material-delivery-note.service.ts:1050',
        });
      }

      // Set row heights to match image + name
      worksheet.getRow(2).height = 18;
      worksheet.getRow(3).height = 18;
      worksheet.getRow(4).height = 12;

      // Header Info - Row 6 - shifted 3 columns right
      worksheet.getCell('A6').value = 'Delivery Note No.';
      worksheet.mergeCells('A6:B6'); // Label merge 2 columns
      worksheet.getCell('C6').value = `: ${code}`;
      worksheet.getCell('H6').value = 'Date';
      worksheet.mergeCells('H6:J6'); // Label merge 3 columns
      worksheet.getCell('K6').value =
        `: ${dayjs(dn.CreatedAt).format('DD MMMM YYYY')}`;

      worksheet.getCell('H7').value = 'Destination';
      worksheet.mergeCells('H7:J7'); // Label merge 3 columns
      worksheet.getCell('K7').value = `: ${dn.Destination}`;

      // Title Box - Row 8 - extended to L (12 columns)
      worksheet.mergeCells('A8:L8');
      const titleCell = worksheet.getCell('A8');
      titleCell.value = 'DELIVERY NOTE';
      titleCell.style = {
        font: { bold: true, size: 14 },
        alignment: { horizontal: 'center' },
      };
      [
        'A8',
        'B8',
        'C8',
        'D8',
        'E8',
        'F8',
        'G8',
        'H8',
        'I8',
        'J8',
        'K8',
        'L8',
      ].forEach((cellRef) => {
        const cell = worksheet.getCell(cellRef);
        cell.border = {
          top: { style: 'medium' },
          bottom: { style: 'medium' },
          left: { style: 'medium' },
          right: { style: 'medium' },
        };
      });

      // Sub-header details - Row 10
      const subStartRow = 10;
      worksheet.getCell(`A${subStartRow}`).value = 'Status';
      worksheet.getCell(`C${subStartRow}`).value = `: ${dn.Status}`;
      worksheet.getCell(`A${subStartRow + 1}`).value = 'Notes';
      worksheet.getCell(`C${subStartRow + 1}`).value = `: ${dn.Notes || '-'}`;

      // Generate QR Code image using bwip-js
      const qrRaw = await bwipjs.toBuffer({
        bcid: 'qrcode',
        text: code,
        scale: 3,
      });

      // Resize to square using sharp - 96x96 pixels
      const qrCodePng = await sharp(qrRaw)
        .resize(96, 96, { fit: 'fill', background: { r: 255, g: 255, b: 255 } })
        .toBuffer();

      // Add QR Code image to worksheet - absolute positioning, no cell resize
      const imageId = workbook.addImage({
        buffer: qrCodePng as any,
        extension: 'png',
      });

      // Position at L10 with absolute sizing (60x60 pixels) - image floats above cells
      worksheet.addImage(imageId, {
        tl: { col: 11, row: 9 },
        ext: { width: 60, height: 60 },
        editAs: 'absolute',
      });

      // Table Headers - Row 14 (subStartRow + 4) - Part Number merge 4 columns, Part Name merge 5 columns, Qty merge 2 columns
      const headerRowIdx = subStartRow + 4;

      // Set header row with 12 columns
      // Header text diletakkan di cell pertama merge
      const headerRow = worksheet.getRow(headerRowIdx);
      headerRow.values = [
        'No',
        'Part Number',
        '',
        '',
        '',
        'Part Name / Description',
        '',
        '',
        '',
        '',
        'Qty',
        '',
      ];
      headerRow.height = 30;

      // Merge header cells: Part Number (B-E, 4 cols), Part Name (F-J, 5 cols), Qty (K-L, 2 cols)
      worksheet.mergeCells(`A${headerRowIdx}:A${headerRowIdx}`); // No - single column
      worksheet.mergeCells(`B${headerRowIdx}:E${headerRowIdx}`); // Part Number - merge 4 columns (text di B)
      worksheet.mergeCells(`F${headerRowIdx}:J${headerRowIdx}`); // Part Name - merge 5 columns (text di F)
      worksheet.mergeCells(`K${headerRowIdx}:L${headerRowIdx}`); // Qty - merge 2 columns (text di K)

      // Apply style ke setiap cell dalam header row
      for (let col = 1; col <= 12; col++) {
        const cell = headerRow.getCell(col);
        cell.font = { bold: true };
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thick' },
          right: { style: 'thin' },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD3D3D3' },
        };
      }

      // NOTE: Column widths left to Excel default (auto-fit)

      // Data Rows - menggunakan array values langsung (12 columns)
      let totalQty = 0;
      dn.Details.forEach((detail, index) => {
        const material = detail.MaterialData;
        const qty =
          detail.QtyPicking > 0 ? detail.QtyPicking : detail.QtyRequested;
        const rowIdx = headerRowIdx + 1 + index;

        // Array values: [no, partNumber, empty, empty, empty, name, empty, empty, empty, empty, qty, empty]
        // Data harus di cell pertama merge (B untuk Part Number 4 cols, F untuk Part Name 5 cols, K untuk Qty 2 cols)
        const row = worksheet.addRow([
          index + 1,
          detail.MaterialId, // Part Number value di kolom 2/B (cell pertama merge B:E)
          '', // placeholder di kolom 3/C
          '', // placeholder di kolom 4/D
          '', // placeholder di kolom 5/E
          material?.PartName || '-', // Part Name value di kolom 6/F (cell pertama merge F:J)
          '', // placeholder di kolom 7/G
          '', // placeholder di kolom 8/H
          '', // placeholder di kolom 9/I
          '', // placeholder di kolom 10/J
          qty, // Qty value di kolom 11/K (cell pertama merge K:L)
          '', // placeholder di kolom 12/L
        ]);

        // Merge cells untuk setiap data row: Part Number (B-E, 4 cols), Part Name (F-J, 5 cols), Qty (K-L, 2 cols)
        worksheet.mergeCells(`B${rowIdx}:E${rowIdx}`); // Part Number merge 4 columns
        worksheet.mergeCells(`F${rowIdx}:J${rowIdx}`); // Part Name merge 5 columns
        worksheet.mergeCells(`K${rowIdx}:L${rowIdx}`); // Qty merge 2 columns

        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };

          // Part Number (col 2) - bold, center
          // Part Name (col 6) - left, wrap
          // Qty (col 11) - center
          if (colNumber === 2) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { bold: true };
          } else if (colNumber === 6) {
            cell.alignment = {
              vertical: 'middle',
              horizontal: 'left',
              wrapText: true,
            };
          } else if (colNumber === 11 || colNumber === 12) {
            // Qty column and placeholder - center align
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        });

        row.height = 30;
        totalQty += qty;
      });

      // Add empty rows to fill A4 (minimum 15 data rows)
      const minDataRows = 15;
      const emptyRowsNeeded = Math.max(0, minDataRows - dn.Details.length);
      const firstEmptyRowIdx = headerRowIdx + 1 + dn.Details.length;

      for (let i = 0; i < emptyRowsNeeded; i++) {
        const rowIdx = firstEmptyRowIdx + i;
        const emptyRow = worksheet.addRow([
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ]);

        // Merge cells untuk empty rows juga
        worksheet.mergeCells(`B${rowIdx}:E${rowIdx}`);
        worksheet.mergeCells(`F${rowIdx}:J${rowIdx}`);
        worksheet.mergeCells(`K${rowIdx}:L${rowIdx}`);

        emptyRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
          cell.alignment = { vertical: 'middle' };
        });

        emptyRow.height = 30;
      }

      // Total Row - 12 columns
      const totalRowIdx =
        headerRowIdx + dn.Details.length + emptyRowsNeeded + 1;
      const totalRow = worksheet.addRow([
        '',
        '',
        '',
        '',
        '',
        'TOTAL',
        '',
        '',
        '',
        '',
        totalQty,
        '',
      ]);

      // Merge cells untuk total row: Part Number (B-E), Part Name (F-J), Qty (K-L)
      worksheet.mergeCells(`B${totalRowIdx}:E${totalRowIdx}`);
      worksheet.mergeCells(`F${totalRowIdx}:J${totalRowIdx}`);
      worksheet.mergeCells(`K${totalRowIdx}:L${totalRowIdx}`);

      totalRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true };
        cell.border = {
          top: { style: 'medium' },
          left: { style: 'thin' },
          bottom: { style: 'medium' },
          right: { style: 'thin' },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFCE4D6' },
        };
        // TOTAL label in col 6 (Part Name merged cell F), Qty in col 11 - center align
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 6 ? 'left' : 'center',
        };
      });

      totalRow.height = 30;

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Delivery Note Excel generated for DN: ${dn.DeliveryNoteNum}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:820',
      });

      // Generate Excel buffer
      const excelBuffer =
        (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Converting Excel to PDF for DN: ${dn.DeliveryNoteNum}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:825',
      });

      // Convert Excel to PDF using LibreOffice
      const pdfBuffer = await excelToPdf(excelBuffer);

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `PDF generated successfully for DN: ${dn.DeliveryNoteNum}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:831',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return pdfBuffer;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR generating Delivery Note: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:830',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Send Delivery Note PDF via email
   */
  async sendDeliveryNoteEmail(
    id: string,
    dto: SendDeliveryNoteEmailDto,
    sentBy: string,
  ): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    deliveryNote?: unknown;
  }> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MAT_DEL_007',
        functionName: 'sendDeliveryNoteEmail',
        createdBy: sentBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Sending Delivery Note email for DN ID: ${id}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:838',
      });

      // Validate email recipients
      const toEmails = dto.to
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      if (toEmails.length === 0) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: 'No valid email recipients provided',
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:850',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          'At least one email recipient is required',
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Valid recipients: ${toEmails.join(', ')}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:857',
      });

      // Fetch DN to verify it exists
      const dn = await this.prisma.materialDeliveryNote.findUnique({
        where: { Id: id },
      });

      if (!dn) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `DN not found: ${id}`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:867',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new NotFoundException(`Delivery note not found: ${id}`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Found DN: ${dn.DeliveryNoteNum}, Status: ${dn.Status}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:876',
      });

      // Generate PDF
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: 'Generating PDF attachment',
        type: 'INFO',
        location: 'material-delivery-note.service.ts:881',
      });

      const pdfBuffer = await this.generateDeliveryNotePDF(id);

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `PDF generated, size: ${pdfBuffer.length} bytes`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:888',
      });

      // Process CC emails
      const ccEmails = dto.cc
        ? dto.cc
            .split(',')
            .map((email) => email.trim())
            .filter((email) => email.length > 0)
        : undefined;

      // Send email via SMTP
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: 'Sending email via SMTP',
        type: 'INFO',
        location: 'material-delivery-note.service.ts:902',
      });

      const emailResult = await this.smtpService.sendDeliveryNoteEmail({
        to: toEmails,
        cc: ccEmails,
        deliveryNoteNum: dn.DeliveryNoteNum,
        destination: dn.Destination,
        pdfBuffer,
        sentBy,
      });

      if (!emailResult.success) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Email send failed: ${emailResult.error}`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:917',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `Failed to send email: ${emailResult.error}`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Email sent successfully. MessageId: ${emailResult.messageId}`,
        type: 'INFO',
        location: 'material-delivery-note.service.ts:926',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return {
        success: true,
        messageId: emailResult.messageId,
        deliveryNote: await this.findOne(id),
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR sending Delivery Note email: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'material-delivery-note.service.ts:940',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
