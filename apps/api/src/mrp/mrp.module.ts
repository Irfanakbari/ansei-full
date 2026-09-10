import { Module } from '@nestjs/common';
import { MrpController } from './mrp.controller';
import { MrpService } from './mrp.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';

@Module({
  controllers: [MrpController],
  providers: [MrpService, PrismaService, LogProcessService],
  exports: [MrpService],
})
export class MrpModule {}
