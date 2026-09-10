import { Module } from '@nestjs/common';
import { ProductionReleaseController } from './production-release.controller';
import { ProductionReleaseService } from './production-release.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NasUploadService } from '../../common/utils/nas-upload.service';

@Module({
  controllers: [ProductionReleaseController],
  providers: [
    ProductionReleaseService,
    PrismaService,
    LogProcessService,
    NasUploadService,
  ],
  exports: [ProductionReleaseService],
})
export class ProductionReleaseModule {}
