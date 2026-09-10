import { Module } from '@nestjs/common';
import { PrinterSettingController } from './printer-setting.controller';
import { PrinterSettingService } from './printer-setting.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessModule } from '../../common/log-process/log-process.module';

@Module({
  controllers: [PrinterSettingController],
  providers: [PrinterSettingService, PrismaService],
  imports: [LogProcessModule],
  exports: [PrinterSettingService],
})
export class PrinterSettingModule {}
