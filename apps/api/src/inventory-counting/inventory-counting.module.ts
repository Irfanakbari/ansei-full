import { Module, forwardRef } from '@nestjs/common';
import { InventoryCountingController } from './inventory-counting.controller';
import { InventoryCountingService } from './inventory-counting.service';
import { InventoryCountingDocumentService } from './inventory-counting-document.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';
import { NasUploadService } from '../common/utils/nas-upload.service';
import { OutboxModule } from '../common/outbox/outbox.module';

@Module({
  imports: [forwardRef(() => OutboxModule)],
  controllers: [InventoryCountingController],
  providers: [
    InventoryCountingService,
    InventoryCountingDocumentService,
    PrismaService,
    LogProcessService,
    NasUploadService,
  ],
  exports: [InventoryCountingService, InventoryCountingDocumentService],
})
export class InventoryCountingModule {}
