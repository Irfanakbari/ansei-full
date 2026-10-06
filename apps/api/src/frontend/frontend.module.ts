import { Module } from '@nestjs/common';
import { FrontendController } from './frontend.controller';
import { FrontendService } from './frontend.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductionDashboardController } from './production-dashboard.controller';
import { ProductionDashboardService } from './production-dashboard.service';

@Module({
  controllers: [FrontendController, ProductionDashboardController],
  providers: [FrontendService, ProductionDashboardService, PrismaService],
  exports: [FrontendService],
})
export class FrontendModule {}
