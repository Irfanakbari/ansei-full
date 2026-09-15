import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
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

@Injectable()
export class ManPowerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
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
    });

    if (!result) {
      throw new NotFoundException(`ManPower with uid ${uid} not found`);
    }

    return result;
  }

  async findByNik(nik: string): Promise<ManPowerModel> {
    const result = await this.prisma.manPower.findUnique({
      where: { Nik: nik },
    });

    if (!result) {
      throw new NotFoundException(`ManPower with nik ${nik} not found`);
    }

    return result;
  }

  async create(dto: CreateManPowerDto): Promise<ManPowerModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MANPOWER_001',
        functionName: 'ManPowerService.Create',
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating man power with nik: ${dto.nik}`,
        type: 'INFO',
        location: 'man-power.service.ts:45',
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

      const result = await this.prisma.manPower.create({
        data: {
          Nik: dto.nik,
          Name: dto.name,
          Line: dto.line,
          Status: dto.status ?? true,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `ManPower created successfully with uid: ${result.Uid}`,
        type: 'INFO',
        location: 'man-power.service.ts:68',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'man-power.service.ts:80',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(uid: string, dto: UpdateManPowerDto): Promise<ManPowerModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MANPOWER_002',
        functionName: 'ManPowerService.Update',
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
        location: 'man-power.service.ts:112',
      });

      const result = await this.prisma.manPower.update({
        where: { Uid: uid },
        data: {
          Nik: dto.nik,
          Name: dto.name,
          Line: dto.line,
          Status: dto.status,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `ManPower updated successfully: ${result.Uid}`,
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

  async remove(uid: string): Promise<{ deleted: boolean; uid: string }> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MANPOWER_003',
        functionName: 'ManPowerService.Delete',
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
        location: 'man-power.service.ts:161',
      });

      await this.prisma.manPower.delete({
        where: { Uid: uid },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `ManPower deleted successfully: ${uid}`,
        type: 'INFO',
        location: 'man-power.service.ts:169',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, uid };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'man-power.service.ts:181',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
