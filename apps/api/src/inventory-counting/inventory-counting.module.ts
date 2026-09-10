import { Module } from '@nestjs/common';
import { InventoryCountingController } from './inventory-counting.controller';
import { InventoryCountingService } from './inventory-counting.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';

@Module({
  controllers: [InventoryCountingController],
  providers: [InventoryCountingService, PrismaService, LogProcessService],
  exports: [InventoryCountingService],
})
export class InventoryCountingModule {}
