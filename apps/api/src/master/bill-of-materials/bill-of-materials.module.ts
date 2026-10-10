import { SapModule } from '../../common/sap/sap.module';
import { SapBomController } from './sap-bom.controller';
import { SapBomPreviewService } from './sap-bom-preview.service';
import { Module } from '@nestjs/common';
import { BillOfMaterialsController } from './bill-of-materials.controller';
import { BillOfMaterialsService } from './bill-of-materials.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessModule } from '../../common/log-process/log-process.module';

@Module({
  controllers: [SapBomController, BillOfMaterialsController],
  providers: [BillOfMaterialsService, PrismaService, SapBomPreviewService],
  imports: [LogProcessModule, SapModule],
  exports: [BillOfMaterialsService],
})
export class BillOfMaterialsModule {}
