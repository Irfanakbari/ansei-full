import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { PrinterService } from '../../common/printer/printer.service';
import { CreateShoppingDto } from './dto';
import type {
  ShoppingModel,
  LogProcessModel,
  ForecastModel,
  BillOfMaterialsModel,
} from '../../generated/prisma/models';
import {
  LocationType,
  TransactionType,
  TypeShopping,
  ProductionStatus,
} from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';

/**
 * Interface for BOM summary response
 */
export interface BomSummary {
  materialId: string;
  materialName: string;
  bomQtyPerUnit: number;
  totalRequired: number;
  alreadyPicked: number;
  remainingToPick: number;
  isCompleted: boolean;
}

/**
 * Interface for forecast picking status response
 */
export interface ForecastPickingStatus {
  forecastId: string;
  finishGoodId: string;
  finishGoodName: string;
  forecastQty: number;
  status: ProductionStatus | null;
  bomSummary: BomSummary[];
  progress: {
    totalMaterials: number;
    completedMaterials: number;
    totalPickedPercent: number;
  };
}

/**
 * Interface for check requirement response
 */
export interface CheckRequirementItem {
  materialId: string;
  materialName: string;
  bomQtyPerUnit: number;
  qtyNeeded: number;
  qtyPicked: number;
  qtyRemaining: number;
  isCompleted: boolean;
}

export interface CheckRequirementResponse {
  forecastId: string;
  finishGoodId: string;
  finishGoodName: string;
  forecastQty: number;
  productionReleaseStatus: string | null;
  requirements: CheckRequirementItem[];
  summary: {
    totalMaterials: number;
    completedMaterials: number;
    totalQtyNeeded: number;
    totalQtyPicked: number;
    totalQtyRemaining: number;
    overallPercentage: number;
  };
}

