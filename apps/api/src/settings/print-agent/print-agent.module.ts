import { Module } from '@nestjs/common';
import { LogProcessModule } from '../../common/log-process/log-process.module';
import { PrintAgentAuthGuard } from './print-agent-auth.guard';
import { PrintAgentController } from './print-agent.controller';
import { PrintAgentService } from './print-agent.service';
import { PrintJobLeaseReaper } from './print-job-lease.reaper';

@Module({
  imports: [LogProcessModule],
  controllers: [PrintAgentController],
  providers: [PrintAgentService, PrintAgentAuthGuard, PrintJobLeaseReaper],
  exports: [PrintAgentService],
})
export class PrintAgentModule {}
