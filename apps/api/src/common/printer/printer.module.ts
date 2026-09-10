import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PrinterService } from './printer.service';
import { PRINTER_SERVICE } from './printer.types';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: PRINTER_SERVICE,
        transport: Transport.RMQ,
        options: {
          urls: [process.env.PRINTER_RMQ_URL || 'amqp://localhost:5672'],
          queue: process.env.PRINTER_RMQ_QUEUE || 'printer_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  providers: [PrinterService],
  exports: [PrinterService],
})
export class PrinterModule {}
