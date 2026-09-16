import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  PRINT_PART_TAG_ANSEI,
  type PartTagAnseiPayload,
} from './printer.types';

@Injectable()
export class PrinterService {
  private readonly logger = new Logger(PrinterService.name);

  constructor(
    @InjectQueue('printer_queue') private readonly printerQueue: Queue,
  ) {}

  async printPartTagAnsei(payload: PartTagAnseiPayload): Promise<void> {
    try {
      await this.printerQueue.add(PRINT_PART_TAG_ANSEI, payload, {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });
      this.logger.log(
        `Enqueued async print job ${PRINT_PART_TAG_ANSEI} for PO ${payload.poNumber}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to enqueue print job: ${message}`);
      throw error;
    }
  }
}
