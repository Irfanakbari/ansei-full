/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Injectable } from '@nestjs/common';
import type { Prisma, OutboxEvent } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../log-process/log-process.service';
import { auditedTransaction } from '../helpers/audited-transaction.helper';
import { auditContext } from '../helpers/audit-context.helper';

export const SAFE_RETRY = 'OUTBOX_SAFE_RETRY';
export const UNCERTAIN = 'OUTBOX_DELIVERY_UNCERTAIN';
export const PRINT_READY = 'OUTBOX_PRINT_READY';
export const SENDING = 'OUTBOX_SENDING';
export const jobIdentity = (event: { Id: string; Attempts: number }) =>
  `${event.Id}-${event.Attempts}`;

@Injectable()
export class OutboxStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogProcessService,
  ) {}

  change(
    event: OutboxEvent,
    data: Prisma.OutboxEventUpdateManyMutationInput,
    action: string,
    actor = 'SYSTEM:OUTBOX',
  ) {
    return auditedTransaction(this.prisma, (tx) =>
      this.changeInTransaction(tx, event, data, action, actor),
    );
  }

  async changeInTransaction(
    tx: Prisma.TransactionClient,
    event: OutboxEvent,
    data: Prisma.OutboxEventUpdateManyMutationInput,
    action: string,
    actor: string,
    reason?: string,
  ) {
    const changed = await tx.outboxEvent.updateMany({
      where: {
        Id: event.Id,
        Status: event.Status,
        Attempts: event.Attempts,
        UpdatedAt: event.UpdatedAt,
        LastErrorCode: event.LastErrorCode,
      },
      data,
    });
    if (!changed.count) return null;
    const updated = await tx.outboxEvent.findUniqueOrThrow({
      where: { Id: event.Id },
    });
    await this.record(tx, event, updated, action, actor, reason);
    return updated;
  }

  async record(
    tx: Prisma.TransactionClient,
    event: OutboxEvent,
    updated: OutboxEvent,
    action: string,
    actor: string,
    reason?: string,
  ) {
    const log = await this.logs.startProcess({
      functionId: 'OUTBOX',
      functionName: `Outbox.${action}`,
      createdBy: actor,
      client: tx,
    });
    await this.logs.completeProcess(
      log.ProcessId,
      updated.Status === 'FAILED' && action !== 'CLOSE' ? 'FAILED' : 'SUCCESS',
      `Integration ${action}; event ${event.Id}`,
      tx,
    );
    const fields = (row: OutboxEvent) => ({
      status: row.Status,
      attempts: row.Attempts,
      maxAttempts: row.MaxAttempts,
      errorCode: row.LastErrorCode,
    });
    await tx.actionAuditEvent.create({
      data: {
        SourceType: 'OutboxEvent',
        SourceId: event.Id,
        Action: action,
        Actor: actor,
        ActorSource:
          actor === 'SYSTEM:OUTBOX' ? 'SYSTEM_WORKER' : 'AUTHENTICATED_COMMAND',
        ProcessId: log.ProcessId,
        RequestId: auditContext.getStore()?.requestId,
        Before: fields(event),
        After: { ...fields(updated), ...(reason ? { reason } : {}) },
      },
    });
    return updated;
  }
}
