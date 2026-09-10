import { Module } from '@nestjs/common';
import { ProductionReportController } from './production-report.controller';
import { ProductionReportService } from './production-report.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';

@Module({
  controllers: [ProductionReportController],
  providers: [ProductionReportService, PrismaService, LogProcessService],
  exports: [ProductionReportService],
})
export class ProductionReportModule {}
