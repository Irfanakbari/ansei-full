import { Module } from '@nestjs/common';
import { ProductionReleaseController } from './production-release.controller';
import { ProductionReleaseService } from './production-release.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { NasUploadService } from '../../common/utils/nas-upload.service';
import { FonnteService } from '../../common/utils/fonnte.service';
import { ShoppingModule } from '../shopping/shopping.module';
import { AssemblyModule } from '../assembly/assembly.module';
import { PokayokeModule } from '../pokayoke/pokayoke.module';
import { DeliveryModule } from '../delivery/delivery.module';

@Module({
  imports: [ShoppingModule, AssemblyModule, PokayokeModule, DeliveryModule],
  controllers: [ProductionReleaseController],
  providers: [
    ProductionReleaseService,
    PrismaService,
    LogProcessService,
    NasUploadService,
    FonnteService,
  ],
  exports: [ProductionReleaseService],
})
export class ProductionReleaseModule {}
