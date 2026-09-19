import { auditedWrite } from '../../../common/helpers/audited-transaction.helper';
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LogProcessService } from '../../../common/log-process/log-process.service';
import { CreateBoxQtyDto, UpdateBoxQtyDto } from './dto';
import type {
  LogProcessModel,
  BoxQTYModel,
} from '../../../generated/prisma/models';

@Injectable()
export class BoxQtyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async findAll(): Promise<BoxQTYModel[]> {
    return this.prisma.boxQTY.findMany({
      include: {
        PartData: true,
      },
      orderBy: { Id: 'asc' },
    });
  }

  async findOne(id: number): Promise<BoxQTYModel> {
    const result = await this.prisma.boxQTY.findUnique({
      where: { Id: id },
      include: {
        PartData: true,
      },
    });

    if (!result) {
      throw new NotFoundException(`BoxQty with id ${id} not found`);
    }

    return result;
  }

  async findByPartNumber(partNumber: string): Promise<BoxQTYModel> {
    const result = await this.prisma.boxQTY.findUnique({
      where: { PartNumber: partNumber },
      include: {
        PartData: true,
      },
    });

    if (!result) {
      throw new NotFoundException(
        `BoxQty with part number ${partNumber} not found`,
      );
    }

    return result;
  }

  async create(dto: CreateBoxQtyDto, createdBy: string): Promise<BoxQTYModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'BOXQTY_001',
        functionName: 'BoxQtyService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating box qty for part number: ${dto.partNumber}`,
        type: 'INFO',
        location: 'box-qty.service.ts:45',
      });

      // Check if part number already exists
      const existing = await this.prisma.boxQTY.findUnique({
        where: { PartNumber: dto.partNumber },
      });

      if (existing) {
        throw new ConflictException(
          `BoxQty with part number ${dto.partNumber} already exists`,
        );
      }

      // Check if FinishGood exists
      const finishGood = await this.prisma.finishGood.findUnique({
        where: { PartNumber: dto.partNumber },
      });

      if (!finishGood) {
        throw new NotFoundException(
          `FinishGood with part number ${dto.partNumber} not found`,
        );
      }

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.boxQTY.create({
          data: {
            PartNumber: dto.partNumber,
            Qty: dto.qty,
          },
          include: {
            PartData: true,
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `BoxQty created successfully with id: ${result.Id}`,
        type: 'INFO',
        location: 'box-qty.service.ts:72',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'box-qty.service.ts:84',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateBoxQtyDto,
    createdBy: string,
  ): Promise<BoxQTYModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'BOXQTY_002',
        functionName: 'BoxQtyService.Update',
        createdBy,
      });

      const existing = await this.prisma.boxQTY.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`BoxQty with id ${id} not found`);
      }

      // Check if new part number conflicts with existing
      if (dto.partNumber && dto.partNumber !== existing.PartNumber) {
        const partNumberConflict = await this.prisma.boxQTY.findUnique({
          where: { PartNumber: dto.partNumber },
        });

        if (partNumberConflict) {
          throw new ConflictException(
            `BoxQty with part number ${dto.partNumber} already exists`,
          );
        }

        // Check if FinishGood exists for new part number
        const finishGood = await this.prisma.finishGood.findUnique({
          where: { PartNumber: dto.partNumber },
        });

        if (!finishGood) {
          throw new NotFoundException(
            `FinishGood with part number ${dto.partNumber} not found`,
          );
        }
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating box qty id: ${id} with data: ${JSON.stringify(dto)}`,
        type: 'INFO',
        location: 'box-qty.service.ts:120',
      });

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.boxQTY.update({
          where: { Id: id },
          data: {
            PartNumber: dto.partNumber,
            Qty: dto.qty,
          },
          include: {
            PartData: true,
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `BoxQty updated successfully: ${result.Id}`,
        type: 'INFO',
        location: 'box-qty.service.ts:136',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'box-qty.service.ts:148',
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
        functionId: 'BOXQTY_003',
        functionName: 'BoxQtyService.Delete',
        createdBy,
      });

      const existing = await this.prisma.boxQTY.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`BoxQty with id ${id} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting box qty id: ${id}`,
        type: 'INFO',
        location: 'box-qty.service.ts:169',
      });

      await auditedWrite(this.prisma, (tx) =>
        tx.boxQTY.delete({
          where: { Id: id },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `BoxQty deleted successfully: ${id}`,
        type: 'INFO',
        location: 'box-qty.service.ts:177',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'box-qty.service.ts:189',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
