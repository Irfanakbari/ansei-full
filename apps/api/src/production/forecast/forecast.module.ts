import { Module } from '@nestjs/common';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { ExcelService } from '../../common/utils/excel.service';
import { PrinterModule } from '../../common/printer/printer.module';

@Module({
  imports: [PrinterModule],
  controllers: [ForecastController],
  providers: [ForecastService, PrismaService, LogProcessService, ExcelService],
  exports: [ForecastService],
})
export class ForecastModule {}
