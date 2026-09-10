import { Module } from '@nestjs/common';
import { ShoppingController } from './shopping.controller';
import { ShoppingService } from './shopping.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { PrinterModule } from '../../common/printer/printer.module';

@Module({
  imports: [PrinterModule],
  controllers: [ShoppingController],
  providers: [ShoppingService, PrismaService, LogProcessService],
  exports: [ShoppingService],
})
export class ShoppingModule {}
