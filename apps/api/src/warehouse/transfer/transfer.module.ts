import { Module } from '@nestjs/common';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';

@Module({
  controllers: [TransferController],
  providers: [TransferService, PrismaService, LogProcessService],
  exports: [TransferService],
})
export class TransferModule {}
