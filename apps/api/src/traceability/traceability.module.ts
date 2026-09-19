/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Module } from '@nestjs/common';
import { TraceabilityService } from './traceability.service';
import {
  BomSnapshotsController,
  TraceabilityController,
} from './traceability.controller';
@Module({
  controllers: [TraceabilityController, BomSnapshotsController],
  providers: [TraceabilityService],
})
export class TraceabilityModule {}
