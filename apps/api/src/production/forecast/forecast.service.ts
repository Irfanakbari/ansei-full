import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { ExcelService } from '../../common/utils/excel.service';
import { formatErrorMessage } from '../../common/utils/error-formatter.util';
import { PrinterService } from '../../common/printer/printer.service';
import { CreateForecastDto, ForecastQueryDto, UpdateForecastDto } from './dto';
import type {
  ForecastModel,
  LogProcessModel,
} from '../../generated/prisma/models';
import { ProductionStatus } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { validateUploadContent } from '../../common/utils/upload-security.util';
import {
  buildProductionLabels,
  lockProductionFlow,
} from '../../common/helpers/production-flow.helper';

interface ForecastExcelRow {
  [columnPosition: number]: string | number | Date | undefined;
}

@Injectable()
export class ForecastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
    private readonly excelService: ExcelService,
    private readonly printerService: PrinterService,
  ) {}

  /**
   * Column position mapping for Excel import:
   * A = 0: PO ID
   * B = 1: Date (YYYYMMDD)
   * C = 2: Vendor code
   * D = 3: Vendor name
   * E = 4: Receiving area
   * F = 5: Del date / Delivery date (YYYYMMDD)
   * G = 6: Del periode / Delivery period
   * H = 7: Classification
   * I = 8: PO No
   * J = 9: Item
   * K = 10: Quantity
   * L = 11: Part No / FinishGoodId
   */
  private readonly COLUMN_MAP = {
    PO_ID: 0,
    DATE: 1,
    VENDOR_CODE: 2,
    VENDOR_NAME: 3,
    RECEIVING_AREA: 4,
    DEL_DATE: 5,
    DEL_PERIOD: 6,
    CLASSIFICATION: 7,
    PO_NO: 8,
    ITEM: 9,
    QUANTITY: 10,
    PART_NO: 11,
  };

  async findAll(query: ForecastQueryDto = { page: 1, limit: 50 }) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 50;
    const where: Prisma.ForecastWhereInput = {};

    if (query?.search) {
      where.OR = [
        { PoId: { contains: query.search, mode: 'insensitive' } },
        { FinishGoodId: { contains: query.search, mode: 'insensitive' } },
        { VendorName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query?.deliveryDateFrom || query?.deliveryDateTo) {
      where.DeliveryDate = {
        ...(query.deliveryDateFrom
          ? { gte: new Date(`${query.deliveryDateFrom}T00:00:00.000Z`) }
          : {}),
        ...(query.deliveryDateTo
          ? { lte: new Date(`${query.deliveryDateTo}T23:59:59.999Z`) }
          : {}),
      };
    }
    const [totalItems, data] = await Promise.all([
      this.prisma.forecast.count({ where }),
      this.prisma.forecast.findMany({
        where,
        include: {
          PartData: {
            select: {
              PartNumber: true,
              PartName: true,
            },
          },
        },
        orderBy: [{ DeliveryDate: 'desc' }, { Id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findOne(id: string) {
    // Try by numeric ID first
    const numericId = parseInt(id, 10);
    let forecast: ForecastModel | null = null;

    if (!isNaN(numericId)) {
      forecast = await this.prisma.forecast.findUnique({
        where: { Id: numericId },
        include: {
          PartData: {
            select: {
              PartNumber: true,
              PartName: true,
            },
          },
        },
      });
    }

    // If not found by ID, try by PoId
    if (!forecast) {
      forecast = await this.prisma.forecast.findUnique({
        where: { PoId: id },
        include: {
          PartData: {
            select: {
              PartNumber: true,
              PartName: true,
            },
          },
        },
      });
    }

    if (!forecast) {
      throw new NotFoundException(`Forecast with id ${id} not found`);
    }

    return forecast;
  }

  async create(dto: CreateForecastDto, createdBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'FORECAST_001',
        functionName: 'ForecastService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating forecast for PO: ${dto.poId}`,
        type: 'INFO',
        location: 'forecast.service.ts:75',
      });

      const result = await this.prisma.forecast.create({
        data: {
          PoId: dto.poId,
          Date: dto.date,
          VendorCode: dto.vendorCode,
          VendorName: dto.vendorName,
          ReceivingArea: dto.receivingArea,
          DeliveryDate: dto.deliveryDate,
          DeliveryPeriod: dto.deliveryPeriod,
          Classification: dto.classification,
          PoNumber: dto.poNumber,
          Item: dto.item,
          Qty: dto.qty,
          FinishGoodId: dto.finishGoodId,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Forecast created successfully with ID: ${result.Id}`,
        type: 'INFO',
        location: 'forecast.service.ts:93',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'forecast.service.ts:104',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async printTag(id: string, requestedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'FORECAST_005',
        functionName: 'ForecastService.PrintTag',
        createdBy: requestedBy,
      });

      const forecast = await this.prisma.forecast.findUnique({
        where: { PoId: id },
        include: {
          PartData: {
            include: {
              BoxQTY: true,
            },
          },
        },
      });

      if (!forecast) {
        throw new NotFoundException(`Forecast with PoId ${id} not found`);
      }

      const qtyPerbox = forecast.PartData?.BoxQTY?.Qty ?? forecast.Qty;

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Emitting manual print tag for PO: ${forecast.PoId}`,
        type: 'INFO',
        location: 'forecast.service.ts:503',
      });

      // Emit immediately without transaction coupling, matching the requirement
      await this.printerService.printPartTagAnsei({
        poId: forecast.PoId,
        qtyOrder: forecast.Qty,
        partNumber: forecast.PartData?.PartNumber ?? '',
        partName: forecast.PartData?.PartName ?? '',
        vendorCode: forecast.VendorCode,
        classificationCode: forecast.Classification,
        deliveryDate: forecast.DeliveryDate,
        qtyPerbox,
        poNumber: forecast.PoNumber,
        receivingArea: forecast.ReceivingArea,
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return {
        message: 'Data PO ditemukan, proses pencetakan akan dilakukan segera',
        poId: forecast.PoId,
        qtyOrder: forecast.Qty,
        partNumber: forecast.PartData?.PartNumber ?? '',
        partName: forecast.PartData?.PartName ?? '',
        vendorCode: forecast.VendorCode,
        classificationCode: forecast.Classification,
        deliveryDate: forecast.DeliveryDate,
        qtyPerbox,
        poNumber: forecast.PoNumber,
        receivingArea: forecast.ReceivingArea,
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'forecast.service.ts:544',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateForecastDto, updatedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'FORECAST_002',
        functionName: 'ForecastService.Update',
        createdBy: updatedBy,
      });

      const processId = logProcess.ProcessId;
      return await this.prisma.$transaction(async (tx) => {
        await lockProductionFlow(tx);
        // Try to find by ID or PoId
        const numericId = parseInt(id, 10);
        const existing = !isNaN(numericId)
          ? await tx.forecast.findUnique({ where: { Id: numericId } })
          : await tx.forecast.findUnique({ where: { PoId: id } });

        if (!existing) {
          throw new NotFoundException(`Forecast with id ${id} not found`);
        }

        await this.assertForecastEditable(tx, existing);
        const nextQty = dto.qty ?? existing.Qty;
        if (!Number.isInteger(nextQty) || nextQty <= 0) {
          throw new BadRequestException(
            'Forecast quantity must be a positive integer.',
          );
        }
        const release = existing.ProductionReleaseId
          ? await tx.productionRelease.findUnique({
              where: { Id: existing.ProductionReleaseId },
            })
          : null;
        const previousLabel = await tx.labelData.findFirst({
          where: { ForecastId: existing.PoId },
          select: { RequiresAssembly: true },
        });
        const labelsChanged =
          (dto.poId !== undefined && dto.poId !== existing.PoId) ||
          (dto.qty !== undefined && dto.qty !== existing.Qty) ||
          (dto.finishGoodId !== undefined &&
            dto.finishGoodId !== existing.FinishGoodId);
        if (labelsChanged) {
          await tx.labelData.deleteMany({
            where: { ForecastId: existing.PoId },
          });
        }

        await this.logService.addLog({
          processId,
          message: `Updating forecast ${existing.PoId}`,
          type: 'INFO',
          location: 'forecast.service.ts:131',
          client: tx,
        });

        const updateData: Prisma.ForecastUncheckedUpdateInput = {};
        if (dto.poId !== undefined) updateData.PoId = dto.poId;
        if (dto.date !== undefined) updateData.Date = dto.date;
        if (dto.vendorCode !== undefined)
          updateData.VendorCode = dto.vendorCode;
        if (dto.vendorName !== undefined)
          updateData.VendorName = dto.vendorName;
        if (dto.receivingArea !== undefined)
          updateData.ReceivingArea = dto.receivingArea;
        if (dto.deliveryDate !== undefined)
          updateData.DeliveryDate = dto.deliveryDate;
        if (dto.deliveryPeriod !== undefined)
          updateData.DeliveryPeriod = dto.deliveryPeriod;
        if (dto.classification !== undefined)
          updateData.Classification = dto.classification;
        if (dto.poNumber !== undefined) updateData.PoNumber = dto.poNumber;
        if (dto.item !== undefined) updateData.Item = dto.item;
        if (dto.qty !== undefined) updateData.Qty = dto.qty;
        if (dto.finishGoodId !== undefined)
          updateData.FinishGoodId = dto.finishGoodId;

        const result = await tx.forecast.update({
          where: { Id: existing.Id },
          data: updateData,
        });

        if (release) {
          if (labelsChanged && release.Status === ProductionStatus.RELEASED) {
            const box = await tx.boxQTY.findUnique({
              where: { PartNumber: result.FinishGoodId },
            });
            if (!box || box.Qty <= 0) {
              throw new BadRequestException(
                'Box Qty must be configured with a value greater than 0.',
              );
            }
            await tx.labelData.createMany({
              data: buildProductionLabels(
                result,
                release.Id,
                box.Qty,
                result.FinishGoodId === existing.FinishGoodId &&
                  previousLabel?.RequiresAssembly != null
                  ? previousLabel.RequiresAssembly
                  : !(
                      await tx.finishGood.findUniqueOrThrow({
                        where: { PartNumber: result.FinishGoodId },
                      })
                    ).IsPassthrough,
              ),
            });
          }
          const total = await tx.forecast.aggregate({
            where: { ProductionReleaseId: release.Id },
            _sum: { Qty: true },
          });
          await tx.productionRelease.update({
            where: { Id: release.Id },
            data: { TotalTargetQty: total._sum.Qty ?? 0 },
          });
        }

        await this.logService.addLog({
          processId,
          message: `Forecast updated successfully: ${result.PoId}`,
          type: 'INFO',
          location: 'forecast.service.ts:156',
          client: tx,
        });

        await this.logService.completeProcess(
          processId,
          'SUCCESS',
          undefined,
          tx,
        );

        return result;
      });
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
        functionId: 'FORECAST_003',
        functionName: 'ForecastService.Delete',
        createdBy: deletedBy,
      });

      const processId = logProcess.ProcessId;
      return await this.prisma.$transaction(async (tx) => {
        await lockProductionFlow(tx);
        const numericId = parseInt(id, 10);
        const existing = !isNaN(numericId)
          ? await tx.forecast.findUnique({ where: { Id: numericId } })
          : await tx.forecast.findUnique({ where: { PoId: id } });

        if (!existing) {
          throw new NotFoundException(`Forecast with id ${id} not found`);
        }
        await this.assertForecastEditable(tx, existing);
        if (existing.ProductionReleaseId) {
          throw new ConflictException(
            'Untag the forecast from its production release before deleting it.',
          );
        }

        await this.logService.addLog({
          processId,
          message: `Deleting forecast ${existing.PoId}`,
          type: 'INFO',
          location: 'forecast.service.ts:183',
          client: tx,
        });

        await tx.forecast.delete({
          where: { Id: existing.Id },
        });

        await this.logService.completeProcess(
          processId,
          'SUCCESS',
          undefined,
          tx,
        );

        return { deleted: true, id: existing.Id };
      });
    } catch (error) {
      if (logProcess) {
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  private async assertForecastEditable(
    tx: Prisma.TransactionClient,
    forecast: ForecastModel,
  ) {
    const activity = await tx.forecast.findUniqueOrThrow({
      where: { Id: forecast.Id },
      include: {
        ProductionRelease: true,
        ShoppingCompletion: true,
        _count: {
          select: {
            Shopping: true,
            DeliveryHistory: true,
            ProductionReport: true,
          },
        },
        LabelData: {
          select: {
            Scanned: true,
            _count: {
              select: { PokayokeHistory: true, AssemblySessions: true },
            },
          },
        },
      },
    });
    if (
      activity.ProductionRelease &&
      activity.ProductionRelease.Status !== ProductionStatus.DRAFT &&
      activity.ProductionRelease.Status !== ProductionStatus.RELEASED
    ) {
      throw new ConflictException(
        'Forecast in a completed or cancelled release cannot be changed.',
      );
    }
    const scanHistoryCount = await tx.pokayokeScanHistory.count({
      where: { PoId: forecast.PoId },
    });
    if (
      activity._count.Shopping > 0 ||
      activity._count.DeliveryHistory > 0 ||
      activity._count.ProductionReport > 0 ||
      activity.ShoppingCompletion ||
      scanHistoryCount > 0 ||
      activity.LabelData.some(
        (label) =>
          label.Scanned ||
          label._count.PokayokeHistory > 0 ||
          label._count.AssemblySessions > 0,
      )
    ) {
      throw new ConflictException(
        'Forecast has operational activity and cannot be changed or deleted.',
      );
    }
  }

  /**
   * Import forecast data from Excel file.
   * Reads columns by position (A=0, B=1, C=2, etc.) instead of header names.
   */
  async importExcel(file: Express.Multer.File, importedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'FORECAST_004',
        functionName: 'ForecastService.ImportExcel',
        createdBy: importedBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting Excel import for forecast data`,
        type: 'INFO',
        location: 'forecast.service.ts:215',
      });

      validateUploadContent(file, ['xlsx']);

      // Read Excel by column position
      const rawData = await this.excelService.readExcelByPosition(file);

      // Filter out empty rows (rows where all values are empty strings)
      const filteredData = rawData.filter((row: ForecastExcelRow) => {
        return Object.values(row).some(
          (val) => val !== undefined && String(val).trim() !== '',
        );
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Read ${rawData.length} rows from Excel file, ${filteredData.length} non-empty rows after filtering`,
        type: 'INFO',
        location: 'forecast.service.ts:221',
      });

      if (filteredData.length === 0) {
        throw new BadRequestException(
          'Excel file is empty or has no data rows',
        );
      }

      // Transform data based on column position
      const transformedData = filteredData.map((rowData: ForecastExcelRow) => {
        const poId = String(rowData[this.COLUMN_MAP.PO_ID] ?? '').trim();
        const dateVal = rowData[this.COLUMN_MAP.DATE];
        const vendorCode = String(
          rowData[this.COLUMN_MAP.VENDOR_CODE] ?? '',
        ).trim();
        const vendorName = String(
          rowData[this.COLUMN_MAP.VENDOR_NAME] ?? '',
        ).trim();
        const receivingArea = String(
          rowData[this.COLUMN_MAP.RECEIVING_AREA] ?? '',
        ).trim();
        const delDateVal = rowData[this.COLUMN_MAP.DEL_DATE];
        const deliveryPeriod =
          parseInt(String(rowData[this.COLUMN_MAP.DEL_PERIOD] ?? '0'), 10) || 0;
        const classification = String(
          rowData[this.COLUMN_MAP.CLASSIFICATION] ?? '',
        ).trim();
        const poNumber = String(rowData[this.COLUMN_MAP.PO_NO] ?? '').trim();
        const item =
          parseInt(String(rowData[this.COLUMN_MAP.ITEM] ?? '0'), 10) || 0;
        const qty =
          parseInt(String(rowData[this.COLUMN_MAP.QUANTITY] ?? '0'), 10) || 0;
        const finishGoodId = String(
          rowData[this.COLUMN_MAP.PART_NO] ?? '',
        ).trim();

        // Validate required fields
        if (!poId) {
          throw new BadRequestException('PO ID is required in column A');
        }

        return {
          poId,
          date: dateVal
            ? this.excelService.parseDateYYYYMMDD(dateVal)
            : new Date(),
          vendorCode,
          vendorName,
          receivingArea,
          deliveryDate: delDateVal
            ? this.excelService.parseDateYYYYMMDD(delDateVal)
            : new Date(),
          deliveryPeriod,
          classification,
          poNumber,
          item,
          qty,
          finishGoodId,
        };
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Transformed ${transformedData.length} forecast records`,
        type: 'INFO',
        location: 'forecast.service.ts:269',
      });

      // POKAYOKE: Validate all FinishGoodId exist in FinishGood master
      await this.validateFinishGoodsExist(
        transformedData,
        logProcess.ProcessId,
      );

      // Create forecast records with skipDuplicates
      const result = await this.prisma.forecast.createMany({
        data: transformedData.map((d) => ({
          PoId: d.poId,
          Date: d.date,
          VendorCode: d.vendorCode,
          VendorName: d.vendorName,
          ReceivingArea: d.receivingArea,
          DeliveryDate: d.deliveryDate,
          DeliveryPeriod: d.deliveryPeriod,
          Classification: d.classification,
          PoNumber: d.poNumber,
          Item: d.item,
          Qty: d.qty,
          FinishGoodId: d.finishGoodId,
        })),
        skipDuplicates: true,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Created ${result.count} forecast records (${transformedData.length - result.count} skipped as duplicates)`,
        type: 'INFO',
        location: 'forecast.service.ts:288',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return {
        total: transformedData.length,
        created: result.count,
        skipped: transformedData.length - result.count,
      };
    } catch (error) {
      if (logProcess) {
        const userFriendlyMessage = formatErrorMessage(error);

        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${userFriendlyMessage}`,
          type: 'ERROR',
          location: 'forecast.service.ts:303',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Get forecast for next 2 days (for AI/operator dashboard)
   */
  async findForAI() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.forecast.findMany({
      select: {
        PoId: true,
        FinishGoodId: true,
        Qty: true,
        DeliveryDate: true,
      },
      where: {
        DeliveryDate: {
          gte: new Date(),
          lt: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), // Next 2 days
        },
      },
      orderBy: {
        DeliveryDate: 'asc',
      },
    });
  }

  /**
   * Get forecast for operator view (next 14 days)
   * Only returns forecasts where ProductionRelease status is RELEASED
   */
  async findForOperator() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

    return this.prisma.forecast.findMany({
      include: {
        PartData: {
          select: {
            PartNumber: true,
            PartName: true,
          },
        },
        Shopping: {
          select: {
            ForecastId: true,
          },
        },
        ProductionRelease: {
          select: {
            Id: true,
            Status: true,
          },
        },
      },
      where: {
        DeliveryDate: {
          gte: today,
          lt: twoWeeksLater,
        },
        ProductionRelease: {
          Status: ProductionStatus.RELEASED,
        },
      },
      orderBy: {
        DeliveryDate: 'asc',
      },
      // take: 1600,
    });
  }

  /**
   * POKAYOKE: Validate that all FinishGoodId (PartNumber) exist in FinishGood master
   */
  private async validateFinishGoodsExist(
    data: Array<{ finishGoodId: string; poId: string }>,
    processId: string,
  ): Promise<void> {
    const finishGoodIds = data
      .map((d) => d.finishGoodId)
      .filter((id) => id !== '');

    if (finishGoodIds.length === 0) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE WARNING: No FinishGoodId found in data`,
        type: 'WARN',
        location: 'forecast.service.ts:510',
      });
      return;
    }

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: Validating ${finishGoodIds.length} unique FinishGood IDs`,
      type: 'INFO',
      location: 'forecast.service.ts:517',
    });

    const existingFinishGoods = await this.prisma.finishGood.findMany({
      where: { PartNumber: { in: finishGoodIds } },
      select: { PartNumber: true },
    });

    const existingIds = new Set(existingFinishGoods.map((fg) => fg.PartNumber));

    const missingFinishGoods: string[] = [];
    for (const fgId of finishGoodIds) {
      if (!existingIds.has(fgId)) {
        missingFinishGoods.push(fgId);
      }
    }

    if (missingFinishGoods.length > 0) {
      const uniqueMissing = [...new Set(missingFinishGoods)];
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: FinishGood IDs ${uniqueMissing.join(', ')} not found in FinishGood master`,
        type: 'ERROR',
        location: 'forecast.service.ts:536',
      });

      throw new BadRequestException(
        `POKAYOKE: FinishGood PartNumber(s) ${uniqueMissing.join(', ')} not found in FinishGood master. Please check the Part Number data.`,
      );
    }

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: All ${finishGoodIds.length} FinishGood IDs validated successfully`,
      type: 'INFO',
      location: 'forecast.service.ts:544',
    });
  }
}
