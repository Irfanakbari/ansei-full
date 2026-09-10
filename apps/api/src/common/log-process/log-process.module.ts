import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from './log-process.service';

@Module({
  providers: [PrismaService, LogProcessService],
  exports: [LogProcessService],
})
export class LogProcessModule {}
