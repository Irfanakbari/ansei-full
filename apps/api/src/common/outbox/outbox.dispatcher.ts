import { integrationDeadline } from './integration-deadline';
import { SapPostingService } from '../sap/sap-posting.service';
import { Optional } from '@nestjs/common';
/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
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
import {
  OutboxStateService,
  SAFE_RETRY,
  UNCERTAIN,
  PRINT_READY,
  SENDING,
  jobIdentity,
} from './outbox-state.service';

@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(OUTBOX_QUEUE) private readonly queue: Queue,
    private readonly state: OutboxStateService,
    @Optional() private readonly sapPosting?: SapPostingService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => this.scheduleDispatch(), 5000);
    this.timer.unref();
    this.scheduleDispatch();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private scheduleDispatch() {
    void this.dispatch().catch(() =>
      this.logger.error(
        'Integration dispatch unavailable; durable records retained.',
      ),
    );
  }

  async dispatch(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.sapPosting?.heartbeat();
      const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
      const active = await this.prisma.outboxEvent.findMany({
        where: {
          Status: { in: ['QUEUED', 'PROCESSING'] },
          UpdatedAt: { lt: staleBefore },
        },
        take: 50,
        orderBy: { UpdatedAt: 'asc' },
      });
      for (const event of active) {
        // A durable send marker is never automatically replayed, even if Redis lost the job.
        if (
          event.LastErrorCode === SENDING ||
          event.Attempts === 0 ||
          (event.Status === 'PROCESSING' &&
            ![PRINT_READY, 'OUTBOX_PREPARING'].includes(
              event.LastErrorCode ?? '',
            ))
        ) {
          await this.state.change(
            event,
            {
              Status: 'FAILED',
              FailedAt: new Date(),
              LastErrorCode: UNCERTAIN,
              LastError:
                'Delivery outcome requires reconciliation before retry.',
            },
            'INTERRUPTED',
          );
          continue;
        }
        if (
          event.Status === 'PROCESSING' &&
          event.LastErrorCode === PRINT_READY
        ) {
          const printJob = await (
            this.prisma as unknown as {
              printJob: {
                findUnique(input: object): Promise<{ Id: string } | null>;
              };
            }
          ).printJob.findUnique({
            where: { OutboxEventId: event.Id },
            select: { Id: true },
          });
          if (printJob) continue;
        }
        const job = await integrationDeadline(
          this.queue.getJob(jobIdentity(event)),
        );
        const status = job
          ? await integrationDeadline(job.getState())
          : 'missing';
        if (
          [
            'active',
            'waiting',
            'delayed',
            'prioritized',
            'waiting-children',
          ].includes(status)
        )
          continue;
        await this.state.change(
          event,
          {
            Status: 'FAILED',
            FailedAt: new Date(),
            LastErrorCode: SAFE_RETRY,
            LastError:
              'Interrupted before external delivery; safe retry available.',
            NextAttemptAt: new Date(),
          },
          'RECOVER',
        );
      }
      const events = await this.prisma.outboxEvent.findMany({
        where: {
          ...(this.sapPosting && !(await this.sapPosting.postingEnabled())
            ? {
                Type: {
                  notIn: ['SAP_TRANSACTION', 'SAP_MATERIAL_UPDATE'] as const,
                },
              }
            : {}),
          OR: [
            { Status: 'PENDING' },
            { Status: 'FAILED', LastErrorCode: SAFE_RETRY },
          ],
          NextAttemptAt: { lte: new Date() },
          Attempts: { lt: this.prisma.outboxEvent.fields.MaxAttempts },
        },
        orderBy: { NextAttemptAt: 'asc' },
        take: 50,
      });
      for (const event of events) {
        if (event.Attempts >= event.MaxAttempts) continue;
        const claimed = await this.state.change(
          event,
          {
            Status: 'QUEUED',
            Attempts: { increment: 1 },
            QueuedAt: new Date(),
            ProcessingAt: null,
            FailedAt: null,
            LastErrorCode: null,
            LastError: null,
          },
          'QUEUE',
        );
        if (!claimed) continue;
        try {
          // Commit QUEUED before publishing. A worker can safely claim immediately.
          await integrationDeadline(
            this.queue.add(
              DISPATCH_OUTBOX_EVENT,
              { eventId: claimed.Id, attempt: claimed.Attempts },
              {
                jobId: jobIdentity(claimed),
                attempts: 1,
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 86400 },
              },
            ),
          );
        } catch {
          // Redis may have accepted the job before the response was lost. CAS fences that job if it has not started.
          await this.state.change(
            claimed,
            {
              Status: 'FAILED',
              LastErrorCode: SAFE_RETRY,
              LastError: 'Queue publish interrupted before delivery.',
              NextAttemptAt: new Date(
                Date.now() +
                  Math.min(
                    300000,
                    5000 * 2 ** Math.min(claimed.Attempts - 1, 6),
                  ),
              ),
            },
            'QUEUE_FAILED',
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
