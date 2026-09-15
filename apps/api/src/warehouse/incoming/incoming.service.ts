import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NasUploadService } from '../../common/utils/nas-upload.service';
import {
  CreateIncomingDto,
  UpdateIncomingDto,
  UploadIncomingAttachmentDto,
  CheckIncomingDto,
} from './dto';
import type {
  IncomingModel,
  IncomingMaterialModel,
  LogProcessModel,
  MaterialModel,
} from '../../generated/prisma/models';
import { LocationType, TransactionType } from '../../generated/prisma/enums';
import type {
  IncomingEntity,
  IncomingMaterialEntity,
} from './entities/incoming.entity';
import type { Prisma } from '../../generated/prisma/client';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';

// Allowed file extensions and max size
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class IncomingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
    private readonly nasUploadService: NasUploadService,
  ) {}

  async findAll(query: SearchPaginationQueryDto, open?: string) {
    const where: Prisma.IncomingWhereInput = query.search
      ? {
          OR: [
            { PoId: { contains: query.search, mode: 'insensitive' } },
            { Description: { contains: query.search, mode: 'insensitive' } },
            { ReceivedBy: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    // Filter by Closed status if open parameter is provided
    if (open !== undefined && open !== '') {
      const isOpen = open === 'true';
      where.Closed = !isOpen; // If open=true, Closed=false (open records); if open=false, Closed=true (closed records)
    }

    const [totalItems, results] = await Promise.all([
      this.prisma.incoming.count({ where }),
      this.prisma.incoming.findMany({
        where,
        include: {
          SupplierData: true,
          IncomingMaterial: {
            include: {
              MaterialData: true,
            },
          },
        },
        orderBy: [{ CreatedAt: 'desc' }, { Id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data: results.map((item) => this.mapToIncomingEntity(item)),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }

  async findOne(id: string): Promise<IncomingEntity> {
    const incoming = await this.prisma.incoming.findUnique({
      where: { Id: id },
      include: {
        SupplierData: true,
        IncomingMaterial: {
          include: {
            MaterialData: true,
          },
        },
      },
    });

    if (!incoming) {
      throw new NotFoundException(`Incoming with id ${id} not found`);
    }

    return this.mapToIncomingEntity(incoming);
  }

  async create(dto: CreateIncomingDto, createdBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INCOMING_001',
        functionName: 'IncomingService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating incoming with PO ID: ${dto.poId}, ${dto.materials.length} materials`,
        type: 'INFO',
        location: 'incoming.service.ts:45',
      });

      // POKAYOKE: Validate all material PartNumbers exist in Material master
      await this.validateMaterialsExist(dto.materials, logProcess.ProcessId);

      // Generate auto ID
      const incomingId = await this.generateIncomingId();

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Generated Incoming ID: ${incomingId}`,
        type: 'INFO',
        location: 'incoming.service.ts:82',
      });

      const processId = logProcess.ProcessId;
      const result = await this.prisma.$transaction(async (tx) => {
        // Create Incoming header
        const incoming = await tx.incoming.create({
          data: {
            Id: incomingId,
            PoId: dto.poId,
            Description: dto.description,
            ReceivedBy: dto.receivedBy,
            SupplierId: dto.supplierId,
            Closed: false,
          },
          include: {
            SupplierData: true,
            IncomingMaterial: {
              include: {
                MaterialData: true,
              },
            },
          },
        });

        await this.logService.addLog({
          processId,
          message: `Incoming header created with ID: ${incoming.Id}`,
          type: 'INFO',
          location: 'incoming.service.ts:66',
        });

        // Create IncomingMaterial entries
        const materialData = dto.materials.map((m) => ({
          IncomingId: incoming.Id,
          MaterialId: m.materialId,
          Qty: m.qty,
          QtyChecked: 0, // Default to 0, will be set via check endpoint
        }));

        await tx.incomingMaterial.createMany({
          data: materialData,
        });

        await this.logService.addLog({
          processId,
          message: `Created ${dto.materials.length} IncomingMaterial entries`,
          type: 'INFO',
          location: 'incoming.service.ts:79',
        });

        return incoming;
      });

      await this.logService.completeProcess(processId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'incoming.service.ts:93',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateIncomingDto, updatedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INCOMING_002',
        functionName: 'IncomingService.Update',
        createdBy: updatedBy,
      });

      const existing = await this.prisma.incoming.findUnique({
        where: { Id: id },
        include: {
          IncomingMaterial: true,
        },
      });

      if (!existing) {
        throw new NotFoundException(`Incoming with id ${id} not found`);
      }

      // EDIT PROTECTION: Cannot edit if Closed=true AND ApprovedAt is not null
      if (existing.Closed && existing.ApprovedAt) {
        throw new BadRequestException(
          'Cannot edit incoming that has been closed and approved.',
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating incoming ${existing.PoId}`,
        type: 'INFO',
        location: 'incoming.service.ts:130',
      });

      const processId = logProcess.ProcessId;
      const result = await this.prisma.$transaction(async (tx) => {
        // Update Incoming header
        const updateData: Record<string, unknown> = {};
        if (dto.description !== undefined)
          updateData.Description = dto.description;
        if (dto.receivedBy !== undefined)
          updateData.ReceivedBy = dto.receivedBy;
        if (dto.supplierId !== undefined)
          updateData.SupplierId = dto.supplierId;

        const updated = await tx.incoming.update({
          where: { Id: id },
          data: updateData,
          include: {
            SupplierData: true,
            IncomingMaterial: {
              include: {
                MaterialData: true,
              },
            },
          },
        });

        // Update materials if provided
        if (dto.materials && dto.materials.length > 0) {
          // Delete existing materials
          await tx.incomingMaterial.deleteMany({
            where: { IncomingId: id },
          });

          // Create new materials
          await tx.incomingMaterial.createMany({
            data: dto.materials.map((m) => ({
              IncomingId: id,
              MaterialId: m.materialId,
              Qty: m.qty,
            })),
          });

          await this.logService.addLog({
            processId,
            message: `Updated ${dto.materials.length} incoming materials`,
            type: 'INFO',
            location: 'incoming.service.ts:168',
          });
        }

        return updated;
      });

      await this.logService.addLog({
        processId,
        message: `Incoming updated successfully: ${result.PoId}`,
        type: 'INFO',
        location: 'incoming.service.ts:178',
      });

      await this.logService.completeProcess(processId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async remove(id: string, deletedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INCOMING_003',
        functionName: 'IncomingService.Delete',
        createdBy: deletedBy,
      });

      const existing = await this.prisma.incoming.findUnique({
        where: { Id: id },
        include: {
          IncomingMaterial: true,
        },
      });

      if (!existing) {
        throw new NotFoundException(`Incoming with id ${id} not found`);
      }

      // DELETE PROTECTION: Cannot delete if Closed=true AND ApprovedAt is not null
      if (existing.Closed && existing.ApprovedAt) {
        throw new BadRequestException(
          'Cannot delete incoming that has been closed and approved.',
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting incoming ${existing.PoId}`,
        type: 'INFO',
        location: 'incoming.service.ts:213',
      });

      await this.prisma.$transaction(async (tx) => {
        // Delete IncomingMaterial first
        await tx.incomingMaterial.deleteMany({
          where: { IncomingId: id },
        });

        // Delete Incoming
        await tx.incoming.delete({
          where: { Id: id },
        });
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

  /**
   * Receive incoming - close and approve, move to warehouse inventory
   */
  async receive(id: string, receivedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INCOMING_004',
        functionName: 'IncomingService.Receive',
        createdBy: receivedBy,
      });

      const existing = await this.prisma.incoming.findUnique({
        where: { Id: id },
        include: {
          IncomingMaterial: {
            include: {
              MaterialData: true,
            },
          },
        },
      });

      if (!existing) {
        throw new NotFoundException(`Incoming with id ${id} not found`);
      }

      // Cannot receive if already closed and approved
      if (existing.Closed && existing.ApprovedAt) {
        throw new BadRequestException(
          'Incoming has already been received and approved.',
        );
      }

      // Cannot receive if already closed but not approved
      if (existing.Closed && !existing.ApprovedAt) {
        throw new BadRequestException(
          'Incoming is closed but not yet approved.',
        );
      }

      // POKAYOKE: Validate QtyChecked equals Qty for all materials before receiving
      const unmatchedItems = existing.IncomingMaterial.filter(
        (item) => item.QtyChecked !== item.Qty,
      );

      if (unmatchedItems.length > 0) {
        const details = unmatchedItems
          .map((item) => {
            const partNumber = item.MaterialData?.PartNumber || 'Unknown';
            return `Material ${partNumber}: Qty=${item.Qty}, QtyChecked=${item.QtyChecked}`;
          })
          .join('; ');

        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `POKAYOKE FAILED: Receive rejected - QtyChecked does not match Qty. Details: ${details}`,
          type: 'ERROR',
          location: 'incoming.service.ts:275',
        });

        throw new BadRequestException(
          `POKAYOKE: QtyChecked must equal Qty for all materials before receiving. Unmatched items: ${details}`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Receiving incoming ${existing.PoId} with ${existing.IncomingMaterial.length} items`,
        type: 'INFO',
        location: 'incoming.service.ts:272',
      });

      const now = new Date();
      let totalQty = 0;
      const processId = logProcess.ProcessId;

      // Use transaction to update inventory and incoming
      await this.prisma.$transaction(async (tx) => {
        // Update incoming status
        await tx.incoming.update({
          where: { Id: id },
          data: {
            Closed: true,
            ApprovedAt: now,
            ApprovedBy: receivedBy,
          },
        });

        await this.logService.addLog({
          processId,
          message: `Incoming marked as Closed, ApprovedAt set to ${now.toISOString()}`,
          type: 'INFO',
          location: 'incoming.service.ts:287',
        });

        // Process each incoming material
        for (const item of existing.IncomingMaterial) {
          if (!item.MaterialId || !item.MaterialData) {
            await this.logService.addLog({
              processId,
              message: `Skipping item ${item.Id} - no material data`,
              type: 'WARN',
              location: 'incoming.service.ts:295',
            });
            continue;
          }

          // Get current stock
          const material = await tx.material.findUnique({
            where: { Id: item.MaterialId },
          });

          if (!material) {
            await this.logService.addLog({
              processId,
              message: `Material ${item.MaterialId} not found, skipping`,
              type: 'WARN',
              location: 'incoming.service.ts:303',
            });
            continue;
          }

          const balanceBefore = material.QtyWarehouse || 0;
          const balanceAfter = balanceBefore + item.Qty;
          totalQty += item.Qty;

          // Create InventoryLedger entry
          // Note: InventoryLedger.MaterialId references Material.PartNumber (String), not Material.Id (Int)
          await tx.inventoryLedger.create({
            data: {
              Id: crypto.randomUUID(),
              TransactionDate: now,
              ItemCategory: 'MATERIAL',
              MaterialId: material.PartNumber,
              Location: LocationType.WAREHOUSE,
              TransactionType: TransactionType.INCOMING_SUPPLIER,
              ReferenceDoc: existing.PoId,
              BalanceBefore: balanceBefore,
              QtyIn: item.Qty,
              QtyOut: 0,
              BalanceAfter: balanceAfter,
              CreatedBy: receivedBy,
              Notes: `Incoming from PO: ${existing.PoId}`,
            },
          });

          await this.logService.addLog({
            processId,
            message: `Created InventoryLedger for Material ${item.MaterialId}: +${item.Qty} (${balanceBefore} -> ${balanceAfter})`,
            type: 'INFO',
            location: 'incoming.service.ts:325',
          });

          // Update Material QtyWarehouse
          await tx.material.update({
            where: { Id: item.MaterialId },
            data: {
              QtyWarehouse: balanceAfter,
            },
          });

          await this.logService.addLog({
            processId,
            message: `Updated Material ${item.MaterialId} QtyWarehouse: ${balanceAfter}`,
            type: 'INFO',
            location: 'incoming.service.ts:333',
          });
        }
      });

      await this.logService.addLog({
        processId,
        message: `Receive completed: ${existing.IncomingMaterial.length} items, ${totalQty} total qty`,
        type: 'INFO',
        location: 'incoming.service.ts:341',
      });

      await this.logService.completeProcess(processId, 'SUCCESS');

      return {
        id: existing.Id,
        poId: existing.PoId,
        status: 'APPROVED',
        approvedAt: now,
        totalItems: existing.IncomingMaterial.length,
        totalQty,
        inventoryUpdated: true,
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Check incoming materials - set QtyChecked for each material
   * Validates that the incoming is not yet closed/received before allowing check
   */
  async check(id: string, dto: CheckIncomingDto, checkedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INCOMING_005',
        functionName: 'IncomingService.Check',
        createdBy: checkedBy,
      });

      const existing = await this.prisma.incoming.findUnique({
        where: { Id: id },
        include: {
          IncomingMaterial: {
            include: {
              MaterialData: true,
            },
          },
        },
      });

      if (!existing) {
        throw new NotFoundException(`Incoming with id ${id} not found`);
      }

      // Cannot check if already closed and approved (received)
      if (existing.Closed && existing.ApprovedAt) {
        throw new BadRequestException(
          'Cannot check incoming that has already been received and approved.',
        );
      }

      // Cannot check if closed but not approved
      if (existing.Closed && !existing.ApprovedAt) {
        throw new BadRequestException(
          'Cannot check incoming that is already closed.',
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Checking incoming ${existing.PoId} with ${dto.materials.length} items`,
        type: 'INFO',
        location: 'incoming.service.ts:540',
      });

      const now = new Date();
      const processId = logProcess.ProcessId;
      const materialsChecked: Array<{
        incomingMaterialId: number;
        materialId: number | null;
        partNumber: string;
        qtyExpected: number;
        qtyChecked: number;
      }> = [];

      // Validate that all incomingMaterialIds exist in this incoming
      const validMaterialIds = new Set(
        existing.IncomingMaterial.map((m) => m.Id),
      );

      for (const checkItem of dto.materials) {
        if (!validMaterialIds.has(checkItem.incomingMaterialId)) {
          throw new BadRequestException(
            `Incoming material with id ${checkItem.incomingMaterialId} not found in incoming ${id}`,
          );
        }
      }

      // Use transaction to update all QtyChecked values
      await this.prisma.$transaction(async (tx) => {
        for (const checkItem of dto.materials) {
          // Find the material data
          const materialData = existing.IncomingMaterial.find(
            (m) => m.Id === checkItem.incomingMaterialId,
          );

          if (!materialData) {
            continue;
          }

          // Update QtyChecked
          await tx.incomingMaterial.update({
            where: { Id: checkItem.incomingMaterialId },
            data: {
              QtyChecked: checkItem.qtyChecked,
            },
          });

          await this.logService.addLog({
            processId,
            message: `Updated QtyChecked for incoming material ${checkItem.incomingMaterialId}: ${materialData.Qty} -> ${checkItem.qtyChecked}`,
            type: 'INFO',
            location: 'incoming.service.ts:575',
          });

          materialsChecked.push({
            incomingMaterialId: checkItem.incomingMaterialId,
            materialId: materialData.MaterialId,
            partNumber: materialData.MaterialData?.PartNumber || 'Unknown',
            qtyExpected: materialData.Qty,
            qtyChecked: checkItem.qtyChecked,
          });
        }
      });

      await this.logService.addLog({
        processId,
        message: `Check completed: ${materialsChecked.length} items checked`,
        type: 'INFO',
        location: 'incoming.service.ts:590',
      });

      await this.logService.completeProcess(processId, 'SUCCESS');

      return {
        id: existing.Id,
        poId: existing.PoId,
        status: 'CHECKED',
        checkedAt: now,
        checkedBy,
        totalItems: materialsChecked.length,
        materialsChecked,
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'incoming.service.ts:605',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Generate auto ID for Incoming
   * Format: INC-DDMMYY-XXX (e.g., INC-080626-001)
   * XXX = 3-digit sequential, resets daily
   */
  async generateIncomingId(): Promise<string> {
    const now = new Date();
    const datePart = `${now.getDate().toString().padStart(2, '0')}${(
      now.getMonth() + 1
    )
      .toString()
      .padStart(2, '0')}${now.getFullYear().toString().slice(-2)}`;
    const prefix = `INC-${datePart}-`;

    // Find the highest sequence number for today
    const latestIncoming = await this.prisma.incoming.findFirst({
      where: {
        Id: { startsWith: prefix },
      },
      orderBy: { Id: 'desc' },
      select: { Id: true },
    });

    let nextSeq = 1;
    if (latestIncoming) {
      const lastSeq = parseInt(latestIncoming.Id.split('-')[2], 10);
      nextSeq = lastSeq + 1;
    }

    return `${prefix}${nextSeq.toString().padStart(3, '0')}`;
  }

  /**
   * POKAYOKE: Validate that all materials exist in Material master
   */
  private async validateMaterialsExist(
    materials: { materialId: number }[],
    processId: string,
  ): Promise<void> {
    const materialIds = materials.map((m) => m.materialId);

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: Validating ${materialIds.length} materials exist in Material master`,
      type: 'INFO',
      location: 'incoming.service.ts:368',
    });

    const existingMaterials = await this.prisma.material.findMany({
      where: { Id: { in: materialIds } },
      select: { Id: true, PartNumber: true, IsActive: true },
    });

    const existingIds = new Set(existingMaterials.map((m) => m.Id));

    const missingMaterials: number[] = [];
    const discontinuedMaterials: string[] = [];

    for (const mat of materials) {
      if (!existingIds.has(mat.materialId)) {
        missingMaterials.push(mat.materialId);
      }
    }

    // Check for discontinued materials
    for (const existing of existingMaterials) {
      if (!existing.IsActive) {
        discontinuedMaterials.push(existing.PartNumber);
      }
    }

    if (missingMaterials.length > 0) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: Materials ${missingMaterials.join(', ')} not found in Material master`,
        type: 'ERROR',
        location: 'incoming.service.ts:385',
      });

      throw new BadRequestException(
        `POKAYOKE: Material IDs ${missingMaterials.join(', ')} not found in Material master. Please check Part Number.`,
      );
    }

    if (discontinuedMaterials.length > 0) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: Materials ${discontinuedMaterials.join(', ')} are discontinued (IsActive=false)`,
        type: 'ERROR',
        location: 'incoming.service.ts:400',
      });

      throw new BadRequestException(
        `POKAYOKE: Material(s) ${discontinuedMaterials.join(', ')} are discontinued and cannot be used in transactions. Please reactivate the material first.`,
      );
    }

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: All ${materialIds.length} materials validated successfully (all active)`,
      type: 'INFO',
      location: 'incoming.service.ts:408',
    });
  }

  /**
   * Get incoming by PO ID
   */
  async findByPoId(poId: string): Promise<IncomingEntity> {
    const incoming = await this.prisma.incoming.findUnique({
      where: { PoId: poId },
      include: {
        SupplierData: true,
        IncomingMaterial: {
          include: {
            MaterialData: true,
          },
        },
      },
    });

    if (!incoming) {
      throw new NotFoundException(`Incoming with PO ID ${poId} not found`);
    }

    return this.mapToIncomingEntity(incoming);
  }

  /**
   * Upload attachment for incoming
   * Only accepts PDF or image files (jpg, jpeg, png, gif, webp), max 10MB
   */
  async uploadAttachment(
    incomingId: string,
    dto: UploadIncomingAttachmentDto,
    file: Express.Multer.File,
    createdBy: string,
  ) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INCOMING_ATTACH_001',
        functionName: 'IncomingService.UploadAttachment',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting attachment upload for incoming: ${incomingId}`,
        type: 'INFO',
        location: 'incoming.service.ts:620',
      });

      // Validate file extension
      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
      if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Invalid file extension: ${fileExtension}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
          type: 'ERROR',
          location: 'incoming.service.ts:630',
        });
        throw new UnsupportedMediaTypeException(
          `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `File too large: ${file.size} bytes. Max: ${MAX_FILE_SIZE} bytes`,
          type: 'ERROR',
          location: 'incoming.service.ts:640',
        });
        throw new BadRequestException(`File too large. Maximum size is 10MB`);
      }

      // Check if incoming exists
      const incoming = await this.prisma.incoming.findUnique({
        where: { Id: incomingId },
      });

      if (!incoming) {
        throw new NotFoundException(`Incoming with id ${incomingId} not found`);
      }

      // Generate filename: PoId_ddMMyyyy.extension
      const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
      const dateStr = new Date()
        .toLocaleDateString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        .replace(/\//g, '');
      const newFileName = `${incoming.PoId}_${dateStr}.${ext}`;

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Uploading file as: ${newFileName}`,
        type: 'INFO',
        location: 'incoming.service.ts:660',
      });

      // Upload file to NAS with formatted filename
      const fileUrl = await this.nasUploadService.uploadFile({
        fileName: newFileName,
        fileBuffer: file.buffer,
        subFolder: `incoming/${incomingId}`,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `File uploaded to NAS: ${fileUrl}`,
        type: 'INFO',
        location: 'incoming.service.ts:670',
      });

      // Create attachment record in Incoming table (update FileName and FilePath)
      const updated = await this.prisma.incoming.update({
        where: { Id: incomingId },
        data: {
          FileName: newFileName,
          FilePath: fileUrl,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Attachment created for incoming ${incomingId}: ${fileUrl}`,
        type: 'INFO',
        location: 'incoming.service.ts:680',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return {
        id: updated.Id,
        fileName: newFileName,
        filePath: fileUrl,
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'incoming.service.ts:700',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Get attachment info for an incoming
   */
  async getAttachments(incomingId: string) {
    const incoming = await this.prisma.incoming.findUnique({
      where: { Id: incomingId },
      select: {
        Id: true,
        FileName: true,
        FilePath: true,
      },
    });

    if (!incoming) {
      throw new NotFoundException(`Incoming with id ${incomingId} not found`);
    }

    return incoming;
  }

  /**
   * Delete attachment
   */
  async deleteAttachment(
    attachmentId: number,
    deletedBy: string,
  ): Promise<{ deleted: boolean; id: number }> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INCOMING_ATTACH_002',
        functionName: 'IncomingService.DeleteAttachment',
        createdBy: deletedBy,
      });

      const incoming = await this.prisma.incoming.findFirst({
        where: {
          Id: String(attachmentId),
        },
      });

      if (!incoming) {
        throw new NotFoundException(
          `Incoming with id ${attachmentId} not found`,
        );
      }

      if (!incoming.FilePath) {
        throw new NotFoundException(
          `No attachment found for incoming ${attachmentId}`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting attachment for incoming ${attachmentId}: ${incoming.FileName}`,
        type: 'INFO',
        location: 'incoming.service.ts:750',
      });

      // Delete file from NAS if exists
      try {
        await this.nasUploadService.deleteFile(incoming.FilePath);
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `File deleted from NAS: ${incoming.FilePath}`,
          type: 'INFO',
          location: 'incoming.service.ts:758',
        });
      } catch (nasError) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Warning: Could not delete file from NAS: ${nasError instanceof Error ? nasError.message : 'Unknown error'}`,
          type: 'WARN',
          location: 'incoming.service.ts:764',
        });
      }

      // Clear FileName and FilePath in database
      await this.prisma.incoming.update({
        where: { Id: incoming.Id },
        data: {
          FileName: null,
          FilePath: null,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Attachment for incoming ${attachmentId} deleted successfully`,
        type: 'INFO',
        location: 'incoming.service.ts:775',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id: attachmentId };
    } catch (error) {
      if (logProcess) {
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Map Prisma result to IncomingEntity
   * Note: Using type assertion since Prisma types are complex with include relations
   */
  private mapToIncomingEntity(data: Record<string, unknown>): IncomingEntity {
    return {
      Id: data.Id as string,
      PoId: data.PoId as string,
      Description: data.Description as string | null,
      CreatedAt: data.CreatedAt as Date,
      UpdatedAt: data.UpdatedAt as Date,
      ReceivedBy: data.ReceivedBy as string,
      ApprovedAt: data.ApprovedAt as Date | null,
      Closed: data.Closed as boolean,
      ApprovedBy: data.ApprovedBy as string | null,
      SupplierId: data.SupplierId as number,
      SupplierData: data.SupplierData
        ? {
            Id: (data.SupplierData as Record<string, unknown>).Id as number,
            Name: (data.SupplierData as Record<string, unknown>).Name as string,
          }
        : ({} as import('./entities/incoming.entity').SupplierEntity),
      IncomingMaterial: (
        data.IncomingMaterial as Array<Record<string, unknown>>
      ).map((im): IncomingMaterialEntity => ({
        Id: im.Id as number,
        IncomingId: im.IncomingId as string | null,
        MaterialId: im.MaterialId as number | null,
        Qty: im.Qty as number,
        QtyChecked: im.QtyChecked as number,
        CreatedAt: im.CreatedAt as Date,
        MaterialData: im.MaterialData
          ? {
              Id: (im.MaterialData as Record<string, unknown>).Id as number,
              PartNumber: (im.MaterialData as Record<string, unknown>)
                .PartNumber as string,
              PartName: (im.MaterialData as Record<string, unknown>)
                .PartName as string,
            }
          : null,
      })),
    };
  }
}
