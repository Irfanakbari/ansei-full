import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { CreatePrinterSettingDto, UpdatePrinterSettingDto } from './dto';
import type {
  LogProcessModel,
  PrinterSettingModel,
} from '../../generated/prisma/models';
import type { Prisma } from '../../generated/prisma/client';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';

@Injectable()
export class PrinterSettingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async findAll(query: SearchPaginationQueryDto) {
    const where: Prisma.PrinterSettingWhereInput = query.search
      ? {
          OR: [
            { Name: { contains: query.search, mode: 'insensitive' } },
            { IpAddress: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [totalItems, data] = await Promise.all([
      this.prisma.printerSetting.count({ where }),
      this.prisma.printerSetting.findMany({
        where,
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

  async findOne(id: string): Promise<PrinterSettingModel> {
    const result = await this.prisma.printerSetting.findUnique({
      where: { Id: id },
    });

    if (!result) {
      throw new NotFoundException(`PrinterSetting with id ${id} not found`);
    }

    return result;
  }

  async findByIpAddress(ipAddress: string): Promise<PrinterSettingModel> {
    const result = await this.prisma.printerSetting.findUnique({
      where: { IpAddress: ipAddress },
    });

    if (!result) {
      throw new NotFoundException(
        `PrinterSetting with IP address ${ipAddress} not found`,
      );
    }

    return result;
  }

  async create(
    dto: CreatePrinterSettingDto,
    createdBy: string,
  ): Promise<PrinterSettingModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PRINTER_001',
        functionName: 'PrinterSettingService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating printer setting: ${dto.name ?? 'Unnamed'} (${dto.ipAddress})`,
        type: 'INFO',
        location: 'printer-setting.service.ts:45',
      });

      // Check if IP address already exists
      const existing = await this.prisma.printerSetting.findUnique({
        where: { IpAddress: dto.ipAddress },
      });

      if (existing) {
        throw new ConflictException(
          `PrinterSetting with IP address ${dto.ipAddress} already exists`,
        );
      }

      const result = await this.prisma.printerSetting.create({
        data: {
          Name: dto.name,
          IpAddress: dto.ipAddress,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `PrinterSetting created successfully with id: ${result.Id}`,
        type: 'INFO',
        location: 'printer-setting.service.ts:62',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'printer-setting.service.ts:74',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdatePrinterSettingDto,
    updatedBy: string,
  ): Promise<PrinterSettingModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PRINTER_002',
        functionName: 'PrinterSettingService.Update',
        createdBy: updatedBy,
      });

      const existing = await this.prisma.printerSetting.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`PrinterSetting with id ${id} not found`);
      }

      // Check if new IP address conflicts with existing
      if (dto.ipAddress && dto.ipAddress !== existing.IpAddress) {
        const ipConflict = await this.prisma.printerSetting.findUnique({
          where: { IpAddress: dto.ipAddress },
        });

        if (ipConflict) {
          throw new ConflictException(
            `PrinterSetting with IP address ${dto.ipAddress} already exists`,
          );
        }
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating printer setting id: ${id} with data: ${JSON.stringify(dto)}`,
        type: 'INFO',
        location: 'printer-setting.service.ts:104',
      });

      const result = await this.prisma.printerSetting.update({
        where: { Id: id },
        data: {
          Name: dto.name,
          IpAddress: dto.ipAddress,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `PrinterSetting updated successfully: ${result.Id}`,
        type: 'INFO',
        location: 'printer-setting.service.ts:119',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'printer-setting.service.ts:131',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async remove(
    id: string,
    deletedBy: string,
  ): Promise<{ deleted: boolean; id: string }> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'PRINTER_003',
        functionName: 'PrinterSettingService.Delete',
        createdBy: deletedBy,
      });

      const existing = await this.prisma.printerSetting.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`PrinterSetting with id ${id} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting printer setting id: ${id} (${existing.Name ?? existing.IpAddress})`,
        type: 'INFO',
        location: 'printer-setting.service.ts:151',
      });

      await this.prisma.printerSetting.delete({
        where: { Id: id },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `PrinterSetting deleted successfully: ${id}`,
        type: 'INFO',
        location: 'printer-setting.service.ts:159',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'printer-setting.service.ts:171',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
