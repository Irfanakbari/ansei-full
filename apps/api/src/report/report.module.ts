import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';
import { InventoryReconciliationService } from './inventory-reconciliation.service';

@Module({
  controllers: [ReportController],
  providers: [
    ReportService,
    InventoryReconciliationService,
    PrismaService,
    LogProcessService,
  ],
  exports: [ReportService],
})
export class ReportModule {}
