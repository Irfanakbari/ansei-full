import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { FrontendService } from './frontend.service';
import { Public } from '../auth/decorators/public.decorator';
import { DashboardResponseEntity } from './entities/dashboard-response.entity';

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

  @Get('dashboard')
  @Public()
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description:
      'Returns dashboard statistics including total materials, suppliers, finish goods, manpower, incoming/delivery totals, and daily statistics for the current month.',
  })
  async getDashboard(): Promise<DashboardResponseEntity> {
    return this.frontendService.getDashboard();
  }
}
