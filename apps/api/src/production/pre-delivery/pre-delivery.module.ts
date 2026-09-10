import { Module } from '@nestjs/common';
import { PreDeliveryController } from './pre-delivery.controller';
import { PreDeliveryService } from './pre-delivery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ShoppingModule } from '../shopping/shopping.module';

@Module({
  imports: [ShoppingModule],
  controllers: [PreDeliveryController],
  providers: [PreDeliveryService, PrismaService],
  exports: [PreDeliveryService],
})
export class PreDeliveryModule {}
