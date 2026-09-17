import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Controller, Get, Query } from '@nestjs/common';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { FrontendService } from './frontend.service';
import { Public } from '../auth/decorators/public.decorator';
import { Permission } from '../auth/decorators/permission.decorator';
import { DashboardResponseEntity } from './entities/dashboard-response.entity';
import { FrontendFinishGoodEntity } from './entities/finish-good-list.entity';
import { FrontendManPowerEntity } from './entities/man-power-list.entity';
import { DisplayTargetQueryDto } from './dto/display-target-query.dto';
import { DisplayTargetEntity } from './entities/display-target.entity';

@ApiTags('Frontend')
@ApiBearerAuth()
@Controller('frontend')
export class FrontendController {
  constructor(private readonly frontendService: FrontendService) {}

  @Get('production-status')
  @Public()
  @ApiOperation({
    summary: 'Get production status (RELEASED only)',
    description:
      'Public endpoint to get production status for frontend display. Only returns releases with RELEASED status.',
  })
  async getProductionStatus() {
    return this.frontendService.getProductionStatus();
  }

  @Get('notifications')
  @Public()
  @ApiOperation({
    summary: 'Get notifications',
    description: 'Public endpoint to get notifications for frontend display.',
  })
  async getNotifications() {
    return this.frontendService.getNotifications();
  }

  @Get('finish-goods')
  @Public()
  @ApiOperation({
    summary: 'Get finish goods list (PartNumber, PartName, Alias)',
    description:
      'Public endpoint to get list of finish goods containing only PartNumber, PartName, and Alias.',
  })
  @ApiResponse({ status: 200, type: [FrontendFinishGoodEntity] })
  async getFinishGoods(): Promise<FrontendFinishGoodEntity[]> {
    return this.frontendService.getFinishGoodsList();
  }

  @Get('display-target')
  @Public()
  @ApiOperation({
    summary: 'Get the active production target for a display part number',
    description:
      'Returns the sum of forecast quantities for the selected finish good in the active RELEASED production release.',
  })
  @ApiResponse({ status: 200, type: DisplayTargetEntity })
  async getDisplayTarget(
    @Query() query: DisplayTargetQueryDto,
  ): Promise<DisplayTargetEntity> {
    return this.frontendService.getDisplayTarget(query.partNumber);
  }

  @Get('man-power')
  @Public()
  @ApiOperation({
    summary: 'Get man power list (Nik, Name, PicturePath, Line)',
    description:
      'Public endpoint to get list of active man power containing only Nik, Name, PicturePath, and Line.',
  })
  @ApiResponse({ status: 200, type: [FrontendManPowerEntity] })
  async getManPower(): Promise<FrontendManPowerEntity[]> {
    return this.frontendService.getManPowerList();
  }

  @Get('manpower')
  @Public()
  @ApiOperation({
    summary:
      'Get man power list (Nik, Name, PicturePath, Line) - alias for man-power',
  })
  @ApiResponse({ status: 200, type: [FrontendManPowerEntity] })
  async getManpowerAlias(): Promise<FrontendManPowerEntity[]> {
    return this.frontendService.getManPowerList();
  }

  @Get('dashboard')
  @Permission('DASHBOARD_VIEW')
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description:
      'Returns dashboard statistics including total materials, suppliers, finish goods, manpower, incoming/delivery totals, and daily statistics for the current month.',
  })
  async getDashboard(
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardResponseEntity> {
    return this.frontendService.getDashboard(query);
  }
}
