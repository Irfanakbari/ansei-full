/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Module } from '@nestjs/common';
import { LogProcessModule } from '../../common/log-process/log-process.module';
import { BomRevisionsController } from './bom-revisions.controller';
import { BomRevisionsService } from './bom-revisions.service';
@Module({
  imports: [LogProcessModule],
  controllers: [BomRevisionsController],
  providers: [BomRevisionsService],
})
export class BomRevisionsModule {}
