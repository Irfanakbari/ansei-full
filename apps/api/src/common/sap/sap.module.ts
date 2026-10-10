import { SapCacheService } from './sap-cache.service';
import { SapPostingService } from './sap-posting.service';
import { SapExternalMonitorService } from './sap-external-monitor.service';
import { SapConnectionService } from './sap-connection.service';
import { SapConnectionController } from './sap-connection.controller';
import { OutboxStateService } from '../outbox/outbox-state.service';
import { LogProcessService } from '../log-process/log-process.service';
import { SapMaterialWriteService } from './sap-material-write.service';
import { PrismaService } from '../../prisma/prisma.service';
/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SapBomService } from './sap-bom.service';
import { SapItemSyncService } from './sap-item-sync.service';

@Module({
  imports: [ConfigModule],
  controllers: [SapConnectionController],
  providers: [
    SapPostingService,
    SapExternalMonitorService,
    SapConnectionService,
    OutboxStateService,
    LogProcessService,
    SapCacheService,
    SapItemSyncService,
    SapBomService,
    SapMaterialWriteService,
    PrismaService,
  ],
  exports: [
    SapItemSyncService,
    SapBomService,
    SapMaterialWriteService,
    SapPostingService,
  ],
})
export class SapModule {}
