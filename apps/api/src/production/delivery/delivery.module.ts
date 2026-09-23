import { Module } from '@nestjs/common';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { OutboxModule } from '../../common/outbox/outbox.module';

@Module({
  imports: [OutboxModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, PrismaService, LogProcessService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
