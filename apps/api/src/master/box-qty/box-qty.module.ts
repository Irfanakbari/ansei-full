import { Module } from '@nestjs/common';
import { BoxQtyController } from './box-qty.controller';
import { BoxQtyService } from './box-qty.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessModule } from '../../common/log-process/log-process.module';

@Module({
  controllers: [BoxQtyController],
  providers: [BoxQtyService, PrismaService],
  imports: [LogProcessModule],
  exports: [BoxQtyService],
})
export class BoxQtyModule {}
