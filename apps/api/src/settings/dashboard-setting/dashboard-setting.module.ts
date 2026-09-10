import { Module } from '@nestjs/common';
import { DashboardSettingController } from './dashboard-setting.controller';
import { DashboardSettingService } from './dashboard-setting.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessModule } from '../../common/log-process/log-process.module';

@Module({
  controllers: [DashboardSettingController],
  providers: [DashboardSettingService, PrismaService],
  imports: [LogProcessModule],
  exports: [DashboardSettingService],
})
export class DashboardSettingModule {}
