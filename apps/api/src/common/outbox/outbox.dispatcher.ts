import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { DISPATCH_OUTBOX_EVENT, OUTBOX_QUEUE } from './outbox.types';

@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(OUTBOX_QUEUE) private readonly queue: Queue,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => this.scheduleDispatch(), 5000);
    this.timer.unref();
    this.scheduleDispatch();
  }

  private scheduleDispatch(): void {
    void this.dispatch().catch((error: unknown) => {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(
        `Outbox dispatch cycle failed; pending events will be retried: ${errorName}`,
      );
    });
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async dispatch(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
      await this.prisma.outboxEvent.updateMany({
        where: {
          Status: { in: ['QUEUED', 'PROCESSING'] },
          UpdatedAt: { lt: staleBefore },
        },
        data: {
          Status: 'PENDING',
          NextAttemptAt: new Date(),
          LastErrorCode: 'OUTBOX_STALE_CLAIM',
          LastError: 'Interrupted delivery was recovered and will be retried',
          QueuedAt: null,
          ProcessingAt: null,
        },
      });
      const events = await this.prisma.outboxEvent.findMany({
        where: {
          Status: { in: ['PENDING', 'FAILED'] },
          NextAttemptAt: { lte: new Date() },
          Attempts: { lt: 5 },
        },
        orderBy: { CreatedAt: 'asc' },
        take: 50,
      });
      for (const event of events) {
        try {
          await this.queue.add(
            DISPATCH_OUTBOX_EVENT,
            { eventId: event.Id },
            { jobId: event.Id, removeOnComplete: true, removeOnFail: true },
          );
          await this.prisma.outboxEvent.updateMany({
            where: { Id: event.Id, Status: { in: ['PENDING', 'FAILED'] } },
            data: { Status: 'QUEUED', QueuedAt: new Date() },
          });
        } catch {
          this.logger.warn(`Outbox event ${event.Id} remains pending`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
