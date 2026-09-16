import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrinterService } from './printer.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'printer_queue',
    }),
  ],
  providers: [PrinterService],
  exports: [PrinterService],
})
export class PrinterModule {}
