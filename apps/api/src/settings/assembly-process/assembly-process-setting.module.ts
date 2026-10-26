import { Module } from '@nestjs/common';
import { LogProcessModule } from '../../common/log-process/log-process.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AssemblyProcessSettingController } from './assembly-process-setting.controller';
import { AssemblyProcessSettingService } from './assembly-process-setting.service';

@Module({
  imports: [LogProcessModule],
  controllers: [AssemblyProcessSettingController],
  providers: [AssemblyProcessSettingService, PrismaService],
  exports: [AssemblyProcessSettingService],
})
export class AssemblyProcessSettingModule {}
