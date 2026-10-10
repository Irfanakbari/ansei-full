import { SapModule } from '../sap/sap.module';
import { OutboxController } from './outbox.controller';
import { OutboxStateService } from './outbox-state.service';
import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OutboxService } from './outbox.service';
import { OutboxDispatcher } from './outbox.dispatcher';
import { OutboxProcessor } from './outbox.processor';
import { OUTBOX_QUEUE } from './outbox.types';
import { MaterialDeliveryNoteModule } from '../../material-delivery-note/material-delivery-note.module';
import { InventoryCountingModule } from '../../inventory-counting/inventory-counting.module';
import { SmtpService } from '../utils/smtp.service';
import { LogProcessService } from '../log-process/log-process.service';

@Module({
  imports: [
    SapModule,
    BullModule.registerQueue({ name: OUTBOX_QUEUE }),
    forwardRef(() => MaterialDeliveryNoteModule),
    forwardRef(() => InventoryCountingModule),
  ],
  controllers: [OutboxController],
  providers: [
    OutboxService,
    OutboxStateService,
    OutboxDispatcher,
    OutboxProcessor,
    SmtpService,
    LogProcessService,
  ],
  exports: [OutboxService],
})
export class OutboxModule {}
