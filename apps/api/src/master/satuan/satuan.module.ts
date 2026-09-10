import { Module } from '@nestjs/common';
import { SatuanController } from './satuan.controller';
import { SatuanService } from './satuan.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessModule } from '../../common/log-process/log-process.module';

@Module({
  controllers: [SatuanController],
  providers: [SatuanService, PrismaService],
  imports: [LogProcessModule],
  exports: [SatuanService],
})
export class SatuanModule {}
