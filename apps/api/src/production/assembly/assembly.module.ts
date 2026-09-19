/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import {
  AssemblyController,
  DisplayAssemblyController,
} from './assembly.controller';
import { AssemblyService } from './assembly.service';
@Module({
  controllers: [AssemblyController, DisplayAssemblyController],
  providers: [AssemblyService, PrismaService, LogProcessService],
})
export class AssemblyModule {}
