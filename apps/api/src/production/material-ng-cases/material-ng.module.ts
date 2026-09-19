/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Module } from '@nestjs/common';
import { LogProcessModule } from '../../common/log-process/log-process.module';
import { MaterialNgService } from './material-ng.service';
import { MaterialNgController } from './material-ng.controller';
@Module({
  imports: [LogProcessModule],
  controllers: [MaterialNgController],
  providers: [MaterialNgService],
})
export class MaterialNgModule {}
