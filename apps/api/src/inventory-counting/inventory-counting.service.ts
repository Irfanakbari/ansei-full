import { auditedWrite } from '../common/helpers/audited-transaction.helper';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';
import type { LogProcessModel } from '../generated/prisma/models';
import type { Prisma } from '../generated/prisma/client';
import {
  CreateInventoryCountingDto,
  UpdateInventoryCountingDto,
  UpdateActualStockDto,
  CloseInventoryCountingDto,
  GenerateCutOffDto,
  InventoryCountingQueryDto,
} from './dto';
import {
  ItemCategory,
  OpnameStatus,
  LocationType,
  TransactionType,
} from '../generated/prisma/enums';
import { Workbook } from 'exceljs';
import dayjs from 'dayjs';
import * as fs from 'fs';
import * as path from 'path';
import {
  getUserDisplayName,
  getUserDisplayNameMap,
} from '../common/helpers/user-lookup.helper';
import { withInventoryTransaction } from '../common/helpers/inventory-transaction.helper';

@Injectable()
export class InventoryCountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async create(dto: CreateInventoryCountingDto, createdBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      // STEP 1: Start logging process
      logProcess = await this.logService.startProcess({
        functionId: 'INV_COUNT_001',
        functionName: 'InventoryCountingService.create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting create inventory counting: OpnameNumber=${dto.opnameNumber}, Category=${dto.category}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:38',
      });

      // STEP 2: Validate opnameNumber uniqueness
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: 'Validating opnameNumber uniqueness',
        type: 'INFO',
        location: 'inventory-counting.service.ts:44',
      });

      const existingOpname = await this.prisma.stockOpname.findUnique({
        where: { OpnameNumber: dto.opnameNumber },
      });

      if (existingOpname) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Duplicate opnameNumber: ${dto.opnameNumber}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:52',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `Inventory counting with OpnameNumber ${dto.opnameNumber} already exists`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `OpnameNumber ${dto.opnameNumber} is unique, proceeding with creation`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:60',
      });

      // STEP 3: Create StockOpname record
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: 'Creating StockOpname record',
        type: 'INFO',
        location: 'inventory-counting.service.ts:66',
      });

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.stockOpname.create({
          data: {
            OpnameNumber: dto.opnameNumber,
            Category: dto.category,
            Status: OpnameStatus.DRAFT,
            Notes: dto.notes,
            Tolerance: dto.tolerance ?? 0,
            CreatedBy: createdBy,
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `StockOpname created successfully: ID=${result.Id}, OpnameNumber=${result.OpnameNumber}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:80',
      });

      // STEP 4: Complete logging process
      await this.logService.completeProcess(
        logProcess.ProcessId,
        'SUCCESS',
        'Inventory counting created successfully',
      );

      return {
        success: true,
        processId: logProcess.ProcessId,
        data: result,
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:96',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async findAll(query: InventoryCountingQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;

    const where: Prisma.StockOpnameWhereInput = {};

    if (query.status) {
      where.Status = query.status;
    }

    if (query.category) {
      where.Category = query.category;
    }

    if (query.createdBy) {
      where.CreatedBy = {
        contains: query.createdBy,
        mode: 'insensitive',
      };
    }

    const [total, data] = await Promise.all([
      this.prisma.stockOpname.count({ where }),
      this.prisma.stockOpname.findMany({
        where,
        orderBy: [{ CreatedAt: 'desc' }, { Id: 'desc' }],
        skip: offset,
        take: limit,
        include: {
          Details: {
            select: {
              Id: true,
              OpnameId: true,
              MaterialId: true,
              FinishGoodId: true,
              Location: true,
              SystemQty: true,
              SystemQtyRack: true,
              ActualQty: true,
              ActualQtyRack: true,
              DiffQty: true,
              DiffQtyRack: true,
              Notes: true,
            },
          },
        },
      }),
    ]);

    return {
      data: data.map((item) => ({
        Id: item.Id,
        OpnameNumber: item.OpnameNumber,
        Category: item.Category,
        Status: item.Status,
        Tolerance: item.Tolerance,
        CreatedAt: item.CreatedAt,
        CreatedBy: item.CreatedBy,
        StartedAt: item.StartedAt,
        CompletedAt: item.CompletedAt,
        CompletedBy: item.CompletedBy,
        Notes: item.Notes,
        Details: item.Details,
        TotalItems: item.Details.length,
        CompletedItems: item.Details.filter((d) => d.ActualQty !== null).length,
      })),
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const logProcess = await this.logService.startProcess({
      functionId: 'INV_COUNT_002',
      functionName: 'InventoryCountingService.findOne',
    });

    await this.logService.addLog({
      processId: logProcess.ProcessId,
      message: `Finding inventory counting by ID: ${id}`,
      type: 'INFO',
      location: 'inventory-counting.service.ts:180',
    });

    const result = await this.prisma.stockOpname.findUnique({
      where: { Id: id },
      include: {
        Details: {
          select: {
            Id: true,
            OpnameId: true,
            MaterialId: true,
            FinishGoodId: true,
            Location: true,
            SystemQty: true,
            SystemQtyRack: true,
            ActualQty: true,
            ActualQtyRack: true,
            DiffQty: true,
            DiffQtyRack: true,
            Notes: true,
          },
        },
      },
    });

    if (!result) {
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Inventory counting not found: ${id}`,
        type: 'ERROR',
        location: 'inventory-counting.service.ts:200',
      });
      await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      throw new NotFoundException(`Inventory counting with ID ${id} not found`);
    }

    await this.logService.addLog({
      processId: logProcess.ProcessId,
      message: `Inventory counting found: ${result.OpnameNumber}, Status=${result.Status}`,
      type: 'INFO',
      location: 'inventory-counting.service.ts:208',
    });

    await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

    return {
      Id: result.Id,
      OpnameNumber: result.OpnameNumber,
      Category: result.Category,
      Status: result.Status,
      Tolerance: result.Tolerance,
      CreatedAt: result.CreatedAt,
      CreatedBy: result.CreatedBy,
      StartedAt: result.StartedAt,
      CompletedAt: result.CompletedAt,
      CompletedBy: result.CompletedBy,
      Notes: result.Notes,
      Details: result.Details.map((d) => ({
        Id: d.Id,
        OpnameId: d.OpnameId,
        MaterialId: d.MaterialId,
        FinishGoodId: d.FinishGoodId,
        Location: d.Location,
        SystemQty: d.SystemQty,
        SystemQtyRack: d.SystemQtyRack,
        ActualQty: d.ActualQty,
        ActualQtyRack: d.ActualQtyRack,
        DiffQty: d.DiffQty,
        DiffQtyRack: d.DiffQtyRack,
        Notes: d.Notes,
      })),
      TotalItems: result.Details.length,
      CompletedItems: result.Details.filter((d) => d.ActualQty !== null).length,
    };
  }

  async update(id: string, dto: UpdateInventoryCountingDto, updatedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INV_COUNT_003',
        functionName: 'InventoryCountingService.update',
        createdBy: updatedBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating inventory counting: ID=${id}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:234',
      });

      // STEP 1: Validate existing record
      const existing = await this.prisma.stockOpname.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Inventory counting not found: ${id}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:246',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new NotFoundException(
          `Inventory counting with ID ${id} not found`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Found existing inventory counting: ${existing.OpnameNumber}, Status=${existing.Status}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:254',
      });

      if (
        dto.tolerance !== undefined &&
        (existing.Status === OpnameStatus.COMPLETED ||
          existing.Status === OpnameStatus.CANCELLED)
      ) {
        throw new BadRequestException(
          `Cannot update tolerance when inventory counting is ${existing.Status}`,
        );
      }

      // STEP 2: Build update data
      const updateData: Prisma.StockOpnameUpdateInput = {};
      if (dto.notes !== undefined) {
        updateData.Notes = dto.notes;
      }
      if (dto.tolerance !== undefined) {
        updateData.Tolerance = dto.tolerance;
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating fields: ${Object.keys(updateData).join(', ')}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:265',
      });

      // STEP 3: Execute update
      const result = await auditedWrite(this.prisma, (tx) =>
        tx.stockOpname.update({
          where: { Id: id },
          data: updateData,
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Inventory counting updated successfully: ${result.OpnameNumber}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:276',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return {
        success: true,
        processId: logProcess.ProcessId,
        data: result,
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:290',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async remove(id: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INV_COUNT_004',
        functionName: 'InventoryCountingService.remove',
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting inventory counting: ID=${id}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:308',
      });

      // STEP 1: Validate existing record
      const existing = await this.prisma.stockOpname.findUnique({
        where: { Id: id },
        include: {
          _count: {
            select: { Details: true },
          },
        },
      });

      if (!existing) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Inventory counting not found: ${id}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:322',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new NotFoundException(
          `Inventory counting with ID ${id} not found`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Found existing inventory counting: ${existing.OpnameNumber}, Status=${existing.Status}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:330',
      });

      // STEP 2: Only allow delete for DRAFT status
      if (existing.Status !== OpnameStatus.DRAFT) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Cannot delete inventory counting with status ${existing.Status}. Only DRAFT status is allowed.`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:338',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `Cannot delete inventory counting with status ${existing.Status}. Only DRAFT status is allowed.`,
        );
      }

      // STEP 3: Delete in transaction (cascade will delete details)
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting inventory counting and its ${existing._count.Details} details`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:350',
      });

      await auditedWrite(this.prisma, (tx) =>
        tx.stockOpname.delete({
          where: { Id: id },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Inventory counting ${existing.OpnameNumber} deleted successfully`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:358',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return {
        success: true,
        processId: logProcess.ProcessId,
        message: `Inventory counting #${id} deleted`,
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:374',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async start(id: string, startedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INV_COUNT_005',
        functionName: 'InventoryCountingService.start',
        createdBy: startedBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting inventory counting: ID=${id}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:457',
      });

      // STEP 1: Validate existing record
      const existing = await this.prisma.stockOpname.findUnique({
        where: { Id: id },
        include: {
          Details: true,
        },
      });

      if (!existing) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Inventory counting not found: ${id}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:471',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new NotFoundException(
          `Inventory counting with ID ${id} not found`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Found existing inventory counting: ${existing.OpnameNumber}, Current Status=${existing.Status}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:481',
      });

      // STEP 2: Validate current status is DRAFT
      if (existing.Status !== OpnameStatus.DRAFT) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Cannot start inventory counting with status ${existing.Status}. Must be DRAFT.`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:503',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `Cannot start inventory counting with status ${existing.Status}. Must be DRAFT.`,
        );
      }

      // STEP 3: Auto-generate details if none exist (from category configuration)
      if (existing.Details.length === 0) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `No details found. Auto-generating details for category: ${existing.Category}`,
          type: 'INFO',
          location: 'inventory-counting.service.ts:510',
        });

        // Determine locations based on category
        const locations =
          existing.Category === ItemCategory.MATERIAL
            ? [LocationType.WAREHOUSE, LocationType.RACK]
            : [LocationType.FINISH_GOOD_AREA];

        const cutOffEntries: Array<{
          OpnameId: string;
          MaterialId: string | null;
          FinishGoodId: string | null;
          Location: LocationType;
          SystemQty: number;
          SystemQtyRack: number;
          Notes: string;
        }> = [];

        for (const loc of locations) {
          if (existing.Category === ItemCategory.MATERIAL) {
            // Fetch only active materials for inventory counting details
            const materials = await this.prisma.material.findMany({
              where: { IsActive: true },
              select: { PartNumber: true, PartName: true },
            });

            await this.logService.addLog({
              processId: logProcess.ProcessId,
              message: `Found ${materials.length} active MATERIAL items for inventory counting`,
              type: 'INFO',
              location: 'inventory-counting.service.ts:545',
            });

            for (const m of materials) {
              cutOffEntries.push({
                OpnameId: id,
                MaterialId: m.PartNumber,
                FinishGoodId: null,
                Location: loc,
                SystemQty: 0,
                SystemQtyRack: 0,
                Notes: m.PartName || '',
              });
            }
          } else {
            // FINISH_GOOD
            const finishGoods = await this.prisma.finishGood.findMany({
              select: { PartNumber: true, PartName: true },
            });

            for (const fg of finishGoods) {
              cutOffEntries.push({
                OpnameId: id,
                MaterialId: null,
                FinishGoodId: fg.PartNumber,
                Location: loc,
                SystemQty: 0,
                SystemQtyRack: 0,
                Notes: fg.PartName || '',
              });
            }
          }
        }

        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Generated ${cutOffEntries.length} detail entries`,
          type: 'INFO',
          location: 'inventory-counting.service.ts:548',
        });

        // Create details
        await auditedWrite(this.prisma, (tx) =>
          tx.stockOpnameDetail.createMany({
            data: cutOffEntries,
          }),
        );

        // Re-fetch details for snapshot
        existing.Details = await this.prisma.stockOpnameDetail.findMany({
          where: { OpnameId: id },
        });
      }

      // STEP 4: Snapshot current stock into SystemQty/SystemQtyRack for all details
      // For MATERIAL with 2 locations (WAREHOUSE and RACK):
      //   - WAREHOUSE detail: SystemQty = QtyWarehouse, SystemQtyRack = 0
      //   - RACK detail: SystemQty = 0, SystemQtyRack = QtyRack
      // For FINISH_GOOD:
      //   - SystemQty = Qty
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Taking stock snapshot for ${existing.Details.length} items`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:596',
      });

      const localProcessId = logProcess.ProcessId;

      await withInventoryTransaction(
        this.prisma,
        existing.Category,
        async (tx) => {
          const claimed = await tx.stockOpname.updateMany({
            where: { Id: id, Status: OpnameStatus.DRAFT },
            data: { Status: OpnameStatus.IN_PROGRESS, StartedAt: new Date() },
          });
          if (claimed.count !== 1) {
            throw new BadRequestException(
              'Inventory counting has already been started or changed concurrently.',
            );
          }
          for (const detail of existing.Details) {
            if (detail.MaterialId) {
              // MATERIAL: snapshot based on location
              const material = await tx.material.findUnique({
                where: { PartNumber: detail.MaterialId },
                select: { QtyWarehouse: true, QtyRack: true },
              });

              if (material) {
                const isRack = detail.Location === LocationType.RACK;
                // WAREHOUSE: SystemQty = QtyWarehouse, SystemQtyRack = 0
                // RACK: SystemQty = 0, SystemQtyRack = QtyRack
                const systemQty = isRack ? 0 : material.QtyWarehouse;
                const systemQtyRack = isRack ? material.QtyRack : 0;

                await tx.stockOpnameDetail.update({
                  where: { Id: detail.Id },
                  data: {
                    SystemQty: systemQty,
                    SystemQtyRack: systemQtyRack,
                  },
                });

                await this.logService.addLog({
                  processId: localProcessId,
                  message: `MATERIAL ${detail.MaterialId} [${detail.Location}]: SystemQty=${systemQty}, SystemQtyRack=${systemQtyRack}`,
                  type: 'INFO',
                  location: 'inventory-counting.service.ts:538',
                });
              }
            } else if (detail.FinishGoodId) {
              // FINISH_GOOD: snapshot from Qty
              const fg = await tx.finishGood.findUnique({
                where: { PartNumber: detail.FinishGoodId },
                select: { Qty: true },
              });

              if (fg) {
                await tx.stockOpnameDetail.update({
                  where: { Id: detail.Id },
                  data: {
                    SystemQty: fg.Qty,
                  },
                });

                await this.logService.addLog({
                  processId: localProcessId,
                  message: `FINISHGOOD ${detail.FinishGoodId}: SystemQty=${fg.Qty}`,
                  type: 'INFO',
                  location: 'inventory-counting.service.ts:562',
                });
              }
            }
          }

          await this.logService.addLog({
            processId: localProcessId,
            message: 'Inventory counting status updated to IN_PROGRESS',
            type: 'INFO',
            location: 'inventory-counting.service.ts:681',
          });
        },
      );

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return {
        success: true,
        processId: logProcess.ProcessId,
        data: await this.findOne(id),
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:596',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async generateCutOff(dto: GenerateCutOffDto, createdBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INV_COUNT_006',
        functionName: 'InventoryCountingService.generateCutOff',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Generating cut-off for inventory counting: ID=${dto.inventoryCountingId}, Category=${dto.itemCategory}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:478',
      });

      // STEP 1: Validate InventoryCounting exists and is in correct status
      const inventoryCounting = await this.prisma.stockOpname.findUnique({
        where: { Id: dto.inventoryCountingId },
      });

      if (!inventoryCounting) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Inventory counting not found: ${dto.inventoryCountingId}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:490',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new NotFoundException(
          `Inventory counting with ID ${dto.inventoryCountingId} not found`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Found inventory counting: ${inventoryCounting.OpnameNumber}, Status=${inventoryCounting.Status}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:498',
      });

      // STEP 2: Validate status is DRAFT
      if (inventoryCounting.Status !== OpnameStatus.DRAFT) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Cannot generate cut-off for inventory counting with status ${inventoryCounting.Status}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:508',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `Cannot generate cut-off for inventory counting with status ${inventoryCounting.Status}`,
        );
      }

      // STEP 3: Fetch items based on category
      // NOTE: SystemQty/SystemQtyRack will be snapshot when START is called, not here
      // This endpoint only creates detail entries with zero system qty as placeholders
      // NOTE: Only active materials (IsActive=true) are included in inventory counting
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Fetching ${dto.itemCategory} items for cut-off (system qty will be snapshotted on START). Only active materials included.`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:620',
      });

      // Target location for detail entries
      const targetLocation = dto.location as LocationType | undefined;
      const locations: LocationType[] = targetLocation
        ? [targetLocation]
        : dto.itemCategory === 'MATERIAL'
          ? [LocationType.WAREHOUSE, LocationType.RACK]
          : [LocationType.FINISH_GOOD_AREA];

      const cutOffEntries: Array<{
        OpnameId: string;
        MaterialId: string | null;
        FinishGoodId: string | null;
        Location: LocationType;
        SystemQty: number;
        SystemQtyRack: number;
        Notes: string;
      }> = [];

      for (const loc of locations) {
        if (dto.itemCategory === 'MATERIAL') {
          // Only fetch active materials (IsActive=true)
          const materials = await this.prisma.material.findMany({
            where: { IsActive: true },
            select: {
              PartNumber: true,
              PartName: true,
            },
          });

          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `Found ${materials.length} active MATERIAL items`,
            type: 'INFO',
            location: 'inventory-counting.service.ts:795',
          });

          for (const m of materials) {
            cutOffEntries.push({
              OpnameId: dto.inventoryCountingId,
              MaterialId: m.PartNumber,
              FinishGoodId: null,
              Location: loc,
              SystemQty: 0, // Will be snapshot on START
              SystemQtyRack: 0, // Will be snapshot on START
              Notes: m.PartName || '',
            });
          }
        } else {
          // FINISH_GOOD
          const finishGoods = await this.prisma.finishGood.findMany({
            select: {
              PartNumber: true,
              PartName: true,
            },
          });

          for (const fg of finishGoods) {
            cutOffEntries.push({
              OpnameId: dto.inventoryCountingId,
              MaterialId: null,
              FinishGoodId: fg.PartNumber,
              Location: loc,
              SystemQty: 0, // Will be snapshot on START
              SystemQtyRack: 0,
              Notes: fg.PartName || '',
            });
          }
        }
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Found ${cutOffEntries.length} cut-off entries across ${locations.length} location(s)`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:675',
      });

      // STEP 4: Create cut-off details in transaction
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message:
          'Creating cut-off details (system qty = 0, will be snapshotted on START)',
        type: 'INFO',
        location: 'inventory-counting.service.ts:681',
      });

      const localProcessId = logProcess.ProcessId;

      await withInventoryTransaction(
        this.prisma,
        inventoryCounting.Category,
        async (tx) => {
          const currentCounting = await tx.stockOpname.findUnique({
            where: { Id: dto.inventoryCountingId },
          });
          if (!currentCounting) {
            throw new NotFoundException(
              `Inventory counting with ID ${dto.inventoryCountingId} not found`,
            );
          }
          if (currentCounting.Status !== OpnameStatus.DRAFT) {
            throw new BadRequestException(
              `Cannot generate cut-off for inventory counting with status ${currentCounting.Status}`,
            );
          }
          if (cutOffEntries.length > 0) {
            await tx.stockOpnameDetail.createMany({
              data: cutOffEntries,
              skipDuplicates: true,
            });
          }

          // STEP 5: Auto-start after snapshot generation
          await this.logService.addLog({
            processId: localProcessId,
            message:
              'Auto-starting inventory counting (was DRAFT) - this will snapshot system qty',
            type: 'INFO',
            location: 'inventory-counting.service.ts:695',
          });

          // Get all details that were just created
          const details = await tx.stockOpnameDetail.findMany({
            where: { OpnameId: dto.inventoryCountingId },
          });

          // Snapshot system qty for all details
          // For MATERIAL with 2 locations (WAREHOUSE and RACK):
          //   - WAREHOUSE detail: SystemQty = QtyWarehouse, SystemQtyRack = 0
          //   - RACK detail: SystemQty = 0, SystemQtyRack = QtyRack
          // For FINISH_GOOD:
          //   - SystemQty = Qty
          for (const detail of details) {
            if (detail.MaterialId) {
              const material = await tx.material.findUnique({
                where: { PartNumber: detail.MaterialId },
                select: { QtyWarehouse: true, QtyRack: true },
              });

              if (material) {
                const isRack = detail.Location === LocationType.RACK;
                // WAREHOUSE: SystemQty = QtyWarehouse, SystemQtyRack = 0
                // RACK: SystemQty = 0, SystemQtyRack = QtyRack
                const systemQty = isRack ? 0 : material.QtyWarehouse;
                const systemQtyRack = isRack ? material.QtyRack : 0;

                await tx.stockOpnameDetail.update({
                  where: { Id: detail.Id },
                  data: {
                    SystemQty: systemQty,
                    SystemQtyRack: systemQtyRack,
                  },
                });

                await this.logService.addLog({
                  processId: localProcessId,
                  message: `MATERIAL ${detail.MaterialId} [${detail.Location}]: SystemQty=${systemQty}, SystemQtyRack=${systemQtyRack}`,
                  type: 'INFO',
                  location: 'inventory-counting.service.ts:722',
                });
              }
            } else if (detail.FinishGoodId) {
              const fg = await tx.finishGood.findUnique({
                where: { PartNumber: detail.FinishGoodId },
                select: { Qty: true },
              });

              if (fg) {
                await tx.stockOpnameDetail.update({
                  where: { Id: detail.Id },
                  data: {
                    SystemQty: fg.Qty,
                  },
                });

                await this.logService.addLog({
                  processId: localProcessId,
                  message: `FINISHGOOD ${detail.FinishGoodId}: SystemQty=${fg.Qty}`,
                  type: 'INFO',
                  location: 'inventory-counting.service.ts:740',
                });
              }
            }
          }

          const started = await tx.stockOpname.updateMany({
            where: {
              Id: dto.inventoryCountingId,
              Status: OpnameStatus.DRAFT,
            },
            data: {
              Status: OpnameStatus.IN_PROGRESS,
              StartedAt: new Date(),
            },
          });
          if (started.count !== 1) {
            throw new BadRequestException(
              'Inventory counting has already been started or changed concurrently.',
            );
          }
        },
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Cut-off generated successfully: ${cutOffEntries.length} entries`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:754',
      });

      await this.logService.completeProcess(
        logProcess.ProcessId,
        'SUCCESS',
        `Generated ${cutOffEntries.length} cut-off entries`,
      );

      return {
        success: true,
        processId: logProcess.ProcessId,
        data: {
          inventoryCountingId: dto.inventoryCountingId,
          count: cutOffEntries.length,
          locations: locations,
        },
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:620',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async updateActualStock(
    id: string,
    detailId: number,
    dto: UpdateActualStockDto,
    updatedBy: string,
  ) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INV_COUNT_007',
        functionName: 'InventoryCountingService.updateActualStock',
        createdBy: updatedBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating actual stock: OpnameId=${id}, DetailId=${detailId}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:644',
      });

      // STEP 1: Validate StockOpnameDetail exists
      const detail = await this.prisma.stockOpnameDetail.findUnique({
        where: { Id: detailId },
        include: {
          OpnameData: true,
        },
      });

      if (!detail) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `StockOpnameDetail not found: ${detailId}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:658',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new NotFoundException(
          `StockOpnameDetail with ID ${detailId} not found`,
        );
      }

      if (detail.OpnameId !== id) {
        throw new NotFoundException(
          `StockOpnameDetail with ID ${detailId} was not found for inventory counting ${id}`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Found detail: MaterialId=${detail.MaterialId}, FinishGoodId=${detail.FinishGoodId}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:666',
      });

      // STEP 2: Validate parent StockOpname status
      if (detail.OpnameData.Status !== OpnameStatus.IN_PROGRESS) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Cannot update actual stock because parent status is ${detail.OpnameData.Status}. Must be IN_PROGRESS.`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:674',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `Cannot update actual stock because inventory counting status is ${detail.OpnameData.Status}`,
        );
      }

      // STEP 3: Calculate diffs
      // For MATERIAL with actualQtyRack: DiffQtyRack = actualQtyRack - SystemQtyRack
      // For all others: DiffQty = actualQty - SystemQty
      const diffQty = dto.actualQty - detail.SystemQty;
      const diffQtyRack =
        dto.actualQtyRack !== undefined && dto.actualQtyRack !== null
          ? dto.actualQtyRack - (detail.SystemQtyRack ?? 0)
          : undefined;

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message:
          `Calculating diff: ActualQty=${dto.actualQty} - SystemQty=${detail.SystemQty} = DiffQty=${diffQty}` +
          (diffQtyRack !== undefined
            ? `; ActualQtyRack=${dto.actualQtyRack} - SystemQtyRack=${detail.SystemQtyRack ?? 0} = DiffQtyRack=${diffQtyRack}`
            : ''),
        type: 'INFO',
        location: 'inventory-counting.service.ts:686',
      });

      // STEP 4: Update the detail
      const updateData: any = {
        ActualQty: dto.actualQty,
        DiffQty: diffQty,
        Notes: dto.notes || detail.Notes,
      };
      if (diffQtyRack !== undefined) {
        updateData.ActualQtyRack = dto.actualQtyRack;
        updateData.DiffQtyRack = diffQtyRack;
      }

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.stockOpnameDetail.update({
          where: { Id: detailId },
          data: updateData,
        }),
      );

      // Synchronize paired row for MATERIAL so that both locations are updated
      if (detail.MaterialId) {
        if (
          detail.Location === LocationType.WAREHOUSE &&
          dto.actualQtyRack !== undefined &&
          dto.actualQtyRack !== null
        ) {
          const rackDetail = await this.prisma.stockOpnameDetail.findFirst({
            where: {
              OpnameId: detail.OpnameId,
              MaterialId: detail.MaterialId,
              Location: LocationType.RACK,
            },
          });
          if (rackDetail) {
            await auditedWrite(this.prisma, (tx) =>
              tx.stockOpnameDetail.update({
                where: { Id: rackDetail.Id },
                data: {
                  ActualQty: dto.actualQtyRack,
                  ActualQtyRack: dto.actualQtyRack,
                  DiffQtyRack:
                    (dto.actualQtyRack ?? 0) - (rackDetail.SystemQtyRack ?? 0),
                  DiffQty:
                    (dto.actualQtyRack ?? 0) - (rackDetail.SystemQty ?? 0),
                },
              }),
            );
          }
        } else if (
          detail.Location === LocationType.RACK &&
          dto.actualQty !== undefined &&
          dto.actualQty !== null
        ) {
          const warehouseDetail = await this.prisma.stockOpnameDetail.findFirst(
            {
              where: {
                OpnameId: detail.OpnameId,
                MaterialId: detail.MaterialId,
                Location: LocationType.WAREHOUSE,
              },
            },
          );
          if (warehouseDetail) {
            await auditedWrite(this.prisma, (tx) =>
              tx.stockOpnameDetail.update({
                where: { Id: warehouseDetail.Id },
                data: {
                  ActualQty: dto.actualQty,
                  DiffQty: dto.actualQty - (warehouseDetail.SystemQty ?? 0),
                },
              }),
            );
          }
        }
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message:
          `Actual stock updated: ActualQty=${result.ActualQty}, DiffQty=${result.DiffQty}` +
          (result.ActualQtyRack !== null
            ? `, ActualQtyRack=${result.ActualQtyRack}, DiffQtyRack=${result.DiffQtyRack}`
            : ''),
        type: 'INFO',
        location: 'inventory-counting.service.ts:714',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return {
        success: true,
        processId: logProcess.ProcessId,
        data: result,
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:716',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async close(dtoOrId: string | CloseInventoryCountingDto, closedBy: string) {
    const id = typeof dtoOrId === 'string' ? dtoOrId : dtoOrId.id;
    const confirmedCheck =
      typeof dtoOrId === 'string' ? true : dtoOrId.confirmedCheck;
    const notes = typeof dtoOrId === 'string' ? undefined : dtoOrId.notes;

    if (!confirmedCheck) {
      throw new BadRequestException(
        'Approval denied: Approver must inspect and confirm the physical counting results and stock discrepancies before approving and closing the session.',
      );
    }

    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INV_COUNT_008',
        functionName: 'InventoryCountingService.close',
        createdBy: closedBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Closing inventory counting with approval: ID=${id}, Approver=${closedBy}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:736',
      });

      // STEP 1: Fetch and validate StockOpname with details
      const inventoryCounting = await this.prisma.stockOpname.findUnique({
        where: { Id: id },
        include: {
          Details: true,
        },
      });

      if (!inventoryCounting) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Inventory counting not found: ${id}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:750',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new NotFoundException(
          `Inventory counting with ID ${id} not found`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Found inventory counting: ${inventoryCounting.OpnameNumber}, Status=${inventoryCounting.Status}, Details=${inventoryCounting.Details.length}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:758',
      });

      // STEP 2: Validate status is IN_PROGRESS
      if (inventoryCounting.Status !== OpnameStatus.IN_PROGRESS) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Cannot close inventory counting with status ${inventoryCounting.Status}. Must be IN_PROGRESS.`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:766',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `Cannot close inventory counting with status ${inventoryCounting.Status}. Must be IN_PROGRESS.`,
        );
      }

      // STEP 3: Check if all items have ActualQty filled
      // For MATERIAL with Location=RACK, also require ActualQtyRack
      const incompleteItems = inventoryCounting.Details.filter((d) => {
        if (d.ActualQty === null) return true;
        if (
          inventoryCounting.Category === ItemCategory.MATERIAL &&
          d.Location === LocationType.RACK &&
          d.ActualQtyRack === null
        ) {
          return true;
        }
        return false;
      });

      if (incompleteItems.length > 0) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Cannot close: ${incompleteItems.length} items have incomplete actual quantities`,
          type: 'WARN',
          location: 'inventory-counting.service.ts:785',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
        throw new BadRequestException(
          `Cannot close inventory counting. ${incompleteItems.length} items still have incomplete actual quantities. Please fill all actual quantities before closing.`,
        );
      }

      // STEP 4: Update stock to actual values and create ledger entries
      // - MATERIAL WAREHOUSE: QtyWarehouse = ActualQty
      // - MATERIAL RACK: QtyRack = ActualQtyRack
      // - FINISH_GOOD: Qty = ActualQty
      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: 'Applying stock adjustments (setting stock to actual values)',
        type: 'INFO',
        location: 'inventory-counting.service.ts:800',
      });

      const localProcessId = logProcess.ProcessId;

      await withInventoryTransaction(
        this.prisma,
        inventoryCounting.Category,
        async (tx) => {
          const currentCounting = await tx.stockOpname.findUnique({
            where: { Id: id },
            include: { Details: true },
          });
          if (!currentCounting) {
            throw new NotFoundException(
              `Inventory counting with ID ${id} not found`,
            );
          }
          if (currentCounting.Status !== OpnameStatus.IN_PROGRESS) {
            throw new BadRequestException(
              `Cannot close inventory counting with status ${currentCounting.Status}. Must be IN_PROGRESS.`,
            );
          }
          const currentIncomplete = currentCounting.Details.filter(
            (detail) =>
              detail.ActualQty === null ||
              (currentCounting.Category === ItemCategory.MATERIAL &&
                detail.Location === LocationType.RACK &&
                detail.ActualQtyRack === null),
          );
          if (currentIncomplete.length > 0) {
            throw new BadRequestException(
              `Cannot close inventory counting. ${currentIncomplete.length} items still have incomplete actual quantities.`,
            );
          }
          let adjustedCount = 0;
          const ledgerEntries: Array<{
            Id: string;
            TransactionDate: Date;
            ItemCategory: ItemCategory;
            MaterialId: string | null;
            FinishGoodId: string | null;
            Location: LocationType;
            TransactionType: { create: any };
            ReferenceDoc: string;
            BalanceBefore: number;
            QtyIn: number;
            QtyOut: number;
            BalanceAfter: number;
            CreatedBy: string;
            Notes: string | null;
          }> = [];

          for (const detail of currentCounting.Details) {
            // Calculate diffs for logging
            const diffQty =
              detail.ActualQty !== null
                ? detail.ActualQty - detail.SystemQty
                : 0;
            const diffQtyRack =
              detail.ActualQtyRack !== null && detail.SystemQtyRack !== null
                ? detail.ActualQtyRack - detail.SystemQtyRack
                : null;

            // Update diffs in detail record
            const detailUpdate: any = { DiffQty: diffQty };
            if (diffQtyRack !== null) {
              detailUpdate.DiffQtyRack = diffQtyRack;
            }

            await tx.stockOpnameDetail.update({
              where: { Id: detail.Id },
              data: detailUpdate,
            });

            if (detail.MaterialId) {
              // MATERIAL: set stock to actual based on Location
              // - WAREHOUSE: QtyWarehouse = ActualQty
              // - RACK: QtyRack = ActualQtyRack
              const material = await tx.material.findUnique({
                where: { PartNumber: detail.MaterialId },
              });

              if (material) {
                const isRack = detail.Location === LocationType.RACK;
                let newQty: number;
                let currentQty: number;

                if (isRack) {
                  // RACK location: set QtyRack = ActualQtyRack
                  currentQty = material.QtyRack ?? 0;
                  newQty = Math.max(0, detail.ActualQtyRack ?? 0);

                  await tx.material.update({
                    where: { PartNumber: detail.MaterialId },
                    data: { QtyRack: newQty, UpdatedBy: closedBy },
                  });
                } else {
                  // WAREHOUSE location: set QtyWarehouse = ActualQty
                  currentQty = material.QtyWarehouse ?? 0;
                  newQty = Math.max(0, detail.ActualQty ?? 0);

                  await tx.material.update({
                    where: { PartNumber: detail.MaterialId },
                    data: { QtyWarehouse: newQty, UpdatedBy: closedBy },
                  });
                }

                // Create ledger entry for adjustment
                const actualDiff = newQty - currentQty;
                const ledgerEntry = {
                  Id: crypto.randomUUID(),
                  TransactionDate: new Date(),
                  ItemCategory: ItemCategory.MATERIAL,
                  MaterialId: detail.MaterialId,
                  FinishGoodId: null,
                  Location: detail.Location,
                  TransactionType: { create: { create: {} } } as any,
                  ReferenceDoc: inventoryCounting.OpnameNumber,
                  BalanceBefore: currentQty,
                  QtyIn: actualDiff > 0 ? actualDiff : 0,
                  QtyOut: actualDiff < 0 ? Math.abs(actualDiff) : 0,
                  BalanceAfter: newQty,
                  CreatedBy: closedBy,
                  Notes: `Stock Opname ${inventoryCounting.OpnameNumber} - ${isRack ? 'RACK' : 'WAREHOUSE'}`,
                };
                ledgerEntries.push(ledgerEntry);

                if (actualDiff !== 0) adjustedCount++;

                await this.logService.addLog({
                  processId: localProcessId,
                  message: `MATERIAL ${detail.MaterialId} [${detail.Location}]: ${currentQty} -> ${newQty} (diff=${actualDiff})`,
                  type: 'INFO',
                  location: 'inventory-counting.service.ts:870',
                });
              }
            } else if (detail.FinishGoodId) {
              // FINISH_GOOD: set Qty = ActualQty
              const fg = await tx.finishGood.findUnique({
                where: { PartNumber: detail.FinishGoodId },
              });

              if (fg) {
                const currentQty = fg.Qty ?? 0;
                const newQty = Math.max(0, detail.ActualQty ?? 0);

                await tx.finishGood.update({
                  where: { PartNumber: detail.FinishGoodId },
                  data: { Qty: newQty, UpdatedBy: closedBy },
                });

                // Create ledger entry
                const actualDiff = newQty - currentQty;
                const ledgerEntry = {
                  Id: crypto.randomUUID(),
                  TransactionDate: new Date(),
                  ItemCategory: ItemCategory.FINISH_GOOD,
                  MaterialId: null,
                  FinishGoodId: detail.FinishGoodId,
                  Location: detail.Location,
                  TransactionType: { create: { create: {} } } as any,
                  ReferenceDoc: inventoryCounting.OpnameNumber,
                  BalanceBefore: currentQty,
                  QtyIn: actualDiff > 0 ? actualDiff : 0,
                  QtyOut: actualDiff < 0 ? Math.abs(actualDiff) : 0,
                  BalanceAfter: newQty,
                  CreatedBy: closedBy,
                  Notes: `Stock Opname ${inventoryCounting.OpnameNumber}`,
                };
                ledgerEntries.push(ledgerEntry);

                if (actualDiff !== 0) adjustedCount++;

                await this.logService.addLog({
                  processId: localProcessId,
                  message: `FINISHGOOD ${detail.FinishGoodId}: ${currentQty} -> ${newQty} (diff=${actualDiff})`,
                  type: 'INFO',
                  location: 'inventory-counting.service.ts:910',
                });
              }
            }
          }

          // Batch insert ledger entries
          if (ledgerEntries.length > 0) {
            // Build clean ledger data without the TransactionType relation field
            const cleanLedgerData = ledgerEntries.map((e) => ({
              Id: e.Id,
              TransactionDate: e.TransactionDate,
              ItemCategory: e.ItemCategory,
              MaterialId: e.MaterialId,
              FinishGoodId: e.FinishGoodId,
              Location: e.Location,
              TransactionType: 'STOCK_OPNAME_DIFF' as const,
              ReferenceDoc: e.ReferenceDoc,
              BalanceBefore: e.BalanceBefore,
              QtyIn: e.QtyIn,
              QtyOut: e.QtyOut,
              BalanceAfter: e.BalanceAfter,
              CreatedBy: e.CreatedBy,
              Notes: e.Notes,
            }));

            await tx.inventoryLedger.createMany({ data: cleanLedgerData });

            await this.logService.addLog({
              processId: localProcessId,
              message: `Created ${cleanLedgerData.length} InventoryLedger entries`,
              type: 'INFO',
              location: 'inventory-counting.service.ts:952',
            });
          }

          await this.logService.addLog({
            processId: localProcessId,
            message: `Stock adjustments completed: ${adjustedCount} items adjusted`,
            type: 'INFO',
            location: 'inventory-counting.service.ts:958',
          });

          // STEP 5: Update status to COMPLETED
          const approvalNotes = notes?.trim()
            ? inventoryCounting.Notes
              ? `${inventoryCounting.Notes} | [APPROVED by ${closedBy}]: ${notes.trim()}`
              : `[APPROVED by ${closedBy}]: ${notes.trim()}`
            : inventoryCounting.Notes;

          const completed = await tx.stockOpname.updateMany({
            where: { Id: id, Status: OpnameStatus.IN_PROGRESS },
            data: {
              Status: OpnameStatus.COMPLETED,
              CompletedAt: new Date(),
              CompletedBy: closedBy,
              Notes: approvalNotes,
            },
          });
          if (completed.count !== 1) {
            throw new BadRequestException(
              'Inventory counting has already been closed or changed concurrently.',
            );
          }

          await this.logService.addLog({
            processId: localProcessId,
            message: 'Inventory counting status updated to COMPLETED',
            type: 'INFO',
            location: 'inventory-counting.service.ts:970',
          });
        },
      );

      await this.logService.completeProcess(
        logProcess.ProcessId,
        'SUCCESS',
        'Inventory counting closed successfully',
      );

      return {
        success: true,
        processId: logProcess.ProcessId,
        data: await this.findOne(id),
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:884',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async cancel(id: string, cancelledBy: string) {
    const inventoryCounting = await this.prisma.stockOpname.findUnique({
      where: { Id: id },
    });
    if (!inventoryCounting) {
      throw new NotFoundException(`Inventory counting with ID ${id} not found`);
    }
    if (
      inventoryCounting.Status !== OpnameStatus.DRAFT &&
      inventoryCounting.Status !== OpnameStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        `Cannot cancel inventory counting with status ${inventoryCounting.Status}`,
      );
    }

    await withInventoryTransaction(
      this.prisma,
      inventoryCounting.Category,
      async (tx) => {
        const cancelled = await tx.stockOpname.updateMany({
          where: {
            Id: id,
            Status: { in: [OpnameStatus.DRAFT, OpnameStatus.IN_PROGRESS] },
          },
          data: {
            Status: OpnameStatus.CANCELLED,
            CompletedAt: new Date(),
            CompletedBy: cancelledBy,
          },
        });
        if (cancelled.count !== 1) {
          throw new BadRequestException(
            'Inventory counting has already been cancelled or changed concurrently.',
          );
        }
      },
    );

    return {
      success: true,
      data: await this.findOne(id),
    };
  }

  async getDetails(opnameId: string) {
    const logProcess = await this.logService.startProcess({
      functionId: 'INV_COUNT_009',
      functionName: 'InventoryCountingService.getDetails',
    });

    await this.logService.addLog({
      processId: logProcess.ProcessId,
      message: `Getting details for inventory counting: ID=${opnameId}`,
      type: 'INFO',
      location: 'inventory-counting.service.ts:900',
    });

    const details = await this.prisma.stockOpnameDetail.findMany({
      where: { OpnameId: opnameId },
      orderBy: { Id: 'asc' },
    });

    await this.logService.addLog({
      processId: logProcess.ProcessId,
      message: `Found ${details.length} details`,
      type: 'INFO',
      location: 'inventory-counting.service.ts:910',
    });

    await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

    return details.map((d) => ({
      Id: d.Id,
      OpnameId: d.OpnameId,
      MaterialId: d.MaterialId,
      FinishGoodId: d.FinishGoodId,
      Location: d.Location,
      SystemQty: d.SystemQty,
      SystemQtyRack: d.SystemQtyRack,
      ActualQty: d.ActualQty,
      ActualQtyRack: d.ActualQtyRack,
      DiffQty: d.DiffQty,
      DiffQtyRack: d.DiffQtyRack,
      Notes: d.Notes,
    }));
  }

  /**
   * Generate Worksheet Excel file for inventory counting
   * Contains items grouped by category/location with columns for manual entry
   */
  async generateWorksheet(id: string): Promise<Buffer> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INV_COUNT_010',
        functionName: 'InventoryCountingService.generateWorksheet',
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Generating Worksheet for inventory counting: ID=${id}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:1090',
      });

      const inventoryCounting = await this.findOne(id);
      const details = await this.prisma.stockOpnameDetail.findMany({
        where: { OpnameId: id },
        orderBy: [
          { Location: 'asc' },
          { MaterialId: 'asc' },
          { FinishGoodId: 'asc' },
        ],
      });

      // Group items by Location
      const itemsByLocation = new Map<string, typeof details>();
      details.forEach((item) => {
        const location = item.Location || 'UNKNOWN';
        if (!itemsByLocation.has(location)) {
          itemsByLocation.set(location, []);
        }
        itemsByLocation.get(location)!.push(item);
      });

      const workbook = new Workbook();
      const dateStr = dayjs().format('DD-MM-YYYY HH:mm');
      const code = inventoryCounting.OpnameNumber;

      // Sort locations
      const sortedLocations = Array.from(itemsByLocation.keys()).sort();

      for (const locationKey of sortedLocations) {
        const items = itemsByLocation.get(locationKey)!;

        // Safe sheet name (max 31 chars, no special chars)
        const safeSheetName = (
          locationKey.replace(/[:\\/?*[\]]/g, ' ') || 'No Location'
        )
          .substring(0, 31)
          .trim();

        // Handle duplicate sheet names
        let sheetName = safeSheetName;
        let counter = 1;
        while (workbook.getWorksheet(sheetName)) {
          sheetName = `${safeSheetName.substring(0, 28)}_${counter}`;
          counter++;
        }

        const worksheet = workbook.addWorksheet(sheetName);

        const subStartRow = 10;
        const headerRowIdx = subStartRow + 8; // Row 18: Table Headers

        // Page Setup A4 Portrait
        worksheet.pageSetup = {
          paperSize: 9,
          orientation: 'portrait',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          printTitlesRow: `1:${headerRowIdx}`,
        };
        worksheet.views = [{ showGridLines: false }];

        // Watermark
        const watermark = worksheet.getCell('A1');
        watermark.value = 'This document autogenerated by IPC System';
        watermark.font = { size: 8, italic: true, color: { argb: 'FF808080' } };

        // Signature Boxes (Top Right) - Row 1
        // Columns F, G, H, I for Checked, Counted, PIC Input, PIC Check
        worksheet.getCell('F1').value = 'Checked';
        worksheet.getCell('G1').value = 'Counted';
        worksheet.getCell('H1').value = 'PIC Input';
        worksheet.getCell('I1').value = 'PIC Check';

        ['F1', 'G1', 'H1', 'I1'].forEach((cellRef) => {
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

        // Empty space for signatures - Rows 2-4
        ['F2', 'G2', 'H2', 'I2'].forEach((cellRef) => {
          const cell = worksheet.getCell(cellRef);
          cell.border = { left: { style: 'thin' }, right: { style: 'thin' } };
          worksheet.mergeCells(`${cellRef.charAt(0)}2:${cellRef.charAt(0)}3`);
        });
        ['F4', 'G4', 'H4', 'I4'].forEach((cellRef) => {
          const cell = worksheet.getCell(cellRef);
          cell.border = {
            left: { style: 'thin' },
            right: { style: 'thin' },
            bottom: { style: 'thin' },
          };
        });

        // Header Info - Row 6
        worksheet.getCell('A6').value = 'Inventory Code';
        worksheet.getCell('C6').value = `: ${code}`;
        worksheet.getCell('F6').value = 'Date';
        worksheet.getCell('G6').value = `: ${dateStr}`;

        worksheet.getCell('F7').value = 'User ID';
        worksheet.getCell('G7').value = ': SYSTEM';

        // Title Box - Row 8
        worksheet.mergeCells('A8:I8');
        const titleCell = worksheet.getCell('A8');
        titleCell.value = 'INVENTORY COUNTING WORKSHEET DATA';
        titleCell.style = {
          font: { bold: true, size: 14 },
          alignment: { horizontal: 'center' },
        };
        ['A8', 'B8', 'C8', 'D8', 'E8', 'F8', 'G8', 'H8', 'I8'].forEach(
          (cellRef) => {
            const cell = worksheet.getCell(cellRef);
            cell.border = {
              top: { style: 'medium' },
              bottom: { style: 'medium' },
              left: { style: 'medium' },
              right: { style: 'medium' },
            };
          },
        );

        // Sub-header details - Row 10
        worksheet.getCell(`A${subStartRow}`).value = 'W/S Code';
        worksheet.getCell(`C${subStartRow}`).value = `: WS_${code}`;
        worksheet.getCell(`A${subStartRow + 1}`).value = 'Location';
        worksheet.getCell(`C${subStartRow + 1}`).value = `: ${locationKey}`;
        worksheet.getCell(`A${subStartRow + 2}`).value = 'Category';
        worksheet.getCell(`C${subStartRow + 2}`).value =
          `: ${inventoryCounting.Category}`;

        // NO Box - Columns H, I - Rows 10-11
        worksheet.mergeCells(`H${subStartRow}:I${subStartRow + 1}`);
        const noBox = worksheet.getCell(`H${subStartRow}`);
        const sheetNumber = sortedLocations.indexOf(locationKey) + 1;
        noBox.value = `NO : ${sheetNumber}`;
        noBox.style = {
          font: { bold: true, size: 20 },
          alignment: { horizontal: 'center', vertical: 'middle' },
        };
        [
          `H${subStartRow}`,
          `I${subStartRow}`,
          `H${subStartRow + 1}`,
          `I${subStartRow + 1}`,
        ].forEach((cellRef) => {
          worksheet.getCell(cellRef).border = {
            top: { style: 'medium' },
            bottom: { style: 'medium' },
            left: { style: 'medium' },
            right: { style: 'medium' },
          };
        });

        // Time Format Box - Below NO Box - Row 13
        worksheet.mergeCells(`H${subStartRow + 3}:I${subStartRow + 3}`);
        const timeFormatText = worksheet.getCell(`H${subStartRow + 3}`);
        timeFormatText.value = 'Format waktu 24 jam (00:00 - 23:59)';
        timeFormatText.font = { size: 8 };
        timeFormatText.alignment = { horizontal: 'center' };
        timeFormatText.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
          bottom: { style: 'thin' },
        };

        // Start/End Time Boxes - Rows 14
        worksheet.getCell(`H${subStartRow + 4}`).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
          bottom: { style: 'thin' },
        };
        worksheet.getCell(`I${subStartRow + 4}`).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
          bottom: { style: 'thin' },
        };
        // Labels below - Row 15
        worksheet.getCell(`H${subStartRow + 5}`).value = 'Jam Mulai';
        worksheet.getCell(`I${subStartRow + 5}`).value = 'Jam Selesai';
        worksheet.getCell(`H${subStartRow + 5}`).font = { bold: true };
        worksheet.getCell(`I${subStartRow + 5}`).font = { bold: true };
        worksheet.getCell(`H${subStartRow + 5}`).alignment = {
          horizontal: 'center',
        };
        worksheet.getCell(`I${subStartRow + 5}`).alignment = {
          horizontal: 'center',
        };

        // Table Headers - Row 18 (subStartRow + 8)
        // Determine if MATERIAL category
        const isMaterial = inventoryCounting.Category === ItemCategory.MATERIAL;

        // Determine headers based on location for MATERIAL, same for FINISH_GOOD
        // WAREHOUSE sheet: System Qty (WH), Box, Pieces, Actual Qty (WH)
        // RACK sheet: Rack System Qty, Box, Pieces, Rack Actual Qty
        // FINISH_GOOD: System Qty, Box, Pieces, Actual Qty
        const isRack = locationKey === LocationType.RACK;
        const isWarehouse = locationKey === LocationType.WAREHOUSE;

        const headers =
          isMaterial && isWarehouse
            ? [
                'No',
                'Part Number',
                'Part Name',
                'Location',
                'System Qty (WH)',
                'Box (Full)',
                'Pieces',
                'Actual Qty (WH)',
                'CHECK',
              ]
            : isMaterial && isRack
              ? [
                  'No',
                  'Part Number',
                  'Part Name',
                  'Location',
                  'Rack System Qty',
                  'Box (Full)',
                  'Pieces',
                  'Rack Actual Qty',
                  'CHECK',
                ]
              : [
                  'No',
                  'Part Number',
                  'Part Name',
                  'Location',
                  'System Qty',
                  'Box (Full)',
                  'Pieces',
                  'Actual Qty',
                  'CHECK',
                ];

        const headerRow = worksheet.getRow(headerRowIdx);
        headerRow.values = headers;
        headerRow.height = 40;

        headerRow.eachCell((cell) => {
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
        });

        // Column Widths - vary based on location for MATERIAL, same for FINISH_GOOD
        worksheet.columns =
          isMaterial && isWarehouse
            ? [
                { key: 'no', width: 5 },
                { key: 'partNumber', width: 18 },
                { key: 'partName', width: 25 },
                { key: 'location', width: 12 },
                { key: 'systemQty', width: 12 },
                { key: 'palletFull', width: 10 },
                { key: 'pieces', width: 10 },
                { key: 'actualQty', width: 12 },
                { key: 'check', width: 10 },
              ]
            : isMaterial && isRack
              ? [
                  { key: 'no', width: 5 },
                  { key: 'partNumber', width: 18 },
                  { key: 'partName', width: 25 },
                  { key: 'location', width: 12 },
                  { key: 'rackSystemQty', width: 12 },
                  { key: 'palletFull', width: 10 },
                  { key: 'pieces', width: 10 },
                  { key: 'rackActualQty', width: 12 },
                  { key: 'check', width: 10 },
                ]
              : [
                  { key: 'no', width: 5 },
                  { key: 'partNumber', width: 18 },
                  { key: 'partName', width: 25 },
                  { key: 'location', width: 12 },
                  { key: 'systemQty', width: 12 },
                  { key: 'palletFull', width: 12 },
                  { key: 'pieces', width: 12 },
                  { key: 'actualQty', width: 12 },
                  { key: 'check', width: 12 },
                ];

        // Pre-fetch item names for all items in this location
        const materialIds = items
          .filter((i) => i.MaterialId)
          .map((i) => i.MaterialId!);
        const finishGoodIds = items
          .filter((i) => i.FinishGoodId)
          .map((i) => i.FinishGoodId!);

        const materials = await this.prisma.material.findMany({
          where: { PartNumber: { in: materialIds } },
          select: { PartNumber: true, PartName: true },
        });
        const finishGoods = await this.prisma.finishGood.findMany({
          where: { PartNumber: { in: finishGoodIds } },
          select: { PartNumber: true, PartName: true },
        });

        const nameMap = new Map<string, string>();
        materials.forEach((m) => nameMap.set(m.PartNumber, m.PartName));
        finishGoods.forEach((fg) => nameMap.set(fg.PartNumber, fg.PartName));

        // Data Rows
        items.forEach((item, index) => {
          const itemName =
            nameMap.get(item.MaterialId || item.FinishGoodId || '') || '';

          // For MATERIAL: populate columns based on location
          // For FINISH_GOOD: simple columns
          const rowData =
            isMaterial && isWarehouse
              ? {
                  no: index + 1,
                  partNumber: item.MaterialId || item.FinishGoodId || '',
                  partName: itemName,
                  location: item.Location,
                  systemQty: item.SystemQty,
                  palletFull: '',
                  pieces: '',
                  actualQty: item.ActualQty ?? '',
                  check: '',
                }
              : isMaterial && isRack
                ? {
                    no: index + 1,
                    partNumber: item.MaterialId || item.FinishGoodId || '',
                    partName: itemName,
                    location: item.Location,
                    rackSystemQty: item.SystemQtyRack,
                    palletFull: '',
                    pieces: '',
                    rackActualQty: item.ActualQtyRack ?? '',
                    check: '',
                  }
                : {
                    no: index + 1,
                    partNumber: item.MaterialId || item.FinishGoodId || '',
                    partName: itemName,
                    location: item.Location,
                    systemQty: item.SystemQty,
                    palletFull: '',
                    pieces: '',
                    actualQty: item.ActualQty ?? '',
                    check: '',
                  };

          const row = worksheet.addRow(rowData);

          row.eachCell((cell, colNumber) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };

            const isPartName = colNumber === 3;
            cell.alignment = {
              vertical: 'middle',
              horizontal: isPartName ? 'left' : 'center',
              wrapText: isPartName,
            };

            if (colNumber === 2) cell.font = { bold: true };

            if (isMaterial && isWarehouse) {
              // WAREHOUSE: col 8 = Actual Qty (WH), col 9 = CHECK
              if (colNumber === 8 && item.ActualQty === null) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFF2CC' },
                };
              }
              if (colNumber === 9) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFD3D3D3' },
                };
              }
            } else if (isMaterial && isRack) {
              // RACK: col 8 = Rack Actual Qty, col 9 = CHECK
              if (colNumber === 8 && item.ActualQtyRack === null) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFF2CC' },
                };
              }
              if (colNumber === 9) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFD3D3D3' },
                };
              }
            } else {
              // FINISH_GOOD: col 8 = Actual Qty, col 9 = CHECK
              if (colNumber === 8 && item.ActualQty === null) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFF2CC' },
                };
              }
              if (colNumber === 9) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFD3D3D3' },
                };
              }
            }
          });

          row.height = 55;
        });
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Worksheet generated with ${details.length} items`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:1340',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:1350',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Generate Snapshot Excel file for inventory counting
   * Contains items with SystemQty, ActualQty, and Diff for reporting
   */
  async generateSnapshot(id: string): Promise<Buffer> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'INV_COUNT_011',
        functionName: 'InventoryCountingService.generateSnapshot',
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Generating Snapshot for inventory counting: ID=${id}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:1365',
      });

      const inventoryCounting = await this.findOne(id);
      const details = await this.prisma.stockOpnameDetail.findMany({
        where: { OpnameId: id },
        orderBy: [
          { Location: 'asc' },
          { MaterialId: 'asc' },
          { FinishGoodId: 'asc' },
        ],
      });

      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Snapshot');

      const subStartRow = 9;
      const headerRowIdx = subStartRow + 5; // Row 14: Table Headers

      // Page Setup
      worksheet.pageSetup = {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: `1:${headerRowIdx}`,
      };
      worksheet.views = [{ showGridLines: false }];

      const dateStr = dayjs().format('DD-MM-YYYY HH:mm');
      const code = inventoryCounting.OpnameNumber;

      // Watermark
      const watermark = worksheet.getCell('A1');
      watermark.value = 'This document autogenerated by IPC System';
      watermark.font = { size: 8, italic: true, color: { argb: 'FF808080' } };

      // Header Info
      worksheet.getCell('A5').value = 'Inventory Code';
      worksheet.getCell('C5').value = `: ${code}`;
      worksheet.getCell('G5').value = 'Date';
      worksheet.getCell('H5').value = `: ${dateStr}`;

      worksheet.getCell('G6').value = 'User ID';
      worksheet.getCell('H6').value = ': SYSTEM';

      // Title
      worksheet.mergeCells('A7:I7');
      const titleCell = worksheet.getCell('A7');
      titleCell.value = 'INVENTORY SNAPSHOT';
      titleCell.style = {
        font: { bold: true, size: 14 },
        alignment: { horizontal: 'center' },
      };
      ['A7', 'B7', 'C7', 'D7', 'E7', 'F7', 'G7', 'H7', 'I7'].forEach(
        (cellRef) => {
          const cell = worksheet.getCell(cellRef);
          cell.border = {
            top: { style: 'medium' },
            bottom: { style: 'medium' },
            left: { style: 'medium' },
            right: { style: 'medium' },
          };
        },
      );

      // Sub-header
      worksheet.getCell(`A${subStartRow}`).value = 'Snapshot Code';
      worksheet.getCell(`C${subStartRow}`).value = `: SN_${code}`;
      worksheet.getCell(`A${subStartRow + 1}`).value = 'Category';
      worksheet.getCell(`C${subStartRow + 1}`).value =
        `: ${inventoryCounting.Category}`;
      worksheet.getCell(`A${subStartRow + 2}`).value = 'Status';
      worksheet.getCell(`C${subStartRow + 2}`).value =
        `: ${inventoryCounting.Status}`;

      // Note Box
      worksheet.mergeCells(`E${subStartRow}:G${subStartRow + 2}`);
      const noteCell = worksheet.getCell(`E${subStartRow}`);
      noteCell.value =
        'NOTE: System Qty is the stock at snapshot time. Actual Qty is the result of manual counting. Diff = Actual - System.';
      noteCell.style = {
        alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
        font: { italic: true, size: 9 },
      };
      for (let row = subStartRow; row <= subStartRow + 2; row++) {
        ['E', 'F', 'G'].forEach((col) => {
          const cell = worksheet.getCell(`${col}${row}`);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      }

      // Determine if MATERIAL category (needs dual-location columns)
      const isMaterial = inventoryCounting.Category === ItemCategory.MATERIAL;

      // Table Headers - vary by category
      // MATERIAL: No, Part Number, Part Name, WH System, WH Actual, WH Diff, Rack System, Rack Actual, Rack Diff (9 cols)
      // FINISH_GOOD: No, Part Number, Part Name, Location, System Qty, Actual Qty, Diff (7 cols)
      const headers = isMaterial
        ? [
            'No',
            'Part Number',
            'Part Name',
            'WH Sys Qty',
            'WH Actual',
            'WH Diff',
            'Rack Sys Qty',
            'Rack Actual',
            'Rack Diff',
          ]
        : [
            'No',
            'Part Number',
            'Part Name',
            'Location',
            'System Qty',
            'Actual Qty',
            'Diff',
          ];

      const headerRow = worksheet.getRow(headerRowIdx);
      headerRow.values = headers;
      headerRow.height = 35;

      headerRow.eachCell((cell) => {
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
      });

      // Column Widths - vary by category
      worksheet.columns = isMaterial
        ? [
            { key: 'no', width: 5 },
            { key: 'partNumber', width: 16 },
            { key: 'partName', width: 22 },
            { key: 'whSystemQty', width: 10 },
            { key: 'whActualQty', width: 10 },
            { key: 'whDiff', width: 9 },
            { key: 'rackSystemQty', width: 11 },
            { key: 'rackActualQty', width: 11 },
            { key: 'rackDiff', width: 9 },
          ]
        : [
            { key: 'no', width: 5 },
            { key: 'partNumber', width: 16 },
            { key: 'partName', width: 22 },
            { key: 'location', width: 12 },
            { key: 'systemQty', width: 11 },
            { key: 'actualQty', width: 11 },
            { key: 'diff', width: 10 },
          ];

      // Pre-fetch item names for all items
      const materialIds = details
        .filter((i) => i.MaterialId)
        .map((i) => i.MaterialId!);
      const finishGoodIds = details
        .filter((i) => i.FinishGoodId)
        .map((i) => i.FinishGoodId!);

      const materials = await this.prisma.material.findMany({
        where: { PartNumber: { in: materialIds } },
        select: { PartNumber: true, PartName: true },
      });
      const finishGoods = await this.prisma.finishGood.findMany({
        where: { PartNumber: { in: finishGoodIds } },
        select: { PartNumber: true, PartName: true },
      });

      const snapshotNameMap = new Map<string, string>();
      materials.forEach((m) => snapshotNameMap.set(m.PartNumber, m.PartName));
      finishGoods.forEach((fg) =>
        snapshotNameMap.set(fg.PartNumber, fg.PartName),
      );

      // Group details by item for MATERIAL (WAREHOUSE + RACK in one row)
      // For FINISH_GOOD: each detail is one row
      let totalWhSystemQty = 0;
      let totalWhActualQty = 0;
      let totalRackSystemQty = 0;
      let totalRackActualQty = 0;
      let totalSystemQty = 0;
      let totalActualQty = 0;
      let groupedItemCount = 0;

      if (isMaterial) {
        // Group by MaterialId (combine WAREHOUSE and RACK)
        const groupedByItem = new Map<
          string,
          { warehouse?: (typeof details)[0]; rack?: (typeof details)[0] }
        >();

        for (const item of details) {
          const key = item.MaterialId || item.FinishGoodId || '';
          if (!groupedByItem.has(key)) {
            groupedByItem.set(key, {});
          }
          const group = groupedByItem.get(key)!;
          if (item.Location === LocationType.WAREHOUSE) {
            group.warehouse = item;
          } else if (item.Location === LocationType.RACK) {
            group.rack = item;
          }
        }

        let rowIndex = 0;
        for (const [itemKey, group] of groupedByItem) {
          rowIndex++;
          const itemName = snapshotNameMap.get(itemKey) || '';

          const whDetail = group.warehouse;
          const rackDetail = group.rack;

          // Get WH data
          // ActualQty = 0 if not yet entered (null/undefined)
          // Diff will be negative (0 - SystemQty) if no actual count yet
          const whSystemQty = whDetail?.SystemQty ?? 0;
          const whActual = whDetail?.ActualQty ?? 0;
          const whDiff = whActual - whSystemQty;

          // Get Rack data
          const rackSystemQty = rackDetail?.SystemQtyRack ?? 0;
          const rackActual = rackDetail?.ActualQtyRack ?? 0;
          const rackDiff = rackActual - rackSystemQty;

          // Accumulate totals
          totalWhSystemQty += whSystemQty;
          totalWhActualQty += whActual;
          totalRackSystemQty += rackSystemQty;
          totalRackActualQty += rackActual;

          const row = worksheet.addRow({
            no: rowIndex,
            partNumber: itemKey,
            partName: itemName,
            whSystemQty,
            whActualQty: whActual,
            whDiff,
            rackSystemQty,
            rackActualQty: rackActual,
            rackDiff,
          });

          row.eachCell((cell, colNumber) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };

            if (colNumber === 3) {
              cell.alignment = {
                vertical: 'middle',
                horizontal: 'left',
                wrapText: true,
              };
            }

            // Highlight non-zero diff in red
            if (colNumber === 6 && whDiff !== 0) {
              cell.font = { color: { argb: 'FFFF0000' }, bold: true };
            }
            if (colNumber === 9 && rackDiff !== 0) {
              cell.font = { color: { argb: 'FFFF0000' }, bold: true };
            }
          });

          row.height = 35;
        }

        groupedItemCount = rowIndex;

        // Summary row for MATERIAL
        const summaryRowIdx = headerRowIdx + rowIndex + 2;
        const summaryRow = worksheet.addRow({
          no: '',
          partNumber: 'TOTAL',
          partName: '',
          whSystemQty: totalWhSystemQty,
          whActualQty: totalWhActualQty,
          whDiff: totalWhActualQty - totalWhSystemQty,
          rackSystemQty: totalRackSystemQty,
          rackActualQty: totalRackActualQty,
          rackDiff: totalRackActualQty - totalRackSystemQty,
        });

        summaryRow.eachCell((cell, colNumber) => {
          cell.font = { bold: true };
          cell.border = {
            top: { style: 'medium' },
            left: { style: 'thin' },
            bottom: { style: 'medium' },
            right: { style: 'thin' },
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };

          if (colNumber === 6) {
            const whDiff = totalWhActualQty - totalWhSystemQty;
            if (whDiff !== 0) {
              cell.font = { color: { argb: 'FFFF0000' }, bold: true };
            }
          }
          if (colNumber === 9) {
            const rackDiff = totalRackActualQty - totalRackSystemQty;
            if (rackDiff !== 0) {
              cell.font = { color: { argb: 'FFFF0000' }, bold: true };
            }
          }
        });
      } else {
        // FINISH_GOOD: each detail is one row
        for (let index = 0; index < details.length; index++) {
          const item = details[index];
          const itemName =
            snapshotNameMap.get(item.MaterialId || item.FinishGoodId || '') ||
            '';

          const actualQty = item.ActualQty ?? 0;
          const diff = item.DiffQty ?? actualQty - item.SystemQty;

          totalSystemQty += item.SystemQty;
          totalActualQty += actualQty;

          const row = worksheet.addRow({
            no: index + 1,
            partNumber: item.MaterialId || item.FinishGoodId || '',
            partName: itemName,
            location: item.Location,
            systemQty: item.SystemQty,
            actualQty: actualQty,
            diff: diff,
          });

          row.eachCell((cell, colNumber) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };

            if (colNumber === 3) {
              cell.alignment = {
                vertical: 'middle',
                horizontal: 'left',
                wrapText: true,
              };
            } else {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            if (colNumber === 7 && diff !== 0) {
              cell.font = { color: { argb: 'FFFF0000' }, bold: true };
            }
          });

          row.height = 35;
        }

        // Summary row for FINISH_GOOD
        const summaryRowIdx = headerRowIdx + details.length + 2;
        const summaryRow = worksheet.addRow({
          no: '',
          partNumber: 'TOTAL',
          partName: '',
          location: '',
          systemQty: totalSystemQty,
          actualQty: totalActualQty,
          diff: totalActualQty - totalSystemQty,
        });

        summaryRow.eachCell((cell, colNumber) => {
          cell.font = { bold: true };
          cell.border = {
            top: { style: 'medium' },
            left: { style: 'thin' },
            bottom: { style: 'medium' },
            right: { style: 'thin' },
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (colNumber === 7) {
            const totalDiff = totalActualQty - totalSystemQty;
            if (totalDiff !== 0) {
              cell.font = { color: { argb: 'FFFF0000' }, bold: true };
            }
          }
        });
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Snapshot generated with ${isMaterial ? groupedItemCount : details.length} items, WH Diff: ${totalWhActualQty - totalWhSystemQty}, Rack Diff: ${totalRackActualQty - totalRackSystemQty}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts:1610',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts:1620',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Generate Temporary Report Excel file for inventory counting with tolerance
   */
  async generateTemporaryReport(id: string): Promise<Buffer> {
    return this.generateInventoryReport(id, false);
  }

  /**
   * Generate the approved final inventory report.
   */
  async generateFinalReport(id: string): Promise<Buffer> {
    return this.generateInventoryReport(id, true);
  }

  private async generateInventoryReport(
    id: string,
    isFinal: boolean,
  ): Promise<Buffer> {
    let logProcess: LogProcessModel | undefined;
    const reportName = isFinal ? 'Final Report' : 'Temporary Report';

    try {
      logProcess = await this.logService.startProcess({
        functionId: isFinal ? 'INV_COUNT_013' : 'INV_COUNT_012',
        functionName: isFinal
          ? 'InventoryCountingService.generateFinalReport'
          : 'InventoryCountingService.generateTemporaryReport',
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Generating ${reportName} for inventory counting: ID=${id}`,
        type: 'INFO',
        location: 'inventory-counting.service.ts',
      });

      const inventoryCounting = await this.findOne(id);
      if (
        isFinal &&
        (inventoryCounting.Status !== OpnameStatus.COMPLETED ||
          !inventoryCounting.CompletedAt ||
          !inventoryCounting.CompletedBy)
      ) {
        throw new BadRequestException(
          'Final report is only available after inventory counting is closed and approved',
        );
      }

      const details = await this.prisma.stockOpnameDetail.findMany({
        where: { OpnameId: id },
        orderBy: [
          { Location: 'asc' },
          { MaterialId: 'asc' },
          { FinishGoodId: 'asc' },
        ],
      });

      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet(reportName);

      const subStartRow = 9;
      const headerRowIdx = subStartRow + 5; // Row 14: Table Headers

      // Page Setup
      worksheet.pageSetup = {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: `1:${headerRowIdx}`,
      };
      worksheet.views = [{ showGridLines: false }];

      const dateStr = dayjs().format('DD-MM-YYYY HH:mm');
      const code = inventoryCounting.OpnameNumber;
      const userNames = await getUserDisplayNameMap(
        [inventoryCounting.CreatedBy, inventoryCounting.CompletedBy],
        this.prisma,
      );
      const createdByName =
        userNames.get(inventoryCounting.CreatedBy?.trim() ?? '') ?? '-';

      // Determine if MATERIAL category
      const isMaterial = inventoryCounting.Category === ItemCategory.MATERIAL;
      const lastCol = isMaterial ? 'M' : 'I';

      // Put the document title at the top without a surrounding border
      worksheet.mergeCells(`A1:${lastCol}1`);
      const titleCell = worksheet.getCell('A1');
      titleCell.value = isFinal
        ? 'INVENTORY COUNTING FINAL REPORT'
        : 'INVENTORY TEMPORARY REPORT';
      titleCell.style = {
        font: { bold: true, size: 14 },
        alignment: { horizontal: 'center', vertical: 'middle' },
      };

      // Print the autogenerated notice in the bottom-left footer
      worksheet.headerFooter.oddFooter =
        '&L&8This document autogenerated by IPC System';
      const noteCols = isMaterial
        ? ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']
        : ['E', 'F', 'G', 'H', 'I'];
      const rightLabelCol = isMaterial ? 'L' : 'G';
      const rightValCol = isMaterial ? 'M' : 'H';

      // Header Info
      worksheet.getCell('A5').value = 'Inventory Code';
      worksheet.getCell('C5').value = `: ${code}`;
      worksheet.getCell(`${rightLabelCol}5`).value = 'Date';
      worksheet.getCell(`${rightValCol}5`).value = `: ${dateStr}`;

      worksheet.getCell(`${rightLabelCol}6`).value = 'Tolerance';
      worksheet.getCell(`${rightValCol}6`).value =
        `: ${inventoryCounting.Tolerance ?? 0}%`;

      worksheet.getCell(`${rightLabelCol}7`).value = 'User ID';
      worksheet.getCell(`${rightValCol}7`).value = `: ${createdByName}`;

      // Sub-header
      worksheet.getCell(`A${subStartRow}`).value = 'Report Code';
      worksheet.getCell(`C${subStartRow}`).value =
        `: ${isFinal ? 'FR' : 'TR'}_${code}`;
      worksheet.getCell(`A${subStartRow + 1}`).value = 'Category';
      worksheet.getCell(`C${subStartRow + 1}`).value =
        `: ${inventoryCounting.Category}`;
      worksheet.getCell(`A${subStartRow + 2}`).value = 'Status';
      worksheet.getCell(`C${subStartRow + 2}`).value =
        `: ${inventoryCounting.Status}`;

      // Note Box
      worksheet.mergeCells(`E${subStartRow}:${lastCol}${subStartRow + 2}`);
      const noteCell = worksheet.getCell(`E${subStartRow}`);
      noteCell.value =
        'NOTE: Diff = Actual - System. Negative differences always do not meet tolerance. Positive differences meet tolerance only when Diff % is within the configured limit.';
      noteCell.style = {
        alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
        font: { italic: true, size: 9 },
      };
      for (let row = subStartRow; row <= subStartRow + 2; row++) {
        noteCols.forEach((col) => {
          const cell = worksheet.getCell(`${col}${row}`);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      }

      const headers = isMaterial
        ? [
            'No',
            'Part Number',
            'Part Name',
            'WH Sys Qty',
            'WH Actual',
            'WH Diff',
            'WH Diff %',
            'WH Status',
            'Rack Sys Qty',
            'Rack Actual',
            'Rack Diff',
            'Rack Diff %',
            'Rack Status',
          ]
        : [
            'No',
            'Part Number',
            'Part Name',
            'Location',
            'System Qty',
            'Actual Qty',
            'Diff',
            'Diff %',
            'Status',
          ];

      const headerRow = worksheet.getRow(headerRowIdx);
      headerRow.values = headers;
      headerRow.height = 35;

      headerRow.eachCell((cell) => {
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
      });

      worksheet.columns = isMaterial
        ? [
            { key: 'no', width: 5 },
            { key: 'partNumber', width: 16 },
            { key: 'partName', width: 22 },
            { key: 'whSystemQty', width: 10 },
            { key: 'whActualQty', width: 10 },
            { key: 'whDiff', width: 9 },
            { key: 'whDiffPct', width: 9 },
            { key: 'whStatus', width: 15 },
            { key: 'rackSystemQty', width: 11 },
            { key: 'rackActualQty', width: 11 },
            { key: 'rackDiff', width: 9 },
            { key: 'rackDiffPct', width: 9 },
            { key: 'rackStatus', width: 15 },
          ]
        : [
            { key: 'no', width: 5 },
            { key: 'partNumber', width: 16 },
            { key: 'partName', width: 22 },
            { key: 'location', width: 12 },
            { key: 'systemQty', width: 11 },
            { key: 'actualQty', width: 11 },
            { key: 'diff', width: 10 },
            { key: 'diffPct', width: 10 },
            { key: 'status', width: 15 },
          ];

      const materialIds = details
        .filter((i) => i.MaterialId)
        .map((i) => i.MaterialId!);
      const finishGoodIds = details
        .filter((i) => i.FinishGoodId)
        .map((i) => i.FinishGoodId!);

      const materials = await this.prisma.material.findMany({
        where: { PartNumber: { in: materialIds } },
        select: { PartNumber: true, PartName: true },
      });
      const finishGoods = await this.prisma.finishGood.findMany({
        where: { PartNumber: { in: finishGoodIds } },
        select: { PartNumber: true, PartName: true },
      });

      const snapshotNameMap = new Map<string, string>();
      materials.forEach((m) => snapshotNameMap.set(m.PartNumber, m.PartName));
      finishGoods.forEach((fg) =>
        snapshotNameMap.set(fg.PartNumber, fg.PartName),
      );

      const tolerance = inventoryCounting.Tolerance ?? 0;
      const calculateDiffPctAndStatus = (
        systemQty: number,
        actualQty: number,
      ) => {
        const diff = actualQty - systemQty;
        if (diff < 0) {
          return {
            diffPct: `${((diff / Math.max(systemQty, 1)) * 100).toFixed(2)}%`,
            status: 'Tidak Memenuhi',
          };
        }

        const diffPct =
          systemQty === 0
            ? actualQty > 0
              ? 100
              : 0
            : (diff / systemQty) * 100;
        return {
          diffPct: `${diffPct.toFixed(2)}%`,
          status: diffPct <= tolerance ? 'Memenuhi' : 'Tidak Memenuhi',
        };
      };

      if (isMaterial) {
        const groupedByItem = new Map<
          string,
          { warehouse?: (typeof details)[0]; rack?: (typeof details)[0] }
        >();

        for (const item of details) {
          const key = item.MaterialId || item.FinishGoodId || '';
          if (!groupedByItem.has(key)) {
            groupedByItem.set(key, {});
          }
          const group = groupedByItem.get(key)!;
          if (item.Location === LocationType.WAREHOUSE) {
            group.warehouse = item;
          } else if (item.Location === LocationType.RACK) {
            group.rack = item;
          }
        }

        let rowIndex = 0;
        for (const [itemKey, group] of groupedByItem) {
          rowIndex++;
          const itemName = snapshotNameMap.get(itemKey) || '';

          const whDetail = group.warehouse;
          const rackDetail = group.rack;

          const whSystemQty = whDetail?.SystemQty ?? 0;
          const whActual = whDetail?.ActualQty ?? 0;
          const whDiff = whActual - whSystemQty;
          const whResult = calculateDiffPctAndStatus(whSystemQty, whActual);

          const rackSystemQty = rackDetail?.SystemQtyRack ?? 0;
          const rackActual = rackDetail?.ActualQtyRack ?? 0;
          const rackDiff = rackActual - rackSystemQty;
          const rackResult = calculateDiffPctAndStatus(
            rackSystemQty,
            rackActual,
          );

          const row = worksheet.addRow({
            no: rowIndex,
            partNumber: itemKey,
            partName: itemName,
            whSystemQty,
            whActualQty: whActual,
            whDiff,
            whDiffPct: whResult.diffPct,
            whStatus: whResult.status,
            rackSystemQty,
            rackActualQty: rackActual,
            rackDiff,
            rackDiffPct: rackResult.diffPct,
            rackStatus: rackResult.status,
          });

          row.eachCell((cell, colNumber) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };

            if (colNumber === 3) {
              cell.alignment = {
                vertical: 'middle',
                horizontal: 'left',
                wrapText: true,
              };
            }
            if (colNumber === 8 || colNumber === 13) {
              const isMemenuhi = cell.value === 'Memenuhi';
              const diffValue =
                colNumber === 8 ? row.getCell(6).value : row.getCell(11).value;
              const isMinus = typeof diffValue === 'number' && diffValue < 0;

              cell.font = {
                bold: true,
                color: { argb: isMinus ? 'FFFF0000' : 'FF000000' },
              };
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {
                  argb: isMinus
                    ? 'FFFFFFFF'
                    : isMemenuhi
                      ? 'FF90EE90'
                      : 'FFFFC0CB',
                },
              };
            }
          });
        }
      } else {
        let rowIndex = 0;
        for (const item of details) {
          rowIndex++;
          const itemName = snapshotNameMap.get(item.FinishGoodId!) || '';

          const systemQty = item.SystemQty ?? 0;
          const actualQty = item.ActualQty ?? 0;
          const diff = actualQty - systemQty;
          const result = calculateDiffPctAndStatus(systemQty, actualQty);

          const row = worksheet.addRow({
            no: rowIndex,
            partNumber: item.FinishGoodId,
            partName: itemName,
            location: item.Location,
            systemQty,
            actualQty,
            diff,
            diffPct: result.diffPct,
            status: result.status,
          });

          row.eachCell((cell, colNumber) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };

            if (colNumber === 3) {
              cell.alignment = {
                vertical: 'middle',
                horizontal: 'left',
                wrapText: true,
              };
            }
            if (colNumber === 9) {
              const isMemenuhi = cell.value === 'Memenuhi';
              const diffValue = row.getCell(7).value;
              const isMinus = typeof diffValue === 'number' && diffValue < 0;

              cell.font = {
                bold: true,
                color: { argb: isMinus ? 'FFFF0000' : 'FF000000' },
              };
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {
                  argb: isMinus
                    ? 'FFFFFFFF'
                    : isMemenuhi
                      ? 'FF90EE90'
                      : 'FFFFC0CB',
                },
              };
            }
          });
        }
      }

      if (isFinal) {
        const approvalStartRow =
          (worksheet.lastRow?.number ?? headerRowIdx) + 3;
        const approvalEndCol = isMaterial ? 'M' : 'I';
        const approvalBoxStartCol = isMaterial ? 'K' : 'G';

        worksheet.mergeCells(
          `${approvalBoxStartCol}${approvalStartRow}:${approvalEndCol}${approvalStartRow}`,
        );
        const approvalTitle = worksheet.getCell(
          `${approvalBoxStartCol}${approvalStartRow}`,
        );
        approvalTitle.value = 'APPROVED BY';
        approvalTitle.font = { bold: true, size: 10 };
        approvalTitle.alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };

        worksheet.mergeCells(
          `${approvalBoxStartCol}${approvalStartRow + 1}:${approvalEndCol}${approvalStartRow + 3}`,
        );
        worksheet.mergeCells(
          `${approvalBoxStartCol}${approvalStartRow + 4}:${approvalEndCol}${approvalStartRow + 4}`,
        );
        worksheet.mergeCells(
          `${approvalBoxStartCol}${approvalStartRow + 5}:${approvalEndCol}${approvalStartRow + 5}`,
        );

        const userNames = await getUserDisplayNameMap(
          [inventoryCounting.CompletedBy],
          this.prisma,
        );
        const approverName = getUserDisplayName(
          inventoryCounting.CompletedBy,
          userNames,
        );
        const approverCell = worksheet.getCell(
          `${approvalBoxStartCol}${approvalStartRow + 4}`,
        );
        approverCell.value = approverName;
        approverCell.font = { bold: true, size: 9 };
        approverCell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };

        const approvedAtCell = worksheet.getCell(
          `${approvalBoxStartCol}${approvalStartRow + 5}`,
        );
        approvedAtCell.value = dayjs(inventoryCounting.CompletedAt).format(
          'DD-MM-YYYY HH:mm',
        );
        approvedAtCell.font = { size: 9 };
        approvedAtCell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };

        for (let row = approvalStartRow; row <= approvalStartRow + 5; row++) {
          for (
            let col = worksheet.getColumn(approvalBoxStartCol).number;
            col <= worksheet.getColumn(approvalEndCol).number;
            col++
          ) {
            worksheet.getCell(row, col).border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
          }
        }

        worksheet.getRow(approvalStartRow + 1).height = 18;
        worksheet.getRow(approvalStartRow + 2).height = 18;
        worksheet.getRow(approvalStartRow + 3).height = 18;

        const signatureCandidates = [
          path.join(__dirname, '..', '..', 'assets', 'signed.png'),
          path.join(__dirname, '..', '..', '..', 'assets', 'signed.png'),
          path.join(
            process.cwd(),
            'apps',
            'api',
            'dist',
            'assets',
            'signed.png',
          ),
          path.join(process.cwd(), 'apps', 'api', 'assets', 'signed.png'),
          path.join(process.cwd(), 'dist', 'assets', 'signed.png'),
          path.join(process.cwd(), 'assets', 'signed.png'),
        ];
        const signatureImagePath = signatureCandidates.find((candidate) =>
          fs.existsSync(candidate),
        );

        if (signatureImagePath) {
          const signatureImageId = workbook.addImage({
            buffer: fs.readFileSync(signatureImagePath) as any,
            extension: 'png',
          } as any);
          worksheet.addImage(signatureImageId, {
            tl: {
              col: worksheet.getColumn(approvalBoxStartCol).number - 1 + 0.5,
              row: approvalStartRow,
            },
            ext: { width: 90, height: 50 },
            editAs: 'absolute',
          });
        }
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `${reportName} generated with tolerance ${tolerance}%`,
        type: 'INFO',
        location: 'inventory-counting.service.ts',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'inventory-counting.service.ts',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
