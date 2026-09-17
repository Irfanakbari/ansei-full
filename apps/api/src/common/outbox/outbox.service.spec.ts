import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  const event = {
    Id: 'event-1',
    IdempotencyKey: 'key-1',
    Type: 'DELIVERY_NOTE_EMAIL',
    Payload: {},
    Status: 'FAILED',
    Attempts: 5,
    MaxAttempts: 5,
    NextAttemptAt: new Date('2026-09-17T00:00:00.000Z'),
    LastErrorCode: 'OUTBOX_RETRIES_EXHAUSTED',
    LastError: 'Delivery failed after the maximum number of attempts',
    CreatedAt: new Date('2026-09-17T00:00:00.000Z'),
    UpdatedAt: new Date('2026-09-17T00:01:00.000Z'),
    QueuedAt: null,
    ProcessingAt: null,
    SucceededAt: null,
    FailedAt: new Date('2026-09-17T00:01:00.000Z'),
    Actor: 'operator',
    ReferenceType: 'MATERIAL_DELIVERY_NOTE',
    ReferenceId: 'dn-1',
  };

  it('deduplicates commands through a deterministic unique-key upsert', async () => {
    const tx = { outboxEvent: { upsert: jest.fn().mockResolvedValue(event) } };
    const service = new OutboxService({} as never);
    const input = {
      idempotencyKey: 'key-1',
      type: 'DELIVERY_NOTE_EMAIL' as const,
      payload: {
        deliveryNoteId: 'dn-1',
        documentVersion: 'version-1',
        to: ['recipient@example.com'],
        cc: [],
        sentBy: 'operator',
      },
      actor: 'operator',
      referenceType: 'MATERIAL_DELIVERY_NOTE',
      referenceId: 'dn-1',
    };

    await service.create(tx as never, input);
    await service.create(tx as never, input);

    expect(tx.outboxEvent.upsert).toHaveBeenCalledTimes(2);
    expect(tx.outboxEvent.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { IdempotencyKey: 'key-1' },
        update: {},
      }),
    );
  });

  it('resets a failed event to pending for an explicit retry', async () => {
    const prisma = {
      outboxEvent: {
        findUnique: jest.fn().mockResolvedValue(event),
        update: jest.fn().mockResolvedValue({
          ...event,
          Status: 'PENDING',
          Attempts: 0,
          LastErrorCode: null,
          LastError: null,
          FailedAt: null,
        }),
      },
    };
    const service = new OutboxService(prisma as never);

    const result = await service.retry('event-1');

    expect(result.status).toBe('PENDING');
    expect(result.attempts).toBe(0);
    expect(result.error).toBeNull();
  });
});
