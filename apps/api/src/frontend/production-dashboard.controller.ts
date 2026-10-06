/* By Irfan Akbari Vuteq Indonesia - 2026-10-06 */
import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ProductionDashboardService } from './production-dashboard.service';
import { ProductionDashboardResponse } from './entities/production-dashboard.entity';

@ApiTags('Frontend')
@Controller('frontend/production-dashboard')
export class ProductionDashboardController {
  constructor(private readonly dashboard: ProductionDashboardService) {}

  @Get()
  @Public()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Public genba dashboard for active production releases',
    description:
      "Read-only operational metrics for RELEASED orders, cycle sequence, process progress and today's hourly output in Asia/Jakarta. No operator identities or supplier data.",
  })
  @ApiResponse({ status: 200, type: ProductionDashboardResponse })
  getDashboard(): Promise<ProductionDashboardResponse> {
    return this.dashboard.getDashboard();
  }
}
