import { auditedWrite } from '../../common/helpers/audited-transaction.helper';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NasUploadService } from '../../common/utils/nas-upload.service';
import { CreateManPowerDto, UpdateManPowerDto } from './dto';
import type {
  LogProcessModel,
  ManPowerModel,
} from '../../generated/prisma/models';
import type { Prisma } from '../../generated/prisma/client';
import type {
  ApiResult,
  PaginationMeta,
} from '../../common/interceptors/api-response.interface';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';
import { validateUploadContent } from '../../common/utils/upload-security.util';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class ManPowerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
    private readonly nasUploadService: NasUploadService,
  ) {}

  async findAll(
    query: SearchPaginationQueryDto,
  ): Promise<ApiResult<ManPowerModel[], PaginationMeta>> {
    const where: Prisma.ManPowerWhereInput = query.search
      ? {
          OR: [
            { Uid: { contains: query.search, mode: 'insensitive' } },
            { Nik: { contains: query.search, mode: 'insensitive' } },
            { Name: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [totalItems, data] = await Promise.all([
      this.prisma.manPower.count({ where }),
      this.prisma.manPower.findMany({
        where,
        include: { SkillMatrix: true },
        orderBy: [{ CreatedAt: 'desc' }, { Uid: 'asc' }],
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

  async findOne(uid: string): Promise<ManPowerModel> {
    const result = await this.prisma.manPower.findUnique({
      where: { Uid: uid },
      include: { SkillMatrix: true },
    });

    if (!result) {
      throw new NotFoundException(`ManPower with uid ${uid} not found`);
    }

    return result;
  }

  async findByNik(nik: string): Promise<ManPowerModel> {
    const result = await this.prisma.manPower.findUnique({
      where: { Nik: nik },
      include: { SkillMatrix: true },
    });

    if (!result) {
      throw new NotFoundException(`ManPower with nik ${nik} not found`);
    }

    return result;
  }

  async create(
    dto: CreateManPowerDto,
    createdBy: string,
  ): Promise<ManPowerModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MANPOWER_001',
        functionName: 'ManPowerService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating man power with nik: ${dto.nik}`,
        type: 'INFO',
        location: 'man-power.service.ts:100',
      });

      // Check if NIK already exists
      const existing = await this.prisma.manPower.findUnique({
        where: { Nik: dto.nik },
      });

      if (existing) {
        throw new ConflictException(
          `ManPower with nik ${dto.nik} already exists`,
        );
      }

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.manPower.create({
          data: {
            Nik: dto.nik,
            Name: dto.name,
            EmployeeType: dto.employeeType,
            Line: dto.line,
            Status: dto.status ?? true,
            PicturePath: dto.picturePath,
            CreatedBy: createdBy,
            UpdatedBy: createdBy,
            ...(dto.skillMatrix && {
              SkillMatrix: {
                create: dto.skillMatrix.map((s) => ({
                  Label: s.label,
                  Point: s.point,
                })),
              },
            }),
          },
          include: { SkillMatrix: true },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `ManPower created successfully with uid: ${result.Uid}`,
        type: 'INFO',
        location: 'man-power.service.ts:128',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'man-power.service.ts:140',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(
    uid: string,
    dto: UpdateManPowerDto,
    updatedBy: string,
  ): Promise<ManPowerModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MANPOWER_002',
        functionName: 'ManPowerService.Update',
        createdBy: updatedBy,
      });

      const existing = await this.prisma.manPower.findUnique({
        where: { Uid: uid },
      });

      if (!existing) {
        throw new NotFoundException(`ManPower with uid ${uid} not found`);
      }

      // Check if new NIK conflicts with existing
      if (dto.nik && dto.nik !== existing.Nik) {
        const nikConflict = await this.prisma.manPower.findUnique({
          where: { Nik: dto.nik },
        });

        if (nikConflict) {
          throw new ConflictException(
            `ManPower with nik ${dto.nik} already exists`,
          );
        }
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating man power uid: ${uid} with data: ${JSON.stringify(dto)}`,
        type: 'INFO',
        location: 'man-power.service.ts:182',
      });

      const result = await auditedWrite(this.prisma, (tx) =>
        tx.manPower.update({
          where: { Uid: uid },
          data: {
            Nik: dto.nik,
            Name: dto.name,
            EmployeeType: dto.employeeType,
            Line: dto.line,
            Status: dto.status,
            UpdatedBy: updatedBy,
            ...(dto.picturePath !== undefined
              ? { PicturePath: dto.picturePath }
              : {}),
            ...(dto.skillMatrix && {
              SkillMatrix: {
                deleteMany: {},
                create: dto.skillMatrix.map((s) => ({
                  Label: s.label,
                  Point: s.point,
                })),
              },
            }),
          },
          include: { SkillMatrix: true },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `ManPower updated successfully: ${result.Uid}`,
        type: 'INFO',
        location: 'man-power.service.ts:202',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'man-power.service.ts:214',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async remove(
    uid: string,
    deletedBy: string,
  ): Promise<{ deleted: boolean; uid: string }> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MANPOWER_003',
        functionName: 'ManPowerService.Delete',
        createdBy: deletedBy,
      });

      const existing = await this.prisma.manPower.findUnique({
        where: { Uid: uid },
      });

      if (!existing) {
        throw new NotFoundException(`ManPower with uid ${uid} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting man power uid: ${uid}`,
        type: 'INFO',
        location: 'man-power.service.ts:245',
      });

      // Delete picture from NAS if exists
      if (existing.PicturePath) {
        try {
          await this.nasUploadService.deleteFile(existing.PicturePath);
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `Picture deleted from NAS for man power ${uid}`,
            type: 'INFO',
            location: 'man-power.service.ts:255',
          });
        } catch (nasError) {
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `Warning: Could not delete picture from NAS: ${nasError instanceof Error ? nasError.message : 'Unknown error'}`,
            type: 'WARN',
            location: 'man-power.service.ts:262',
          });
        }
      }

      await auditedWrite(this.prisma, (tx) =>
        tx.manPower.delete({
          where: { Uid: uid },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `ManPower deleted successfully: ${uid}`,
        type: 'INFO',
        location: 'man-power.service.ts:273',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, uid };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'man-power.service.ts:285',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async uploadPicture(
    uid: string,
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<ManPowerModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MANPOWER_004',
        functionName: 'ManPowerService.UploadPicture',
        createdBy: uploadedBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting picture upload for man power: ${uid}`,
        type: 'INFO',
        location: 'man-power.service.ts:303',
      });

      const fileKind = validateUploadContent(file, [
        'png',
        'jpeg',
        'gif',
        'webp',
      ]);
      const fileExtension = fileKind === 'jpeg' ? 'jpg' : fileKind;

      // Validate file size (max 5MB)
      if (file.size > MAX_IMAGE_SIZE) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `File too large: ${file.size} bytes. Max: ${MAX_IMAGE_SIZE} bytes`,
          type: 'ERROR',
          location: 'man-power.service.ts:325',
        });
        throw new BadRequestException('File too large. Maximum size is 5MB');
      }

      // Check if man power exists
      const existing = await this.prisma.manPower.findUnique({
        where: { Uid: uid },
      });

      if (!existing) {
        throw new NotFoundException(`ManPower with uid ${uid} not found`);
      }

      // Delete old picture from NAS if exists
      if (existing.PicturePath) {
        try {
          await this.nasUploadService.deleteFile(existing.PicturePath);
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `Old picture deleted from NAS for man power ${uid}`,
            type: 'INFO',
            location: 'man-power.service.ts:344',
          });
        } catch (nasError) {
          await this.logService.addLog({
            processId: logProcess.ProcessId,
            message: `Warning: Could not delete old picture from NAS: ${nasError instanceof Error ? nasError.message : 'Unknown error'}`,
            type: 'WARN',
            location: 'man-power.service.ts:351',
          });
        }
      }

      // Generate filename: NIK_timestamp.extension
      const newFileName = `${existing.Nik}_${Date.now()}.${fileExtension}`;

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Uploading picture to NAS as: ${newFileName}`,
        type: 'INFO',
        location: 'man-power.service.ts:362',
      });

      // Upload file to NAS
      const fileUrl = await this.nasUploadService.uploadFile({
        fileName: newFileName,
        fileBuffer: file.buffer,
        subFolder: 'manpower',
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Picture uploaded to NAS for man power ${uid}`,
        type: 'INFO',
        location: 'man-power.service.ts:374',
      });

      // Update PicturePath in database
      const result = await auditedWrite(this.prisma, (tx) =>
        tx.manPower.update({
          where: { Uid: uid },
          data: {
            PicturePath: fileUrl,
            UpdatedBy: uploadedBy,
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `ManPower picture updated successfully for uid: ${uid}`,
        type: 'INFO',
        location: 'man-power.service.ts:387',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'man-power.service.ts:399',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async deletePicture(uid: string, deletedBy: string): Promise<ManPowerModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MANPOWER_005',
        functionName: 'ManPowerService.DeletePicture',
        createdBy: deletedBy,
      });

      const existing = await this.prisma.manPower.findUnique({
        where: { Uid: uid },
      });

      if (!existing) {
        throw new NotFoundException(`ManPower with uid ${uid} not found`);
      }

      if (!existing.PicturePath) {
        throw new BadRequestException(
          `ManPower with uid ${uid} has no picture`,
        );
      }

      // Delete file from NAS
      try {
        await this.nasUploadService.deleteFile(existing.PicturePath);
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Picture deleted from NAS for man power ${uid}`,
          type: 'INFO',
          location: 'man-power.service.ts:430',
        });
      } catch (nasError) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Warning: Could not delete picture from NAS: ${nasError instanceof Error ? nasError.message : 'Unknown error'}`,
          type: 'WARN',
          location: 'man-power.service.ts:437',
        });
      }

      // Set PicturePath to null in DB
      const result = await auditedWrite(this.prisma, (tx) =>
        tx.manPower.update({
          where: { Uid: uid },
          data: {
            PicturePath: null,
            UpdatedBy: deletedBy,
          },
        }),
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `ManPower picture removed successfully for uid: ${uid}`,
        type: 'INFO',
        location: 'man-power.service.ts:451',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'man-power.service.ts:463',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
