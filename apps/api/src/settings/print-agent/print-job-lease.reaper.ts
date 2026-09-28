import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrintAgentService } from './print-agent.service';

@Injectable()
export class PrintJobLeaseReaper implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(private readonly service: PrintAgentService) {}

  onModuleInit(): void {
    this.timer = setInterval(
      () => void this.service.reapExpiredLeases(),
      30_000,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
