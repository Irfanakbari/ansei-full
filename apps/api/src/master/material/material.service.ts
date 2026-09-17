import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { CreateMaterialDto, UpdateMaterialDto } from './dto';
import type {
  LogProcessModel,
  MaterialModel,
} from '../../generated/prisma/models';
import type { Prisma } from '../../generated/prisma/client';
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

  async findAll(
    query: SearchPaginationQueryDto,
  ): Promise<ApiResult<MaterialModel[], PaginationMeta>> {
    const where: Prisma.MaterialWhereInput = query.search
      ? {
          OR: [
            { PartNumber: { contains: query.search, mode: 'insensitive' } },
            { PartName: { contains: query.search, mode: 'insensitive' } },
            { Supplier: { contains: query.search, mode: 'insensitive' } },
            { RackLocation: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
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

      const result = await this.prisma.material.create({
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
          CreatedBy: createdBy,
        },
        include: {
          SatuanData: true,
        },
      });

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

      // Check if new part number conflicts with existing
      if (dto.partNumber && dto.partNumber !== existing.PartNumber) {
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

      const result = await this.prisma.material.update({
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
        },
        include: {
          SatuanData: true,
        },
      });

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

      await this.prisma.material.delete({
        where: { Id: id },
      });

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
      const result = await this.prisma.material.update({
        where: { PartNumber: partNumber },
        data: {
          IsActive: false,
          DiscontinueDate: now,
        },
        include: {
          SatuanData: true,
        },
      });

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
      const result = await this.prisma.material.update({
        where: { PartNumber: partNumber },
        data: {
          IsActive: true,
          DiscontinueDate: null,
        },
        include: {
          SatuanData: true,
        },
      });

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
}
