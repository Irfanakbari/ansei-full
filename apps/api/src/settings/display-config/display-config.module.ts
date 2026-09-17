import { Module } from '@nestjs/common';
import { DisplayConfigController } from './display-config.controller';
import { DisplayConfigService } from './display-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessModule } from '../../common/log-process/log-process.module';
import { NasUploadService } from '../../common/utils/nas-upload.service';

@Module({
  controllers: [DisplayConfigController],
  providers: [DisplayConfigService, PrismaService, NasUploadService],
  imports: [LogProcessModule],
  exports: [DisplayConfigService],
})
export class DisplayConfigModule {}
