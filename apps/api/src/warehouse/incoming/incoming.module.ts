import { Module } from '@nestjs/common';
import { IncomingController } from './incoming.controller';
import { IncomingService } from './incoming.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NasUploadService } from '../../common/utils/nas-upload.service';

@Module({
  controllers: [IncomingController],
  providers: [
    IncomingService,
    PrismaService,
    LogProcessService,
    NasUploadService,
  ],
  exports: [IncomingService],
})
export class IncomingModule {}
