/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { ExcelService } from '../../common/utils/excel.service';
import { ForecastModule } from '../forecast/forecast.module';
import { ForecastNonPoController } from './forecast-non-po.controller';
import { ForecastNonPoService } from './forecast-non-po.service';
@Module({
  imports: [ForecastModule],
  controllers: [ForecastNonPoController],
  providers: [
    PrismaService,
    LogProcessService,
    ExcelService,
    ForecastNonPoService,
  ],
})
export class ForecastNonPoModule {}
