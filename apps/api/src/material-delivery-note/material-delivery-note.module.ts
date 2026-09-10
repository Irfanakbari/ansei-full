import { Module } from '@nestjs/common';
import { MaterialDeliveryNoteController } from './material-delivery-note.controller';
import { MaterialDeliveryNoteService } from './material-delivery-note.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';
import { SmtpService } from '../common/utils/smtp.service';

@Module({
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
