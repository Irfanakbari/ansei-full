import { Module } from '@nestjs/common';
import { FinishGoodController } from './finish-good.controller';
import { FinishGoodService } from './finish-good.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessModule } from '../../common/log-process/log-process.module';
import { BoxQtyModule } from './box-qty/box-qty.module';
import { BillOfMaterialsModule } from './bill-of-materials/bill-of-materials.module';

@Module({
  controllers: [FinishGoodController],
  providers: [FinishGoodService, PrismaService],
  imports: [LogProcessModule, BoxQtyModule, BillOfMaterialsModule],
  exports: [FinishGoodService],
})
export class FinishGoodModule {}
