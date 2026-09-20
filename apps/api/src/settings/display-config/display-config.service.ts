import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NasUploadService } from '../../common/utils/nas-upload.service';
import { CreateDisplayConfigDto, UpdateDisplayConfigDto } from './dto';
import type {
  LogProcessModel,
  DisplayConfigModel,
} from '../../generated/prisma/models';
import type { Prisma } from '../../generated/prisma/client';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';
import { validateUploadContent } from '../../common/utils/upload-security.util';

@Injectable()
export class DisplayConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
    private readonly nasUploadService: NasUploadService,
  ) {}

  async findAll(query: SearchPaginationQueryDto = { page: 1, limit: 50 }) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 50;
    const where: Prisma.DisplayConfigWhereInput = query?.search
      ? {
          OR: [
            { Description: { contains: query.search, mode: 'insensitive' } },
            { Url: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [totalItems, data] = await Promise.all([
      this.prisma.displayConfig.count({ where }),
      this.prisma.displayConfig.findMany({
        where,
        orderBy: [{ CreatedAt: 'desc' }, { Id: 'desc' }],
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

  async findActive(line?: string): Promise<DisplayConfigModel | null> {
    if (line) {
      const lineConfig = await this.prisma.displayConfig.findFirst({
        where: { IsOpen: true, Line: line },
        orderBy: { CreatedAt: 'desc' },
      });
      if (lineConfig) return lineConfig;
    }
    return this.prisma.displayConfig.findFirst({
      where: { IsOpen: true, OR: [{ Line: null }, { Line: '' }] },
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
        await this.ensureOnlyOneOpenDisplay(
          logProcess.ProcessId,
          null,
          dto.line || null,
          createdBy,
        );
      }

      const result = await this.prisma.displayConfig.create({
        data: {
          Description: dto.description,
          Url: dto.url ?? null,
          IsOpen: dto.isOpen ?? false,
          Loop: dto.loop ?? true,
          Line: dto.line ?? null,
          FilePath: dto.filePath ?? null,
          CreatedBy: createdBy,
          UpdatedBy: createdBy,
        } as never,
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
        const targetLine = dto.line !== undefined ? dto.line : existing.Line;
        await this.ensureOnlyOneOpenDisplay(
          logProcess.ProcessId,
          id,
          targetLine || null,
          updatedBy,
        );
      }

      const result = await this.prisma.displayConfig.update({
        where: { Id: id },
        data: {
          Description: dto.description,
          Url: dto.url,
          IsOpen: dto.isOpen,
          Loop: dto.loop,
          Line: dto.line,
          FilePath: dto.filePath,
          UpdatedBy: updatedBy,
        } as never,
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

      if (existing.FilePath) {
        try {
          await this.nasUploadService.deleteFile(existing.FilePath);
        } catch (_e) {
          // ignore
        }
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting display config id: ${id} (${existing.Description})`,
        type: 'INFO',
        location: 'display-config.service.ts:152',
      });

      await this.prisma.displayConfig.delete({ where: { Id: id } });

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
    line: string | null = null,
    updatedBy = 'SYSTEM',
  ): Promise<void> {
    await this.logService.addLog({
      processId,
      message:
        'Ensuring only one display is open (mutex logic) for line: ' + line,
      type: 'DEBUG',
      location: 'display-config.service.ts:188',
    });

    // Find any existing open display for the SAME line
    const whereClause: Prisma.DisplayConfigWhereInput = {
      IsOpen: true,
      ...(line ? { Line: line } : { OR: [{ Line: null }, { Line: '' }] }),
      ...(excludeId !== null ? { Id: { not: excludeId } } : {}),
    };

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
        data: { IsOpen: false, UpdatedBy: updatedBy } as never,
      });

      await this.logService.addLog({
        processId,
        message: `Closed previous open display: ${existingOpen.Id}`,
        type: 'INFO',
        location: 'display-config.service.ts:209',
      });
    }
  }

  async uploadMedia(
    id: number,
    file: Express.Multer.File,
    updatedBy: string,
  ): Promise<DisplayConfigModel> {
    const existing = await this.prisma.displayConfig.findUnique({
      where: { Id: id },
    });

    if (!existing) {
      throw new NotFoundException(`DisplayConfig with id ${id} not found`);
    }

    const fileKind = validateUploadContent(file, [
      'png',
      'jpeg',
      'gif',
      'webp',
      'mp4',
      'webm',
      'ogg',
    ]);
    const fileExt = fileKind === 'jpeg' ? 'jpg' : fileKind;

    if (existing.FilePath) {
      try {
        await this.nasUploadService.deleteFile(existing.FilePath);
      } catch (error) {
        // ignore delete error
      }
    }

    const fileName = `display_${id}_${Date.now()}.${fileExt}`;
    const subFolder = 'display_media';

    const fileUrl = await this.nasUploadService.uploadFile({
      fileName,
      fileBuffer: file.buffer,
      subFolder,
    });

    return this.prisma.displayConfig.update({
      where: { Id: id },
      data: { FilePath: fileUrl, UpdatedBy: updatedBy } as never,
    });
  }

  async deleteMedia(
    id: number,
    updatedBy: string,
  ): Promise<DisplayConfigModel> {
    const existing = await this.prisma.displayConfig.findUnique({
      where: { Id: id },
    });

    if (!existing) {
      throw new NotFoundException(`DisplayConfig with id ${id} not found`);
    }

    if (!existing.FilePath) {
      throw new BadRequestException('Display config has no media to delete');
    }

    try {
      await this.nasUploadService.deleteFile(existing.FilePath);
    } catch (error) {
      // ignore
    }

    return this.prisma.displayConfig.update({
      where: { Id: id },
      data: { FilePath: null, UpdatedBy: updatedBy } as never,
    });
  }
}
