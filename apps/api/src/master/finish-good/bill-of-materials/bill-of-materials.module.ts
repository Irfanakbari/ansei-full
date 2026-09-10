import { Module } from '@nestjs/common';
import { BillOfMaterialsController } from './bill-of-materials.controller';
import { BillOfMaterialsService } from './bill-of-materials.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LogProcessModule } from '../../../common/log-process/log-process.module';

@Module({
  controllers: [BillOfMaterialsController],
  providers: [BillOfMaterialsService, PrismaService],
  imports: [LogProcessModule],
  exports: [BillOfMaterialsService],
})
export class BillOfMaterialsModule {}
