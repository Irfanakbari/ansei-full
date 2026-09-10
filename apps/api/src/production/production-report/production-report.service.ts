import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import {
  CreateProductionReportDto,
  UpdateProductionReportDto,
  ProductionReportQueryDto,
} from './dto';
import type { LogProcessModel } from '../../generated/prisma/models';

@Injectable()
export class ProductionReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async findAll(query: ProductionReportQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;

    const where: any = {};

    if (query.date) {
      where.Date = query.date;
    }

    if (query.manPowerUid) {
      where.ManPowerUid = query.manPowerUid;
    }

    if (query.finishGoodId) {
      where.FinishGoodId = query.finishGoodId;
    }

    if (query.recordType) {
      where.RecordType = query.recordType;
    }

    if (query.isValidated !== undefined) {
      if (query.isValidated) {
        where.ValidatedAt = { not: null };
      } else {
        where.ValidatedAt = null;
      }
    }

    const [total, data] = await Promise.all([
      this.prisma.productionReport.count({ where }),
      this.prisma.productionReport.findMany({
        where,
        include: {
          ManPowerData: {
            select: {
              Uid: true,
              Nik: true,
              Name: true,
            },
          },
          FGData: {
            select: {
              PartNumber: true,
              PartName: true,
            },
          },
        },
        orderBy: { ProductionStamp: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      data: data.map((item) => ({
        id: item.Id,
        date: item.Date,
        time: item.Time,
        productionStamp: item.ProductionStamp,
        ngQty: item.NgQty,
        startTime: item.StartTime,
        startStamp: item.StartStamp,
        endTime: item.EndTime,
        endStamp: item.EndStamp,
        stopMinute: item.StopMinute,
        latchDate: item.LatchDate,
        cableHDate: item.CableHDate,
        cableLDate: item.CableLDate,
        coverDate: item.CoverDate,
        rodDate: item.RodDate,
        sponsDate: item.SponsDate,
        sponsRearDate: item.SponsRearDate,
        clipDate: item.ClipDate,
        leverDate: item.LeverDate,
        smallPadDate: item.SmallPadDate,
        actuatorDate: item.ActuatorDate,
        backPlateDate: item.BackPlateDate,
        stampDate: item.StampDate,
        poNumber: item.PoNumber,
        createdAt: item.CreatedAt,
        updatedAt: item.UpdatedAt,
        validatedAt: item.ValidatedAt,
        validatedBy: item.ValidatedBy,
        recordType: item.RecordType,
        qty: item.Qty,
        manPowerUid: item.ManPowerUid,
        finishGoodId: item.FinishGoodId,
        manPowerData: item.ManPowerData,
        fgData: item.FGData,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const result = await this.prisma.productionReport.findUnique({
      where: { Id: id },
      include: {
        ManPowerData: {
          select: {
            Uid: true,
            Nik: true,
            Name: true,
          },
        },
        FGData: {
          select: {
            PartNumber: true,
            PartName: true,
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException(`ProductionReport with id ${id} not found`);
    }

    return result;
  }

  async create(dto: CreateProductionReportDto, createdBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PROD_REPORT_001',
        functionName: 'ProductionReportService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting create production report: ManPower=${dto.manPowerUid}, FinishGood=${dto.finishGoodId}, Qty=${dto.qty}`,
        type: 'INFO',
        location: 'production-report.service.ts:120',
      });

      // POKAYOKE 1: Validate ManPower exists
      await this.validateManPowerExists(dto.manPowerUid, logProcess.ProcessId);

      // POKAYOKE 2: Validate FinishGood exists
      await this.validateFinishGoodExists(
        dto.finishGoodId,
        logProcess.ProcessId,
      );

      // POKAYOKE 3: Validate record doesn't already exist (unique constraint)
      await this.validateRecordNotExists(dto, logProcess.ProcessId);

      // POKAYOKE 4: Validate FinishGood is in a RELEASED ProductionRelease
      await this.validateFinishGoodInReleasedProduction(
        dto.finishGoodId,
        logProcess.ProcessId,
      );

      // Build data for creation
      const createData = this.buildCreateData(dto);

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating production report with data: Date=${dto.date}, RecordType=${dto.recordType}`,
        type: 'INFO',
        location: 'production-report.service.ts:145',
      });

      const result = await this.prisma.productionReport.create({
        data: createData,
        include: {
          ManPowerData: {
            select: {
              Uid: true,
              Nik: true,
              Name: true,
            },
          },
          FGData: {
            select: {
              PartNumber: true,
              PartName: true,
            },
          },
        },
      });

      // POKAYOKE 5: After creation, update ProductionRelease totals
      await this.updateProductionReleaseTotals(
        dto.finishGoodId,
        dto.qty,
        dto.ngQty ?? 0,
        logProcess.ProcessId,
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Production report created successfully: ID=${result.Id}, Qty=${result.Qty}, NgQty=${result.NgQty}`,
        type: 'INFO',
        location: 'production-report.service.ts:168',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'production-report.service.ts:182',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateProductionReportDto, updatedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PROD_REPORT_002',
        functionName: 'ProductionReportService.Update',
        createdBy: updatedBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting update production report ID: ${id}`,
        type: 'INFO',
        location: 'production-report.service.ts:200',
      });

      // POKAYOKE: Check if record exists
      const existing = await this.prisma.productionReport.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`ProductionReport with id ${id} not found`);
      }

      // POKAYOKE: Cannot update validated record
      if (existing.ValidatedAt) {
        throw new BadRequestException(
          `POKAYOKE FAILED: Cannot update validated production report. Please unvalidate first.`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating production report: OldQty=${existing.Qty}, OldNgQty=${existing.NgQty}`,
        type: 'INFO',
        location: 'production-report.service.ts:220',
      });

      // Build update data
      const updateData = this.buildUpdateData(dto);

      const result = await this.prisma.productionReport.update({
        where: { Id: id },
        data: updateData,
        include: {
          ManPowerData: {
            select: {
              Uid: true,
              Nik: true,
              Name: true,
            },
          },
          FGData: {
            select: {
              PartNumber: true,
              PartName: true,
            },
          },
        },
      });

      // Update ProductionRelease totals if qty changed
      if (dto.qty !== undefined || dto.ngQty !== undefined) {
        const newQty = dto.qty ?? existing.Qty;
        const newNgQty = dto.ngQty ?? existing.NgQty;
        const oldQty = existing.Qty;
        const oldNgQty = existing.NgQty;

        await this.updateProductionReleaseTotalsWithDiff(
          existing.FinishGoodId,
          newQty - oldQty,
          newNgQty - oldNgQty,
          logProcess.ProcessId,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Production report updated: ID=${result.Id}, Qty=${result.Qty}, NgQty=${result.NgQty}`,
        type: 'INFO',
        location: 'production-report.service.ts:248',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'production-report.service.ts:262',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async remove(id: number, deletedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PROD_REPORT_003',
        functionName: 'ProductionReportService.Delete',
        createdBy: deletedBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting delete production report ID: ${id}`,
        type: 'INFO',
        location: 'production-report.service.ts:280',
      });

      const existing = await this.prisma.productionReport.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`ProductionReport with id ${id} not found`);
      }

      // POKAYOKE: Cannot delete validated record
      if (existing.ValidatedAt) {
        throw new BadRequestException(
          `POKAYOKE FAILED: Cannot delete validated production report. Please unvalidate first.`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting production report: Qty=${existing.Qty}, NgQty=${existing.NgQty}, FinishGood=${existing.FinishGoodId}`,
        type: 'INFO',
        location: 'production-report.service.ts:298',
      });

      // Update ProductionRelease totals before deletion
      await this.updateProductionReleaseTotalsWithDiff(
        existing.FinishGoodId,
        -existing.Qty,
        -existing.NgQty,
        logProcess.ProcessId,
      );

      await this.prisma.productionReport.delete({
        where: { Id: id },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Production report deleted successfully: ID=${id}`,
        type: 'INFO',
        location: 'production-report.service.ts:316',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'production-report.service.ts:330',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async validateReport(id: number, validatedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PROD_REPORT_004',
        functionName: 'ProductionReportService.Validate',
        createdBy: validatedBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting validate production report ID: ${id}`,
        type: 'INFO',
        location: 'production-report.service.ts:350',
      });

      const existing = await this.prisma.productionReport.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`ProductionReport with id ${id} not found`);
      }

      // POKAYOKE: Check if already validated
      if (existing.ValidatedAt) {
        throw new BadRequestException(
          `POKAYOKE FAILED: Production report is already validated at ${existing.ValidatedAt.toISOString()}`,
        );
      }

      // POKAYOKE: Validate that FinishGood is still in a RELEASED ProductionRelease
      await this.validateFinishGoodInReleasedProduction(
        existing.FinishGoodId,
        logProcess.ProcessId,
      );

      const now = new Date();

      const result = await this.prisma.productionReport.update({
        where: { Id: id },
        data: {
          ValidatedAt: now,
          ValidatedBy: validatedBy,
        },
        include: {
          ManPowerData: {
            select: {
              Uid: true,
              Nik: true,
              Name: true,
            },
          },
          FGData: {
            select: {
              PartNumber: true,
              PartName: true,
            },
          },
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Production report validated successfully: ID=${id}, ValidatedBy=${validatedBy}`,
        type: 'INFO',
        location: 'production-report.service.ts:392',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'production-report.service.ts:406',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async unvalidateReport(id: number, unvalidatedBy: string) {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PROD_REPORT_005',
        functionName: 'ProductionReportService.Unvalidate',
        createdBy: unvalidatedBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting unvalidate production report ID: ${id}`,
        type: 'INFO',
        location: 'production-report.service.ts:425',
      });

      const existing = await this.prisma.productionReport.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`ProductionReport with id ${id} not found`);
      }

      // POKAYOKE: Check if already unvalidated
      if (!existing.ValidatedAt) {
        throw new BadRequestException(
          `POKAYOKE FAILED: Production report is not validated yet`,
        );
      }

      const result = await this.prisma.productionReport.update({
        where: { Id: id },
        data: {
          ValidatedAt: null,
          ValidatedBy: null,
        },
        include: {
          ManPowerData: {
            select: {
              Uid: true,
              Nik: true,
              Name: true,
            },
          },
          FGData: {
            select: {
              PartNumber: true,
              PartName: true,
            },
          },
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Production report unvalidated successfully: ID=${id}`,
        type: 'INFO',
        location: 'production-report.service.ts:460',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'production-report.service.ts:474',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  // ========== POKAYOKE VALIDATION HELPERS ==========
  private async validateManPowerExists(
    manPowerUid: string,
    processId: string,
  ): Promise<void> {
    const manPower = await this.prisma.manPower.findUnique({
      where: { Uid: manPowerUid },
      select: { Uid: true, Nik: true, Name: true },
    });

    if (!manPower) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: ManPower ${manPowerUid} not found in ManPower master`,
        type: 'ERROR',
        location: 'production-report.service.ts:500',
      });
      throw new BadRequestException(
        `POKAYOKE: ManPower with UID ${manPowerUid} not found in ManPower master`,
      );
    }

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: ManPower validated - ${manPower.Nik} (${manPower.Name})`,
      type: 'INFO',
      location: 'production-report.service.ts:512',
    });
  }

  private async validateFinishGoodExists(
    finishGoodId: string,
    processId: string,
  ): Promise<void> {
    const finishGood = await this.prisma.finishGood.findUnique({
      where: { PartNumber: finishGoodId },
      select: { PartNumber: true, PartName: true },
    });

    if (!finishGood) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: FinishGood ${finishGoodId} not found in FinishGood master`,
        type: 'ERROR',
        location: 'production-report.service.ts:528',
      });
      throw new BadRequestException(
        `POKAYOKE: FinishGood with PartNumber ${finishGoodId} not found in FinishGood master`,
      );
    }

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: FinishGood validated - ${finishGood.PartNumber} (${finishGood.PartName})`,
      type: 'INFO',
      location: 'production-report.service.ts:540',
    });
  }

  private async validateRecordNotExists(
    dto: CreateProductionReportDto,
    processId: string,
  ): Promise<void> {
    // Check for duplicate record based on unique constraint: Date, ManPowerUid, FinishGoodId, CreatedAt
    const existing = await this.prisma.productionReport.findFirst({
      where: {
        Date: dto.date,
        ManPowerUid: dto.manPowerUid,
        FinishGoodId: dto.finishGoodId,
      },
    });

    if (existing) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: Duplicate record found for Date=${dto.date}, ManPower=${dto.manPowerUid}, FinishGood=${dto.finishGoodId}`,
        type: 'ERROR',
        location: 'production-report.service.ts:560',
      });
      throw new BadRequestException(
        `POKAYOKE: Production report already exists for Date=${dto.date}, ManPower=${dto.manPowerUid}, FinishGood=${dto.finishGoodId}. Duplicate not allowed.`,
      );
    }

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: No duplicate record found`,
      type: 'INFO',
      location: 'production-report.service.ts:572',
    });
  }

  private async validateFinishGoodInReleasedProduction(
    finishGoodId: string,
    processId: string,
  ): Promise<void> {
    // Check if there's an active (RELEASED) ProductionRelease containing this FinishGood
    const activeRelease = await this.prisma.productionRelease.findFirst({
      where: {
        Status: 'RELEASED',
        Forecasts: {
          some: {
            FinishGoodId: finishGoodId,
          },
        },
      },
      select: {
        ReleaseNumber: true,
        PlanDate: true,
      },
    });

    if (!activeRelease) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: FinishGood ${finishGoodId} is not in any RELEASED ProductionRelease`,
        type: 'ERROR',
        location: 'production-report.service.ts:598',
      });
      throw new BadRequestException(
        `POKAYOKE: FinishGood ${finishGoodId} is not scheduled in any RELEASED production release. Cannot create production report.`,
      );
    }

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: FinishGood ${finishGoodId} is in RELEASED ProductionRelease ${activeRelease.ReleaseNumber}`,
      type: 'INFO',
      location: 'production-report.service.ts:610',
    });
  }

  // ========== HELPER METHODS ==========
  private buildCreateData(dto: CreateProductionReportDto) {
    return {
      Date: dto.date,
      Time: dto.time,
      ProductionStamp: new Date(dto.productionStamp),
      NgQty: dto.ngQty ?? 0,
      StartTime: dto.startTime,
      StartStamp: dto.startStamp ? new Date(dto.startStamp) : null,
      EndTime: dto.endTime,
      EndStamp: dto.endStamp ? new Date(dto.endStamp) : null,
      StopMinute: dto.stopMinute ?? 0,
      LatchDate: dto.latchDate,
      CableHDate: dto.cableHDate,
      CableLDate: dto.cableLDate,
      CoverDate: dto.coverDate,
      RodDate: dto.rodDate,
      SponsDate: dto.sponsDate,
      SponsRearDate: dto.sponsRearDate,
      ClipDate: dto.clipDate,
      LeverDate: dto.leverDate,
      SmallPadDate: dto.smallPadDate,
      ActuatorDate: dto.actuatorDate,
      BackPlateDate: dto.backPlateDate,
      StampDate: dto.stampDate,
      PoNumber: dto.poNumber,
      RecordType: dto.recordType,
      Qty: dto.qty,
      ManPowerUid: dto.manPowerUid,
      FinishGoodId: dto.finishGoodId,
    };
  }

  private buildUpdateData(dto: UpdateProductionReportDto) {
    const data: any = {};

    if (dto.date !== undefined) data.Date = dto.date;
    if (dto.time !== undefined) data.Time = dto.time;
    if (dto.productionStamp !== undefined)
      data.ProductionStamp = new Date(dto.productionStamp);
    if (dto.ngQty !== undefined) data.NgQty = dto.ngQty;
    if (dto.startTime !== undefined) data.StartTime = dto.startTime;
    if (dto.startStamp !== undefined)
      data.StartStamp = dto.startStamp ? new Date(dto.startStamp) : null;
    if (dto.endTime !== undefined) data.EndTime = dto.endTime;
    if (dto.endStamp !== undefined)
      data.EndStamp = dto.endStamp ? new Date(dto.endStamp) : null;
    if (dto.stopMinute !== undefined) data.StopMinute = dto.stopMinute;
    if (dto.latchDate !== undefined) data.LatchDate = dto.latchDate;
    if (dto.cableHDate !== undefined) data.CableHDate = dto.cableHDate;
    if (dto.cableLDate !== undefined) data.CableLDate = dto.cableLDate;
    if (dto.coverDate !== undefined) data.CoverDate = dto.coverDate;
    if (dto.rodDate !== undefined) data.RodDate = dto.rodDate;
    if (dto.sponsDate !== undefined) data.SponsDate = dto.sponsDate;
    if (dto.sponsRearDate !== undefined) data.SponsRearDate = dto.sponsRearDate;
    if (dto.clipDate !== undefined) data.ClipDate = dto.clipDate;
    if (dto.leverDate !== undefined) data.LeverDate = dto.leverDate;
    if (dto.smallPadDate !== undefined) data.SmallPadDate = dto.smallPadDate;
    if (dto.actuatorDate !== undefined) data.ActuatorDate = dto.actuatorDate;
    if (dto.backPlateDate !== undefined) data.BackPlateDate = dto.backPlateDate;
    if (dto.stampDate !== undefined) data.StampDate = dto.stampDate;
    if (dto.poNumber !== undefined) data.PoNumber = dto.poNumber;
    if (dto.recordType !== undefined) data.RecordType = dto.recordType;
    if (dto.qty !== undefined) data.Qty = dto.qty;

    return data;
  }

  private async updateProductionReleaseTotals(
    finishGoodId: string,
    goodQty: number,
    ngQty: number,
    processId: string,
  ) {
    // Find RELEASED ProductionRelease containing this FinishGood
    const release = await this.prisma.productionRelease.findFirst({
      where: {
        Status: 'RELEASED',
        Forecasts: {
          some: {
            FinishGoodId: finishGoodId,
          },
        },
      },
    });

    if (!release) {
      await this.logService.addLog({
        processId,
        message: `WARNING: No RELEASED ProductionRelease found for FinishGood ${finishGoodId}, skipping totals update`,
        type: 'WARN',
        location: 'production-report.service.ts:690',
      });
      return;
    }

    await this.prisma.productionRelease.update({
      where: { Id: release.Id },
      data: {
        TotalGoodQty: { increment: goodQty },
        TotalNgQty: { increment: ngQty },
      },
    });

    await this.logService.addLog({
      processId,
      message: `Updated ProductionRelease ${release.ReleaseNumber} totals: +GoodQty=${goodQty}, +NgQty=${ngQty}`,
      type: 'INFO',
      location: 'production-report.service.ts:706',
    });
  }

  private async updateProductionReleaseTotalsWithDiff(
    finishGoodId: string,
    goodQtyDiff: number,
    ngQtyDiff: number,
    processId: string,
  ) {
    // Find RELEASED ProductionRelease containing this FinishGood
    const release = await this.prisma.productionRelease.findFirst({
      where: {
        Status: 'RELEASED',
        Forecasts: {
          some: {
            FinishGoodId: finishGoodId,
          },
        },
      },
    });

    if (!release) {
      await this.logService.addLog({
        processId,
        message: `WARNING: No RELEASED ProductionRelease found for FinishGood ${finishGoodId}, skipping totals update`,
        type: 'WARN',
        location: 'production-report.service.ts:728',
      });
      return;
    }

    await this.prisma.productionRelease.update({
      where: { Id: release.Id },
      data: {
        TotalGoodQty: { increment: goodQtyDiff },
        TotalNgQty: { increment: ngQtyDiff },
      },
    });

    await this.logService.addLog({
      processId,
      message: `Updated ProductionRelease ${release.ReleaseNumber} totals: GoodQty=${goodQtyDiff >= 0 ? '+' : ''}${goodQtyDiff}, NgQty=${ngQtyDiff >= 0 ? '+' : ''}${ngQtyDiff}`,
      type: 'INFO',
      location: 'production-report.service.ts:744',
    });
  }
}
