import { Module, forwardRef } from '@nestjs/common';
import { MaterialDeliveryNoteController } from './material-delivery-note.controller';
import { MaterialDeliveryNoteService } from './material-delivery-note.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';
import { SmtpService } from '../common/utils/smtp.service';
import { OutboxModule } from '../common/outbox/outbox.module';

@Module({
  imports: [forwardRef(() => OutboxModule)],
  controllers: [MaterialDeliveryNoteController],
  providers: [
    MaterialDeliveryNoteService,
    PrismaService,
    LogProcessService,
    SmtpService,
  ],
  exports: [MaterialDeliveryNoteService],
})
export class MaterialDeliveryNoteModule {}
