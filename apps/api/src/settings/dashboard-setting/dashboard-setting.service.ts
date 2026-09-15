import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { UpdateDashboardSettingDto } from './dto';
import type {
  LogProcessModel,
  DashboardSettingModel,
} from '../../generated/prisma/models';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class DashboardSettingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const [totalItems, data] = await Promise.all([
      this.prisma.dashboardSetting.count(),
      this.prisma.dashboardSetting.findMany({
        orderBy: { Id: 'asc' },
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

  async findOne(id: number): Promise<DashboardSettingModel> {
    const result = await this.prisma.dashboardSetting.findUnique({
      where: { Id: id },
    });

    if (!result) {
      throw new NotFoundException(`DashboardSetting with id ${id} not found`);
    }

    return result;
  }

  async findLatest(): Promise<DashboardSettingModel> {
    const result = await this.prisma.dashboardSetting.findFirst({
      orderBy: { Id: 'desc' },
    });

    if (!result) {
      throw new NotFoundException('No dashboard setting found');
    }

    return result;
  }

  async update(
    id: number,
    dto: UpdateDashboardSettingDto,
  ): Promise<DashboardSettingModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'DASHBOARD_002',
        functionName: 'DashboardSettingService.Update',
      });

      const existing = await this.prisma.dashboardSetting.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`DashboardSetting with id ${id} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating dashboard setting id: ${id} with data: ${JSON.stringify(dto)}`,
        type: 'INFO',
        location: 'dashboard-setting.service.ts:52',
      });

      const result = await this.prisma.dashboardSetting.update({
        where: { Id: id },
        data: {
          StartDate: dto.startDate ? new Date(dto.startDate) : undefined,
          EndDate: dto.endDate ? new Date(dto.endDate) : undefined,
          UpdatedAt: new Date(),
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `DashboardSetting updated successfully: ${result.Id}`,
        type: 'INFO',
        location: 'dashboard-setting.service.ts:67',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'dashboard-setting.service.ts:79',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
