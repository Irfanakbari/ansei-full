import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { OutboxPayload, SafeOutboxEvent } from './outbox.types';

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

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
      type: 'PRINT_PART_TAG_ANSEI' | 'DELIVERY_NOTE_EMAIL';
      payload: OutboxPayload;
      actor: string;
      referenceType: string;
      referenceId: string;
    },
  ) {
    return tx.outboxEvent.upsert({
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

  async retry(id: string): Promise<SafeOutboxEvent> {
    const event = await this.prisma.outboxEvent.findUnique({
      where: { Id: id },
    });
    if (!event) throw new NotFoundException('Outbox event not found');
    if (event.Status === 'SUCCEEDED') return OutboxService.safeEvent(event);
    const updated = await this.prisma.outboxEvent.update({
      where: { Id: id },
      data: {
        Status: 'PENDING',
        Attempts: 0,
        NextAttemptAt: new Date(),
        LastErrorCode: null,
        LastError: null,
        FailedAt: null,
        ProcessingAt: null,
        QueuedAt: null,
      },
    });
    return OutboxService.safeEvent(updated);
  }

  async retryLatest(referenceType: string, referenceId: string) {
    const event = await this.prisma.outboxEvent.findFirst({
      where: { ReferenceType: referenceType, ReferenceId: referenceId },
      orderBy: { CreatedAt: 'desc' },
    });
    if (!event) throw new NotFoundException('Outbox event not found');
    return this.retry(event.Id);
  }
}
