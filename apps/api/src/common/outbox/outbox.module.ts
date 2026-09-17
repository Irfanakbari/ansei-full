import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OutboxService } from './outbox.service';
import { OutboxDispatcher } from './outbox.dispatcher';
import { OutboxProcessor } from './outbox.processor';
import { OUTBOX_QUEUE } from './outbox.types';
import { MaterialDeliveryNoteModule } from '../../material-delivery-note/material-delivery-note.module';
import { SmtpService } from '../utils/smtp.service';
import { LogProcessService } from '../log-process/log-process.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: OUTBOX_QUEUE }, { name: 'printer_queue' }),
    forwardRef(() => MaterialDeliveryNoteModule),
  ],
  providers: [
    OutboxService,
    OutboxDispatcher,
    OutboxProcessor,
    SmtpService,
    LogProcessService,
  ],
  exports: [OutboxService],
})
export class OutboxModule {}
