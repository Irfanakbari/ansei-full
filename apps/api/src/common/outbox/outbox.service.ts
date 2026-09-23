import { integrationDeadline } from './integration-deadline';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  OutboxStateService,
  SAFE_RETRY,
  UNCERTAIN,
  jobIdentity,
} from './outbox-state.service';
import { IntegrationQueryDto, RecoverIntegrationDto } from './outbox.dto';
import { auditedTransaction } from '../helpers/audited-transaction.helper';
import {
  claimCommand,
  finishCommand,
} from '../helpers/business-command.helper';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { OutboxPayload, SafeOutboxEvent } from './outbox.types';

@Injectable()
export class OutboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly state: OutboxStateService,
    @InjectQueue('outbox_queue') private readonly queue: Queue,
    @InjectQueue('printer_queue') private readonly printerQueue: Queue,
  ) {}

  static fingerprint(parts: unknown[]): string {
    return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  }

  static safeEvent(event: {
    Id: string;
    Type: string;
    Status: string;
    Attempts: number;
    MaxAttempts: number;
    NextAttemptAt: Date;
    LastErrorCode: string | null;
    LastError: string | null;
    CreatedAt: Date;
    UpdatedAt: Date;
    SucceededAt: Date | null;
    FailedAt: Date | null;
    ReferenceType: string | null;
    ReferenceId: string | null;
  }): SafeOutboxEvent {
    return {
      id: event.Id,
      type: event.Type,
      status: event.Status,
      completionEvidence:
        event.Status !== 'SUCCEEDED'
          ? 'NOT_COMPLETED'
          : event.LastErrorCode === 'OUTBOX_TRANSPORT_ACCEPTED'
            ? 'TRANSPORT_ACCEPTED'
            : event.LastErrorCode === 'OUTBOX_MANUALLY_CONFIRMED'
              ? 'MANUAL_CONFIRMATION'
              : 'LEGACY_UNVERIFIED',
      attempts: event.Attempts,
      maxAttempts: event.MaxAttempts,
      nextAttemptAt: event.NextAttemptAt,
      error:
        event.LastErrorCode && event.LastError
          ? { code: event.LastErrorCode, message: event.LastError }
          : null,
      createdAt: event.CreatedAt,
      updatedAt: event.UpdatedAt,
      succeededAt: event.SucceededAt,
      failedAt: event.FailedAt,
      referenceType: event.ReferenceType,
      referenceId: event.ReferenceId,
    };
  }

  async create(
    tx: Prisma.TransactionClient,
    input: {
      idempotencyKey: string;
      type:
        | 'PRINT_PART_TAG_ANSEI'
        | 'DELIVERY_NOTE_EMAIL'
        | 'PALLET_CONNECTOR_HISTORY';
      payload: OutboxPayload;
      actor: string;
      referenceType: string;
      referenceId: string;
    },
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('OUTBOX_CREATE'), hashtext(${input.idempotencyKey}))`;
    const previous = await tx.outboxEvent.findUnique({
      where: { IdempotencyKey: input.idempotencyKey },
    });
    if (previous) {
      await this.state.record(tx, previous, previous, 'REPLAY', input.actor);
      return previous;
    }
    const created = await tx.outboxEvent.upsert({
      where: { IdempotencyKey: input.idempotencyKey },
      create: {
        IdempotencyKey: input.idempotencyKey,
        Type: input.type,
        Payload: input.payload as unknown as Prisma.InputJsonValue,
        Actor: input.actor,
        ReferenceType: input.referenceType,
        ReferenceId: input.referenceId,
      },
      update: {},
    });
    await this.state.changeInTransaction(
      tx,
      created,
      { Status: 'PENDING' },
      'CREATE',
      input.actor,
    );
    return created;
  }

  async findById(id: string): Promise<SafeOutboxEvent> {
    const event = await this.prisma.outboxEvent.findUnique({
      where: { Id: id },
    });
    if (!event) throw new NotFoundException('Outbox event not found');
    return OutboxService.safeEvent(event);
  }

  async findLatest(referenceType: string, referenceId: string) {
    const event = await this.prisma.outboxEvent.findFirst({
      where: { ReferenceType: referenceType, ReferenceId: referenceId },
      orderBy: { CreatedAt: 'desc' },
    });
    return event ? OutboxService.safeEvent(event) : null;
  }

  async list(query: IntegrationQueryDto) {
    const where: Prisma.OutboxEventWhereInput = {
      Status: query.status,
      Type: query.type,
      ReferenceId: query.referenceId,
    };
    const [rows, totalItems] = await Promise.all([
      this.prisma.outboxEvent.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ CreatedAt: 'desc' }, { Id: 'desc' }],
      }),
      this.prisma.outboxEvent.count({ where }),
    ]);
    return {
      data: rows.map(OutboxService.safeEvent),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }
  async summary() {
    const [
      groups,
      oldest,
      uncertain,
      exhausted,
      queueAvailable,
      printerQueueAvailable,
    ] = await Promise.all([
      this.prisma.outboxEvent.groupBy({ by: ['Status'], _count: true }),
      this.prisma.outboxEvent.findFirst({
        where: { Status: { in: ['PENDING', 'QUEUED', 'PROCESSING'] } },
        orderBy: { CreatedAt: 'asc' },
        select: { CreatedAt: true },
      }),
      this.prisma.outboxEvent.count({
        where: { Status: 'FAILED', LastErrorCode: UNCERTAIN },
      }),
      this.prisma.outboxEvent.count({
        where: {
          Status: 'FAILED',
          LastErrorCode: SAFE_RETRY,
          Attempts: { gte: this.prisma.outboxEvent.fields.MaxAttempts },
        },
      }),
      integrationDeadline(
        this.queue.getJobCounts('waiting', 'active', 'failed'),
      )
        .then(() => true)
        .catch(() => false),
      integrationDeadline(
        this.printerQueue.getJobCounts('waiting', 'active', 'failed'),
      )
        .then(() => true)
        .catch(() => false),
    ]);
    const count = (status: string) =>
      groups.find((row) => row.Status === status)?._count ?? 0;
    return {
      pending: count('PENDING'),
      queued: count('QUEUED'),
      processing: count('PROCESSING'),
      failed: count('FAILED'),
      uncertain,
      exhausted,
      oldestPendingAt: oldest?.CreatedAt ?? null,
      queueAvailable,
      printerQueueAvailable,
      observedAt: new Date(),
    };
  }
  async recover(
    id: string,
    dto: RecoverIntegrationDto,
    actor: string,
  ): Promise<SafeOutboxEvent> {
    return auditedTransaction(
      this.prisma,
      async (tx) => {
        const claim = await claimCommand(
          tx,
          'INTEGRATION_RECOVER',
          dto.requestId,
          actor,
          { id, ...dto },
        );
        if (claim.duplicate)
          return claim.command.Result as unknown as SafeOutboxEvent;
        await tx.$executeRaw`SELECT "Id" FROM "OutboxEvent" WHERE "Id"=${id} FOR UPDATE`;
        const event = await tx.outboxEvent.findUnique({ where: { Id: id } });
        if (!event) throw new NotFoundException('Integration event not found');
        if (
          event.Status !== 'FAILED' ||
          event.Attempts !== dto.expectedAttempts ||
          event.LastErrorCode === 'OUTBOX_CLOSED'
        )
          throw new ConflictException(
            'Integration state changed or is not recoverable. Refresh before continuing.',
          );
        const uncertain = event.LastErrorCode !== SAFE_RETRY;
        if (
          (uncertain || dto.action === 'CONFIRM_DELIVERED') &&
          !dto.outcomeReconciled
        )
          throw new ConflictException(
            'Reconcile delivery outcome and stop any old worker before this action.',
          );
        if (
          dto.action === 'RETRY' &&
          event.LastErrorCode === 'OUTBOX_DOCUMENT_CHANGED'
        )
          throw new ConflictException(
            'Document changed; submit a new reviewed email request.',
          );
        const jobs = await integrationDeadline(
          Promise.all([
            this.queue.getJob(jobIdentity(event)),
            this.printerQueue.getJob(jobIdentity(event)),
          ]),
        );
        for (const job of jobs) {
          if (
            job &&
            [
              'active',
              'waiting',
              'delayed',
              'prioritized',
              'waiting-children',
            ].includes(await integrationDeadline(job.getState()))
          )
            throw new ConflictException(
              'A worker job is still active or queued. Reconcile it before recovery.',
            );
        }
        const data: Prisma.OutboxEventUpdateManyMutationInput =
          dto.action === 'RETRY'
            ? {
                Status: 'PENDING',
                MaxAttempts: event.Attempts + 1,
                NextAttemptAt: new Date(),
                FailedAt: null,
                LastErrorCode: null,
                LastError: null,
                ProcessingAt: null,
                QueuedAt: null,
              }
            : dto.action === 'CONFIRM_DELIVERED'
              ? {
                  Status: 'SUCCEEDED',
                  SucceededAt: new Date(),
                  LastErrorCode: 'OUTBOX_MANUALLY_CONFIRMED',
                  LastError: 'Delivery confirmed by an authorized operator.',
                }
              : {
                  LastErrorCode: 'OUTBOX_CLOSED',
                  LastError: 'Closed without further delivery.',
                };
        const updated = await this.state.changeInTransaction(
          tx,
          event,
          data,
          dto.action,
          actor,
          dto.reason.trim(),
        );
        if (!updated)
          throw new ConflictException(
            'Integration changed; refresh before continuing.',
          );
        const result = OutboxService.safeEvent(updated);
        await finishCommand(tx, claim.command.Id, result);
        return result;
      },
      { timeout: 15000 },
    );
  }
  retryLatest(referenceType: string, referenceId: string): Promise<never> {
    // Legacy endpoint cannot bypass reason, permission, concurrency and reconciliation controls.
    void referenceType;
    void referenceId;
    return Promise.reject(
      new ConflictException({
        code: 'INTEGRATION_RECOVERY_REQUIRED',
        message:
          'Use System Logs > Integrations to review and recover the failed delivery.',
      }),
    );
  }
}
