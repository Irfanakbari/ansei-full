import { Module } from '@nestjs/common';
import { FrontendController } from './frontend.controller';
import { FrontendService } from './frontend.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [FrontendController],
  providers: [FrontendService, PrismaService],
  exports: [FrontendService],
})
export class FrontendModule {}
