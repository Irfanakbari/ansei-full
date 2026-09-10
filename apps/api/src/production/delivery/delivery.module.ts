import { Module } from '@nestjs/common';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';

@Module({
  controllers: [DeliveryController],
  providers: [DeliveryService, PrismaService, LogProcessService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
