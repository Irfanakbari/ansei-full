import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { CreateDisplayConfigDto, UpdateDisplayConfigDto } from './dto';
import type {
  LogProcessModel,
  DisplayConfigModel,
} from '../../generated/prisma/models';

@Injectable()
export class DisplayConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async findAll(): Promise<DisplayConfigModel[]> {
    return this.prisma.displayConfig.findMany({
      orderBy: { CreatedAt: 'desc' },
    });
  }

  async findActive(): Promise<DisplayConfigModel | null> {
    return this.prisma.displayConfig.findFirst({
      where: { IsOpen: true },
      orderBy: { CreatedAt: 'desc' },
    });
  }

  async create(
    dto: CreateDisplayConfigDto,
    createdBy: string,
  ): Promise<DisplayConfigModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'DISPLAY_001',
        functionName: 'DisplayConfigService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating display config: ${dto.description} (${dto.url})`,
        type: 'INFO',
        location: 'display-config.service.ts:36',
      });

      // If creating with isOpen = true, ensure no other display has isOpen = true
      if (dto.isOpen === true) {
        await this.ensureOnlyOneOpenDisplay(logProcess.ProcessId, null);
      }

      const result = await this.prisma.displayConfig.create({
        data: {
          Description: dto.description,
          Url: dto.url,
          IsOpen: dto.isOpen ?? false,
          Loop: dto.loop ?? true,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `DisplayConfig created successfully with id: ${result.Id}`,
        type: 'INFO',
        location: 'display-config.service.ts:54',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'display-config.service.ts:66',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateDisplayConfigDto,
    updatedBy: string,
  ): Promise<DisplayConfigModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'DISPLAY_002',
        functionName: 'DisplayConfigService.Update',
        createdBy: updatedBy,
      });

      const existing = await this.prisma.displayConfig.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`DisplayConfig with id ${id} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating display config id: ${id} with data: ${JSON.stringify(dto)}`,
        type: 'INFO',
        location: 'display-config.service.ts:94',
      });

      // If setting isOpen to true, ensure no other display has isOpen = true
      if (dto.isOpen === true && existing.IsOpen !== true) {
        await this.ensureOnlyOneOpenDisplay(logProcess.ProcessId, id);
      }

      const result = await this.prisma.displayConfig.update({
        where: { Id: id },
        data: {
          Description: dto.description,
          Url: dto.url,
          IsOpen: dto.isOpen,
          Loop: dto.loop,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `DisplayConfig updated successfully: ${result.Id}`,
        type: 'INFO',
        location: 'display-config.service.ts:116',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'display-config.service.ts:126',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async remove(
    id: number,
    deletedBy: string,
  ): Promise<{ deleted: boolean; id: number }> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'DISPLAY_003',
        functionName: 'DisplayConfigService.Delete',
        createdBy: deletedBy,
      });

      const existing = await this.prisma.displayConfig.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`DisplayConfig with id ${id} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting display config id: ${id} (${existing.Description})`,
        type: 'INFO',
        location: 'display-config.service.ts:152',
      });

      await this.prisma.displayConfig.delete({
        where: { Id: id },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `DisplayConfig deleted successfully: ${id}`,
        type: 'INFO',
        location: 'display-config.service.ts:160',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'display-config.service.ts:172',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  /**
   * Ensures that only one display config has IsOpen = true at a time.
   * If updating an existing record, exclude it from the check.
   */
  private async ensureOnlyOneOpenDisplay(
    processId: string,
    excludeId: number | null,
  ): Promise<void> {
    await this.logService.addLog({
      processId,
      message: 'Ensuring only one display is open (mutex logic)',
      type: 'DEBUG',
      location: 'display-config.service.ts:188',
    });

    // Find any existing open display (excluding the one being updated)
    const whereClause =
      excludeId !== null
        ? { IsOpen: true, Id: { not: excludeId } }
        : { IsOpen: true };

    const existingOpen = await this.prisma.displayConfig.findFirst({
      where: whereClause,
    });

    if (existingOpen) {
      await this.logService.addLog({
        processId,
        message: `Found existing open display: ${existingOpen.Description} (${existingOpen.Id}). Closing it.`,
        type: 'WARN',
        location: 'display-config.service.ts:200',
      });

      // Close the existing open display
      await this.prisma.displayConfig.update({
        where: { Id: existingOpen.Id },
        data: { IsOpen: false },
      });

      await this.logService.addLog({
        processId,
        message: `Closed previous open display: ${existingOpen.Id}`,
        type: 'INFO',
        location: 'display-config.service.ts:209',
      });
    }
  }
}
