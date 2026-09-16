import { Module } from '@nestjs/common';
import { ManPowerController } from './man-power.controller';
import { ManPowerService } from './man-power.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessModule } from '../../common/log-process/log-process.module';
import { NasUploadService } from '../../common/utils/nas-upload.service';

@Module({
  controllers: [ManPowerController],
  providers: [ManPowerService, PrismaService, NasUploadService],
  imports: [LogProcessModule],
  exports: [ManPowerService],
})
export class ManPowerModule {}
