import { Module } from '@nestjs/common';
import { DisplayConfigController } from './display-config.controller';
import { DisplayConfigService } from './display-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessModule } from '../../common/log-process/log-process.module';

@Module({
  controllers: [DisplayConfigController],
  providers: [DisplayConfigService, PrismaService],
  imports: [LogProcessModule],
  exports: [DisplayConfigService],
})
export class DisplayConfigModule {}
