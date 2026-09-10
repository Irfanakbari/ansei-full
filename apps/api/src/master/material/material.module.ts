import { Module } from '@nestjs/common';
import { MaterialController } from './material.controller';
import { MaterialService } from './material.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessModule } from '../../common/log-process/log-process.module';

@Module({
  controllers: [MaterialController],
  providers: [MaterialService, PrismaService],
  imports: [LogProcessModule],
  exports: [MaterialService],
})
export class MaterialModule {}
