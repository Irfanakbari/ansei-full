import { Module } from '@nestjs/common';
import { LogProcessModule } from '../../common/log-process/log-process.module';
import { ProductionFindingController } from './production-finding.controller';
import { ProductionFindingService } from './production-finding.service';

@Module({
  imports: [LogProcessModule],
  controllers: [ProductionFindingController],
  providers: [ProductionFindingService],
})
export class ProductionFindingModule {}
