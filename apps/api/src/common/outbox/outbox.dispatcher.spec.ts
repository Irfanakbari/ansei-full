import { OutboxDispatcher } from './outbox.dispatcher';

describe('OutboxDispatcher', () => {
  it('leaves a durable event pending when BullMQ is unavailable', async () => {
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([{ Id: 'event-1' }]),
        updateMany: jest.fn(),
      },
    };
    const queue = { add: jest.fn().mockRejectedValue(new Error('offline')) };
    const dispatcher = new OutboxDispatcher(prisma as never, queue as never);

    await dispatcher.dispatch();

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledTimes(1);
  });

  it('marks a pending event queued only after BullMQ accepts it', async () => {
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([{ Id: 'event-1' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const queue = { add: jest.fn().mockResolvedValue({ id: 'event-1' }) };
    const dispatcher = new OutboxDispatcher(prisma as never, queue as never);

    await dispatcher.dispatch();

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { Id: 'event-1', Status: { in: ['PENDING', 'FAILED'] } },
        data: expect.objectContaining({ Status: 'QUEUED' }),
      }),
    );
  });

  it('recovers stale queued and processing claims after an outage', async () => {
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const dispatcher = new OutboxDispatcher(prisma as never, {} as never);

    await dispatcher.dispatch();

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          Status: { in: ['QUEUED', 'PROCESSING'] },
        }),
        data: expect.objectContaining({ Status: 'PENDING' }),
      }),
    );
  });

  it('contains startup dispatch failures instead of creating an unhandled rejection', async () => {
    jest.useFakeTimers();
    const prisma = {
      outboxEvent: {
        updateMany: jest.fn().mockRejectedValue(new Error('missing table')),
      },
    };
    const dispatcher = new OutboxDispatcher(prisma as never, {} as never);

    expect(() => dispatcher.onModuleInit()).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    dispatcher.onModuleDestroy();
    jest.useRealTimers();
  });
});
