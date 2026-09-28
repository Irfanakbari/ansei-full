import { OutboxService } from './outbox.service';
describe('OutboxService', () => {
  it('deduplicates event creation under a database key lock without storing payload in audit', async () => {
    const event = { Id: 'event', Status: 'PENDING', Attempts: 0 };
    const tx = {
      $executeRaw: jest.fn(),
      outboxEvent: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(event),
        upsert: jest.fn().mockResolvedValue(event),
      },
    };
    const state = { changeInTransaction: jest.fn(), record: jest.fn() };
    const service = new OutboxService({} as never, state as never, {} as never);
    const input = {
      idempotencyKey: 'key',
      type: 'DELIVERY_NOTE_EMAIL' as const,
      payload: {
        deliveryNoteId: 'dn',
        documentVersion: 'version',
        to: ['fixture@example.invalid'],
        cc: [],
        sentBy: 'actor',
      },
      actor: 'actor',
      referenceType: 'MATERIAL_DELIVERY_NOTE',
      referenceId: 'dn',
    };
    expect(await service.create(tx as never, input)).toBe(event);
    expect(await service.create(tx as never, input)).toBe(event);
    expect(tx.outboxEvent.upsert).toHaveBeenCalledTimes(1);
    expect(state.changeInTransaction).toHaveBeenCalledWith(
      tx,
      event,
      { Status: 'PENDING' },
      'CREATE',
      'actor',
    );
  });
  it('rejects legacy blind retry instead of resetting the attempt history', async () => {
    const service = new OutboxService({} as never, {} as never, {} as never);
    await expect(
      service.retryLatest('MATERIAL_DELIVERY_NOTE', 'dn'),
    ).rejects.toMatchObject({ status: 409 });
  });
});
