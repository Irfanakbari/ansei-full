import { Module } from '@nestjs/common';
import { EmailNotificationController } from './email-notification.controller';
import { EmailNotificationService } from './email-notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessModule } from '../../common/log-process/log-process.module';

@Module({
  controllers: [EmailNotificationController],
  providers: [EmailNotificationService, PrismaService],
  imports: [LogProcessModule],
  exports: [EmailNotificationService],
})
export class EmailNotificationModule {}
