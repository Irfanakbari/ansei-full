import { Module } from '@nestjs/common';
import { PrinterService } from './printer.service';
import { OutboxModule } from '../outbox/outbox.module';
@Module({
  imports: [OutboxModule],
  providers: [PrinterService],
  exports: [PrinterService],
})
export class PrinterModule {}
