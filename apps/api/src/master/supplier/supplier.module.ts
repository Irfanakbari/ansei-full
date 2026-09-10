import { Module } from '@nestjs/common';
import { SupplierController } from './supplier.controller';
import { SupplierService } from './supplier.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessModule } from '../../common/log-process/log-process.module';

@Module({
  controllers: [SupplierController],
  providers: [SupplierService, PrismaService],
  imports: [LogProcessModule],
  exports: [SupplierService],
})
export class SupplierModule {}
