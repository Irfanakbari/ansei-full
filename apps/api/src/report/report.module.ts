import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';

@Module({
  controllers: [ReportController],
  providers: [ReportService, PrismaService, LogProcessService],
  exports: [ReportService],
})
export class ReportModule {}