@Injectable()
export class ShoppingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
    private readonly printerService: PrinterService,
  ) {}

  async findAll(query: SearchPaginationQueryDto) {
    const where: Prisma.ShoppingWhereInput = query.search
      ? {
          OR: [
            { ForecastId: { contains: query.search, mode: 'insensitive' } },
            { MaterialId: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [totalItems, data] = await Promise.all([
      this.prisma.shopping.count({ where }),
      this.prisma.shopping.findMany({
        where,
        include: {
          MaterialData: true,
          ForecastData: true,
        },
        orderBy: [{ CreatedAt: 'desc' }, { Id: 'desc' }],
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

  async findOne(id: string) {
    const shopping = await this.prisma.shopping.findUnique({
      where: { Id: id },
      include: {
        MaterialData: true,
        ForecastData: true,
      },
    });

    if (!shopping) {
      throw new NotFoundException(`Shopping with id ${id} not found`);
    }

    return shopping;
  }

  async findByForecastId(forecastId: string) {
    return this.prisma.shopping.findMany({
      where: { ForecastId: forecastId },
      include: {
        MaterialData: true,
        ForecastData: true,
      },
      orderBy: {
        CreatedAt: 'asc',
      },
    });
  }

  async findByMaterialId(materialId: string) {
    return this.prisma.shopping.findMany({
      where: { MaterialId: materialId },
      include: {
        MaterialData: true,
        ForecastData: true,
      },
      orderBy: {
        CreatedAt: 'desc',
      },
    });
  }

  /**
   * Get BOM summary and picking progress for a Forecast
   */
  async getForecastPickingStatus(
    forecastId: string,
  ): Promise<ForecastPickingStatus> {
    // Get Forecast dengan ProductionRelease
    const forecast = await this.prisma.forecast.findUnique({
      where: { PoId: forecastId },
      include: {
        PartData: {
          select: {
            PartNumber: true,
            PartName: true,
          },
        },
      },
    });

    // Get ProductionRelease separately
    const productionRelease = forecast?.ProductionReleaseId
      ? await this.prisma.productionRelease.findUnique({
          where: { Id: forecast.ProductionReleaseId },
          select: { Status: true },
        })
      : null;

    if (!forecast) {
      throw new NotFoundException(`Forecast ${forecastId} not found`);
    }

    // Get semua BOM untuk FinishGood ini (Filter by FGData.PartNumber)
    // Include semua field yang diperlukan
    const bomEntries = await this.prisma.billOfMaterials.findMany({
      where: { FGData: { PartNumber: forecast.FinishGoodId } },
      include: {
        FGData: {
          select: {
            Id: true,
            PartNumber: true,
            PartName: true,
          },
        },
        MaterialData: {
          select: {
            Id: true,
            PartNumber: true,
            PartName: true,
          },
        },
      },
    });

    // DEBUG: Log hasil BOM query
    console.log('[DEBUG] BOM Entries count:', bomEntries.length);
    console.log('[DEBUG] BOM Entries:', JSON.stringify(bomEntries, null, 2));

    // Get semua shopping untuk forecast ini
    const shoppings = await this.prisma.shopping.findMany({
      where: { ForecastId: forecastId },
      select: {
        MaterialId: true,
        QtyPick: true,
      },
    });

    // Calculate total picked per material
    const pickedByMaterial = new Map<string, number>();
    for (const shop of shoppings) {
      const current = pickedByMaterial.get(shop.MaterialId) || 0;
      pickedByMaterial.set(shop.MaterialId, current + shop.QtyPick);
    }

    // Build BOM summary
    const bomSummary: BomSummary[] = bomEntries.map((bom) => {
      const totalRequired = forecast.Qty * bom.Qty;
      const alreadyPicked =
        pickedByMaterial.get(bom.MaterialData.PartNumber) || 0;
      const remainingToPick = totalRequired - alreadyPicked;

      return {
        materialId: bom.MaterialData.PartNumber,
        materialName: bom.MaterialData.PartName,
        bomQtyPerUnit: bom.Qty,
        totalRequired,
        alreadyPicked,
        remainingToPick,
        isCompleted: remainingToPick <= 0,
      };
    });

    // Calculate progress
    const totalMaterials = bomSummary.length;
    const completedMaterials = bomSummary.filter((b) => b.isCompleted).length;
    const totalPicked = bomSummary.reduce((sum, b) => sum + b.alreadyPicked, 0);
    const totalRequired = bomSummary.reduce(
      (sum, b) => sum + b.totalRequired,
      0,
    );
    const totalPickedPercent =
      totalRequired > 0 ? Math.round((totalPicked / totalRequired) * 100) : 0;

    return {
      forecastId: forecast.PoId,
      finishGoodId: forecast.FinishGoodId,
      finishGoodName: forecast.PartData.PartName,
      forecastQty: forecast.Qty,
      status: productionRelease?.Status || null,
      bomSummary,
      progress: {
        totalMaterials,
        completedMaterials,
        totalPickedPercent,
      },
    };
  }

  async create(dto: CreateShoppingDto, createdBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'SHOPPING_001',
        functionName: 'ShoppingService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating shopping: Type=${dto.type}, Material=${dto.materialId}, QtyPick=${dto.qtyPick}`,
        type: 'INFO',
        location: 'shopping.service.ts:155',
      });

      // POKAYOKE: Validate Material exists
      await this.validateMaterialExists(dto.materialId, logProcess.ProcessId);

      // ========== REGULER SHOPPING ==========
      if (dto.type === TypeShopping.REGULER) {
        return await this.createRegulerShopping(dto, createdBy, logProcess);
      }

      // ========== ADDITIONAL SHOPPING ==========
      return await this.createAdditionalShopping(dto, createdBy, logProcess);
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'shopping.service.ts:185',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * REGULER Shopping - Terikat dengan Forecast & BOM (Strict Poka-Yoke)
   */
  private async createRegulerShopping(
    dto: CreateShoppingDto,
    createdBy: string,
    logProcess: LogProcessModel,
  ): Promise<ShoppingModel> {
    const processId = logProcess.ProcessId;

    // STEP 1: POKAYOKE - Forecast harus ada
    const forecast = await this.validateAndGetForecast(
      dto.forecastId,
      processId,
    );

    // STEP 2: POKAYOKE - Forecast harus RELEASED
    await this.validateForecastReleased(forecast, processId);

    // STEP 3: POKAYOKE - BOM harus ada untuk FinishGood ini
    const bomEntry = await this.validateBOMExists(
      forecast.FinishGoodId,
      dto.materialId,
      processId,
    );

    // STEP 4: HITUNG total qty yang dibutuhkan
    const totalRequired = forecast.Qty * bomEntry.Qty;

    // STEP 5: CEK berapa yang sudah di-pick sebelumnya
    const alreadyPicked = await this.getTotalPickedForMaterial(
      dto.forecastId,
      dto.materialId,
      processId,
    );

    // STEP 6: CEK SISA yang masih bisa di-pick
    const remainingToPick = totalRequired - alreadyPicked;

    await this.logService.addLog({
      processId,
      message: `POKAYOKE CHECK: TotalRequired=${totalRequired}, AlreadyPicked=${alreadyPicked}, Remaining=${remainingToPick}, QtyPick=${dto.qtyPick}`,
      type: 'INFO',
      location: 'shopping.service.ts:230',
    });

    // STEP 7: POKAYOKE STRICT - Cannot pick less (except if this is the last pick)
    if (dto.qtyPick < remainingToPick && dto.qtyPick !== remainingToPick) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: QtyPick (${dto.qtyPick}) < Remaining (${remainingToPick}). UNDER-PICKING not allowed.`,
        type: 'ERROR',
        location: 'shopping.service.ts:240',
      });
      throw new BadRequestException(
        `POKAYOKE FAILED: QtyPick (${dto.qtyPick}) is less than remaining required (${remainingToPick}). ` +
          `Pick exactly ${remainingToPick} or NONE at all.`,
      );
    }

    // STEP 8: POKAYOKE STRICT - Cannot pick more
    if (dto.qtyPick > remainingToPick) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: QtyPick (${dto.qtyPick}) > Remaining (${remainingToPick}). OVER-PICKING not allowed.`,
        type: 'ERROR',
        location: 'shopping.service.ts:252',
      });
      throw new BadRequestException(
        `POKAYOKE FAILED: QtyPick (${dto.qtyPick}) exceeds remaining required (${remainingToPick}). ` +
          `Exceeds the requirement!`,
      );
    }

    // STEP 9: POKAYOKE - Stok harus cukup
    await this.validateStockAvailability(
      dto.materialId,
      dto.qtyPick,
      processId,
    );

    // STEP 10: CHECK if ALL BOM materials for this forecast's FinishGood are complete
    // Include the current pick in the calculation (since it hasn't been committed yet)
    const shouldIncrementFinishGood = await this.checkAllBomsComplete(
      dto.forecastId,
      forecast.FinishGoodId,
      dto.materialId,
      dto.qtyPick,
      processId,
    );

    await this.logService.addLog({
      processId,
      message: `Checking FINISH GOOD increment: shouldIncrementFinishGood=${shouldIncrementFinishGood}, ForecastQty=${forecast.Qty}, FinishGoodId=${forecast.FinishGoodId}`,
      type: 'INFO',
      location: 'shopping.service.ts:383',
    });

    // STEP 11: EKSEKUSI transaction with FINISH GOOD increment data
    const shopping = await this.executeShoppingTransaction(
      dto,
      createdBy,
      processId,
      {
        finishGoodId: forecast.FinishGoodId,
        forecastQty: forecast.Qty,
        shouldIncrementFinishGood,
      },
    );

    if (shouldIncrementFinishGood) {
      await this.emitPartTag(dto.forecastId, forecast.FinishGoodId, processId);
    }

    return shopping;
  }

  private async emitPartTag(
    forecastId: string,
    finishGoodId: string,
    processId: string,
  ): Promise<void> {
    try {
      const [forecast, finishGood, boxQTY] = await Promise.all([
        this.prisma.forecast.findUnique({ where: { PoId: forecastId } }),
        this.prisma.finishGood.findUnique({
          where: { PartNumber: finishGoodId },
        }),
        this.prisma.boxQTY.findUnique({
          where: { PartNumber: finishGoodId },
        }),
      ]);

      if (!forecast || !finishGood) {
        throw new Error('Committed part tag data could not be loaded');
      }

      await this.printerService.printPartTagAnsei({
        poId: forecast.PoId,
        qtyOrder: forecast.Qty,
        partNumber: finishGood.PartNumber,
        partName: finishGood.PartName,
        vendorCode: forecast.VendorCode,
        classificationCode: forecast.Classification,
        deliveryDate: forecast.DeliveryDate,
        qtyPerbox: boxQTY?.Qty ?? forecast.Qty,
        poNumber: forecast.PoNumber,
        receivingArea: forecast.ReceivingArea,
      });
      await this.safePrinterAudit(
        processId,
        `Printer event printPartTagAnsei emitted for forecast ${forecastId}`,
        'INFO',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.safePrinterAudit(
        processId,
        `Printer event printPartTagAnsei failed for forecast ${forecastId}: ${message}`,
        'ERROR',
      );
    }
  }

  private async safePrinterAudit(
    processId: string,
    message: string,
    type: 'INFO' | 'ERROR',
  ): Promise<void> {
    try {
      await this.logService.addLog({
        processId,
        message,
        type,
        location: 'ShoppingService.emitPartTag',
      });
    } catch {
      return;
    }
  }

  /**
   * Check if ALL BOM materials for a forecast's FinishGood are complete
   * Returns true only when ALL materials have been fully picked according to BOM
   * @param currentMaterialId - The material being picked in this transaction
   * @param currentQtyPick - The quantity being picked in this transaction
   */
  private async checkAllBomsComplete(
    forecastId: string,
    finishGoodId: string,
    currentMaterialId: string,
    currentQtyPick: number,
    processId: string,
  ): Promise<boolean> {
    // Get Forecast Qty
    const forecast = await this.prisma.forecast.findUnique({
      where: { PoId: forecastId },
      select: { Qty: true },
    });

    if (!forecast) {
      await this.logService.addLog({
        processId,
        message: `BOM check: Forecast ${forecastId} not found`,
        type: 'WARN',
        location: 'shopping.service.ts:410',
      });
      return false;
    }

    // Get all BOM entries for this FinishGood
    const bomEntries = await this.prisma.billOfMaterials.findMany({
      where: { FGData: { PartNumber: finishGoodId } },
      include: {
        MaterialData: {
          select: { PartNumber: true },
        },
      },
    });

    if (bomEntries.length === 0) {
      await this.logService.addLog({
        processId,
        message: `BOM check: No BOM entries found for FinishGood ${finishGoodId}`,
        type: 'WARN',
        location: 'shopping.service.ts:428',
      });
      return false;
    }

    await this.logService.addLog({
      processId,
      message: `BOM check: Checking ${bomEntries.length} materials for FinishGood ${finishGoodId} (ForecastQty: ${forecast.Qty})`,
      type: 'INFO',
      location: 'shopping.service.ts:434',
    });

    // Check each material's pick status
    for (const bom of bomEntries) {
      const totalRequired = forecast.Qty * bom.Qty;
      const materialPartNumber = bom.MaterialData?.PartNumber;

      if (!materialPartNumber) continue;

      // Get total picked for this material in this forecast from database
      const shoppings = await this.prisma.shopping.findMany({
        where: {
          ForecastId: forecastId,
          MaterialId: materialPartNumber,
        },
        select: { QtyPick: true },
      });

      // Calculate already picked from database
      let alreadyPicked = shoppings.reduce((sum, s) => sum + s.QtyPick, 0);

      // Add current pick if this is the material being picked
      if (materialPartNumber === currentMaterialId) {
        alreadyPicked += currentQtyPick;
        await this.logService.addLog({
          processId,
          message: `BOM check: Material ${materialPartNumber} - Adding current pick: ${currentQtyPick} (DB: ${alreadyPicked - currentQtyPick} + Current: ${currentQtyPick} = ${alreadyPicked})`,
          type: 'DEBUG',
          location: 'shopping.service.ts:463',
        });
      }

      await this.logService.addLog({
        processId,
        message: `BOM check: Material ${materialPartNumber} - Picked: ${alreadyPicked}/${totalRequired}`,
        type: 'DEBUG',
        location: 'shopping.service.ts:469',
      });

      // If any material is NOT complete, return false
      if (alreadyPicked < totalRequired) {
        await this.logService.addLog({
          processId,
          message: `BOM check: Material ${materialPartNumber} NOT complete (${alreadyPicked}/${totalRequired}) - waiting for more picks`,
          type: 'INFO',
          location: 'shopping.service.ts:476',
        });
        return false;
      }
    }

    await this.logService.addLog({
      processId,
      message: `BOM check: ALL ${bomEntries.length} materials COMPLETE for FinishGood ${finishGoodId} - Will increment FinishGood.Qty by ${forecast.Qty}`,
      type: 'INFO',
      location: 'shopping.service.ts:483',
    });

    return true;
  }

  /**
   * ADDITIONAL Shopping - Not bound to Forecast (free pick)
   */
  private async createAdditionalShopping(
    dto: CreateShoppingDto,
    createdBy: string,
    logProcess: LogProcessModel,
  ): Promise<ShoppingModel> {
    const processId = logProcess.ProcessId;

    await this.logService.addLog({
      processId,
      message: `ADDITIONAL shopping: No forecast validation required`,
      type: 'INFO',
      location: 'shopping.service.ts:285',
    });

    // POKAYOKE - Stok harus cukup
    await this.validateStockAvailability(
      dto.materialId,
      dto.qtyPick,
      processId,
    );

    // Execute with NO FINISH GOOD increment (ADDITIONAL shopping)
    const dtoForAdditional: CreateShoppingDto = {
      ...dto,
      forecastId: dto.forecastId || 'ADDITIONAL',
    };

    return this.executeShoppingTransaction(
      dtoForAdditional,
      createdBy,
      processId,
      {
        finishGoodId: null,
        forecastQty: null,
        shouldIncrementFinishGood: false,
      },
    );
  }

  /**
   * Execute the actual shopping transaction (create ledger, update stock, create record)
   */
  private async executeShoppingTransaction(
    dto: CreateShoppingDto,
    createdBy: string,
    processId: string,
    finishGoodContext?: {
      finishGoodId: string | null;
      forecastQty: number | null;
      shouldIncrementFinishGood: boolean;
    },
  ): Promise<ShoppingModel> {
    // Generate auto ID
    const shoppingId = await this.generateShoppingId();

    await this.logService.addLog({
      processId,
      message: `Executing transaction with Shopping ID: ${shoppingId}`,
      type: 'INFO',
      location: 'shopping.service.ts:320',
    });

    const result = await this.prisma.$transaction(async (tx) => {
      // Get current QtyRack
      const material = await tx.material.findUnique({
        where: { PartNumber: dto.materialId },
        select: { QtyRack: true, PartName: true },
      });

      const balanceBefore = material?.QtyRack || 0;
      const balanceAfter = balanceBefore - dto.qtyPick;

      // Create InventoryLedger entry
      await tx.inventoryLedger.create({
        data: {
          Id: crypto.randomUUID(),
          TransactionDate: new Date(),
          ItemCategory: 'MATERIAL',
          MaterialId: dto.materialId,
          Location: LocationType.RACK,
          TransactionType: TransactionType.PRODUCTION_USAGE,
          ReferenceDoc: shoppingId,
          BalanceBefore: balanceBefore,
          QtyIn: 0,
          QtyOut: dto.qtyPick,
          BalanceAfter: balanceAfter,
          CreatedBy: createdBy,
          Notes: `${dto.type === TypeShopping.REGULER ? 'REGULER' : 'ADDITIONAL'} shopping pick for PO: ${dto.forecastId}`,
        },
      });

      await this.logService.addLog({
        processId,
        message: `InventoryLedger created: Material ${dto.materialId} QtyRack ${balanceBefore} -> ${balanceAfter}`,
        type: 'INFO',
        location: 'shopping.service.ts:348',
      });

      // Update Material QtyRack
      await tx.material.update({
        where: { PartNumber: dto.materialId },
        data: { QtyRack: balanceAfter },
      });

      await this.logService.addLog({
        processId,
        message: `Material ${dto.materialId} QtyRack updated: ${balanceAfter}`,
        type: 'INFO',
        location: 'shopping.service.ts:356',
      });

      // Create Shopping record
      const shopping = await tx.shopping.create({
        data: {
          Id: shoppingId,
          ForecastId: dto.forecastId,
          MaterialId: dto.materialId,
          QtyPick: dto.qtyPick,
          Type: dto.type,
          Description: dto.description,
          CreatedBy: createdBy,
        },
        include: {
          MaterialData: true,
          ForecastData: true,
        },
      });

      // ========== FINISH GOOD INCREMENT (PRODUCTION_RESULT) ==========
      // Only for REGULER shopping when ALL BOM materials are COMPLETE
      if (
        finishGoodContext?.finishGoodId &&
        finishGoodContext?.forecastQty &&
        finishGoodContext?.shouldIncrementFinishGood
      ) {
        // Get current FinishGood stock
        const fg = await tx.finishGood.findUnique({
          where: { PartNumber: finishGoodContext.finishGoodId },
          select: { Qty: true, PartName: true },
        });

        if (fg) {
          const fgBalanceBefore = fg.Qty;
          const fgBalanceAfter =
            fgBalanceBefore + finishGoodContext.forecastQty;

          // INCREMENT FinishGood Qty
          await tx.finishGood.update({
            where: { PartNumber: finishGoodContext.finishGoodId },
            data: { Qty: fgBalanceAfter },
          });

          // Create InventoryLedger entry for PRODUCTION_RESULT
          await tx.inventoryLedger.create({
            data: {
              Id: crypto.randomUUID(),
              TransactionDate: new Date(),
              ItemCategory: 'FINISH_GOOD',
              FinishGoodId: finishGoodContext.finishGoodId,
              Location: LocationType.FINISH_GOOD_AREA,
              TransactionType: TransactionType.PRODUCTION_RESULT,
              ReferenceDoc: `PROD-${shoppingId}`,
              BalanceBefore: fgBalanceBefore,
              QtyIn: finishGoodContext.forecastQty,
              QtyOut: 0,
              BalanceAfter: fgBalanceAfter,
              CreatedBy: createdBy,
              Notes: `Production Result from REGULER shopping completion for PO: ${dto.forecastId}. Material: ${dto.materialId}, QtyPick: ${dto.qtyPick}`,
            },
          });

          await this.logService.addLog({
            processId,
            message: `FINISH GOOD INCREMENT: ${finishGoodContext.finishGoodId} Qty ${fgBalanceBefore} -> ${fgBalanceAfter} (+${finishGoodContext.forecastQty}) - BOM Complete for PO: ${dto.forecastId}`,
            type: 'INFO',
            location: 'shopping.service.ts:380',
          });
        }
      }

      return shopping;
    });

    await this.logService.completeProcess(processId, 'SUCCESS');

    return result;
  }

  async remove(id: string, deletedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'SHOPPING_003',
        functionName: 'ShoppingService.Delete',
        createdBy: deletedBy,
      });

      const existing = await this.prisma.shopping.findUnique({
        where: { Id: id },
        include: {
          MaterialData: true,
        },
      });

      if (!existing) {
        throw new NotFoundException(`Shopping with id ${id} not found`);
      }

      // Cannot delete if QtyPick > 0 - must return stock first
      if (existing.QtyPick > 0) {
        throw new BadRequestException(
          `Cannot delete shopping with QtyPick > 0. Current QtyPick: ${existing.QtyPick}. Return the stock first.`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting shopping ${id}`,
        type: 'INFO',
        location: 'shopping.service.ts:410',
      });

      await this.prisma.shopping.delete({
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

  /**
   * Generate auto ID for Shopping
   * Format: SHP-DDMMYY-XXX (e.g., SHP-080626-001)
   * XXX = 3-digit sequential, resets daily
   */
  async generateShoppingId(): Promise<string> {
    const now = new Date();
    const datePart = `${now.getDate().toString().padStart(2, '0')}${(
      now.getMonth() + 1
    )
      .toString()
      .padStart(2, '0')}${now.getFullYear().toString().slice(-2)}`;
    const prefix = `SHP-${datePart}-`;

    // Find the highest sequence number for today
    const latestShopping = await this.prisma.shopping.findFirst({
      where: {
        Id: { startsWith: prefix },
      },
      orderBy: { Id: 'desc' },
      select: { Id: true },
    });

    let nextSeq = 1;
    if (latestShopping) {
      const lastSeq = parseInt(latestShopping.Id.split('-')[2], 10);
      nextSeq = lastSeq + 1;
    }

    return `${prefix}${nextSeq.toString().padStart(3, '0')}`;
  }

  // ========== POKAYOKE VALIDATION HELPERS ==========

  /**
   * POKAYOKE: Validate Material exists in master and is active
   */
  private async validateMaterialExists(
    materialId: string,
    processId: string,
  ): Promise<void> {
    const material = await this.prisma.material.findUnique({
      where: { PartNumber: materialId },
      select: { Id: true, PartNumber: true, IsActive: true },
    });

    if (!material) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: Material ${materialId} not found in Material master`,
        type: 'ERROR',
        location: 'shopping.service.ts:485',
      });
      throw new BadRequestException(
        `POKAYOKE: Material ${materialId} not found in Material master`,
      );
    }

    if (!material.IsActive) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: Material ${materialId} is discontinued (IsActive=false)`,
        type: 'ERROR',
        location: 'shopping.service.ts:493',
      });
      throw new BadRequestException(
        `POKAYOKE: Material ${materialId} is discontinued and cannot be used in transactions. Please reactivate the material first.`,
      );
    }

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: Material ${materialId} validated (active)`,
      type: 'INFO',
      location: 'shopping.service.ts:501',
    });
  }

  /**
   * POKAYOKE: Validate AND GET Forecast
   */
  private async validateAndGetForecast(
    forecastId: string,
    processId: string,
  ): Promise<
    ForecastModel & { productionReleaseStatus: ProductionStatus | null }
  > {
    const forecast = await this.prisma.forecast.findUnique({
      where: { PoId: forecastId },
    });

    if (!forecast) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: Forecast ${forecastId} not found`,
        type: 'ERROR',
        location: 'shopping.service.ts:515',
      });
      throw new BadRequestException(
        `POKAYOKE: Forecast ${forecastId} not found`,
      );
    }

    // Get ProductionRelease status
    let productionReleaseStatus: ProductionStatus | null = null;
    if (forecast.ProductionReleaseId) {
      const release = await this.prisma.productionRelease.findUnique({
        where: { Id: forecast.ProductionReleaseId },
        select: { Status: true },
      });
      productionReleaseStatus = (release?.Status as ProductionStatus) || null;
    }

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: Forecast ${forecastId} validated, FG=${forecast.FinishGoodId}, Qty=${forecast.Qty}, ReleaseStatus=${productionReleaseStatus}`,
      type: 'INFO',
      location: 'shopping.service.ts:530',
    });

    return { ...forecast, productionReleaseStatus };
  }

  /**
   * POKAYOKE: Validate Forecast is RELEASED
   */
  private async validateForecastReleased(
    forecast: ForecastModel & {
      productionReleaseStatus: ProductionStatus | null;
    },
    processId: string,
  ): Promise<void> {
    const releaseStatus = forecast.productionReleaseStatus;

    if (releaseStatus !== ProductionStatus.RELEASED) {
      const currentStatus = releaseStatus || 'NULL (not scheduled)';
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: Forecast ${forecast.PoId} not RELEASED. Current status: ${currentStatus}`,
        type: 'ERROR',
        location: 'shopping.service.ts:555',
      });
      throw new BadRequestException(
        `POKAYOKE: Forecast ${forecast.PoId} is not RELEASED. Current status: ${currentStatus}. ` +
          `Forecast must be RELEASED before shopping.`,
      );
    }

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: Forecast ${forecast.PoId} is RELEASED`,
      type: 'INFO',
      location: 'shopping.service.ts:565',
    });
  }

  /**
   * POKAYOKE: Validate BOM exists for Material in this FinishGood
   */
  private async validateBOMExists(
    finishGoodPartNumber: string,
    materialId: string,
    processId: string,
  ): Promise<BillOfMaterialsModel> {
    // Cari BOM dengan filter FGData.PartNumber
    const bomEntry = await this.prisma.billOfMaterials.findFirst({
      where: {
        FGData: { PartNumber: finishGoodPartNumber },
        MaterialData: { PartNumber: materialId },
      },
    });

    if (!bomEntry) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: Material ${materialId} not in BOM for FinishGood ${finishGoodPartNumber}`,
        type: 'ERROR',
        location: 'shopping.service.ts:595',
      });
      throw new BadRequestException(
        `POKAYOKE: Material ${materialId} is NOT in BillOfMaterials for FinishGood ${finishGoodPartNumber}. ` +
          `This material is not required for production.`,
      );
    }

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: BOM validated - Material ${materialId}, QtyPerUnit=${bomEntry.Qty}`,
      type: 'INFO',
      location: 'shopping.service.ts:605',
    });

    return bomEntry;
  }

  /**
   * Get total qty already picked for a material in a forecast
   */
  private async getTotalPickedForMaterial(
    forecastId: string,
    materialId: string,
    processId: string,
  ): Promise<number> {
    const shoppings = await this.prisma.shopping.findMany({
      where: {
        ForecastId: forecastId,
        MaterialId: materialId,
      },
      select: { QtyPick: true },
    });

    const totalPicked = shoppings.reduce((sum, s) => sum + s.QtyPick, 0);

    await this.logService.addLog({
      processId,
      message: `Already picked for ${forecastId}/${materialId}: ${totalPicked}`,
      type: 'INFO',
      location: 'shopping.service.ts:610',
    });

    return totalPicked;
  }

  /**
   * POKAYOKE: Validate stock availability in QtyRack
   */
  private async validateStockAvailability(
    materialId: string,
    qtyPick: number,
    processId: string,
  ): Promise<void> {
    const material = await this.prisma.material.findUnique({
      where: { PartNumber: materialId },
      select: { QtyRack: true },
    });

    const availableStock = material?.QtyRack || 0;

    if (availableStock < qtyPick) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: Insufficient stock. Available: ${availableStock}, Required: ${qtyPick}`,
        type: 'ERROR',
        location: 'shopping.service.ts:633',
      });
      throw new BadRequestException(
        `POKAYOKE: Insufficient stock in QtyRack. Available: ${availableStock}, Required: ${qtyPick}`,
      );
    }

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: Stock available. QtyRack: ${availableStock} >= QtyPick: ${qtyPick}`,
      type: 'INFO',
      location: 'shopping.service.ts:641',
    });
  }

  /**
   * Check BOM requirements for a Forecast
   * Returns BOM materials with qtyNeeded, qtyPicked, and qtyRemaining
   */
  async checkRequirement(
    forecastId: string,
  ): Promise<CheckRequirementResponse> {
    // Get Forecast with ProductionRelease
    const forecast = await this.prisma.forecast.findUnique({
      where: { PoId: forecastId },
      include: {
        PartData: {
          select: {
            PartNumber: true,
            PartName: true,
          },
        },
      },
    });

    if (!forecast) {
      throw new NotFoundException(`Forecast ${forecastId} not found`);
    }

    // Get ProductionRelease status
    let productionReleaseStatus: string | null = null;
    if (forecast.ProductionReleaseId) {
      const release = await this.prisma.productionRelease.findUnique({
        where: { Id: forecast.ProductionReleaseId },
        select: { Status: true },
      });
      productionReleaseStatus = release?.Status || null;
    }

    // Get BOM for FinishGood
    const bomEntries = await this.prisma.billOfMaterials.findMany({
      where: { FGData: { PartNumber: forecast.FinishGoodId } },
      include: {
        MaterialData: {
          select: {
            PartNumber: true,
            PartName: true,
          },
        },
      },
    });

    // Get all shopping records for this forecast
    const shoppings = await this.prisma.shopping.findMany({
      where: { ForecastId: forecastId },
      select: {
        MaterialId: true,
        QtyPick: true,
      },
    });

    // Calculate total picked per material
    const pickedByMaterial = new Map<string, number>();
    for (const shop of shoppings) {
      const current = pickedByMaterial.get(shop.MaterialId) || 0;
      pickedByMaterial.set(shop.MaterialId, current + shop.QtyPick);
    }

    // Build requirements
    const requirements: CheckRequirementItem[] = bomEntries.map((bom) => {
      const qtyNeeded = forecast.Qty * bom.Qty;
      const qtyPicked = pickedByMaterial.get(bom.MaterialData.PartNumber) || 0;
      const qtyRemaining = qtyNeeded - qtyPicked;

      return {
        materialId: bom.MaterialData.PartNumber,
        materialName: bom.MaterialData.PartName,
        bomQtyPerUnit: bom.Qty,
        qtyNeeded,
        qtyPicked,
        qtyRemaining,
        isCompleted: qtyRemaining <= 0,
      };
    });

    // Calculate summary
    const totalMaterials = requirements.length;
    const completedMaterials = requirements.filter((r) => r.isCompleted).length;
    const totalQtyNeeded = requirements.reduce(
      (sum, r) => sum + r.qtyNeeded,
      0,
    );
    const totalQtyPicked = requirements.reduce(
      (sum, r) => sum + r.qtyPicked,
      0,
    );
    const totalQtyRemaining = requirements.reduce(
      (sum, r) => sum + r.qtyRemaining,
      0,
    );
    const overallPercentage =
      totalQtyNeeded > 0
        ? Math.round((totalQtyPicked / totalQtyNeeded) * 100)
        : 0;

    return {
      forecastId: forecast.PoId,
      finishGoodId: forecast.FinishGoodId,
      finishGoodName: forecast.PartData.PartName,
      forecastQty: forecast.Qty,
      productionReleaseStatus,
      requirements,
      summary: {
        totalMaterials,
        completedMaterials,
        totalQtyNeeded,
        totalQtyPicked,
        totalQtyRemaining,
        overallPercentage,
      },
    };
  }
}
