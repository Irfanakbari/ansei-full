import { OutboxDispatcher } from './outbox.dispatcher';
import { SAFE_RETRY, SENDING, UNCERTAIN } from './outbox-state.service';
describe('OutboxDispatcher', () => {
  const fixture = (active: object[] = [], pending: object[] = []) => {
    const db = {
      outboxEvent: {
        fields: { MaxAttempts: 'MaxAttempts' },
        findMany: jest
          .fn()
          .mockResolvedValueOnce(active)
          .mockResolvedValueOnce(pending),
      },
    };
    const queue = {
      add: jest.fn().mockResolvedValue({}),
      getJob: jest.fn().mockResolvedValue(null),
    };
    const state = {
      change: jest.fn().mockImplementation((event, data) =>
        Promise.resolve({
          ...event,
          ...data,
          Attempts: event.Attempts + (data.Attempts ? 1 : 0),
        }),
      ),
    };
    return {
      db,
      queue,
      state,
      dispatcher: new OutboxDispatcher(
        db as never,
        queue as never,
        state as never,
        queue as never,
      ),
    };
  };
  const event = {
    Id: 'event-1',
    Status: 'PENDING',
    Attempts: 0,
    MaxAttempts: 5,
  };
  it('commits a claim before a fast consumer can read the job', async () => {
    const { dispatcher, state, queue } = fixture([], [event]);
    queue.add.mockImplementation(() => {
      expect(state.change).toHaveBeenCalled();
      return Promise.resolve({});
    });
    await dispatcher.dispatch();
    expect(queue.add).toHaveBeenCalledWith(
      'dispatchOutboxEvent',
      { eventId: event.Id, attempt: 1 },
      expect.objectContaining({ jobId: 'event-1-1', attempts: 1 }),
    );
  });
  it('leaves a bounded safe retry when queue publication fails', async () => {
    const { dispatcher, state, queue } = fixture([], [event]);
    queue.add.mockRejectedValue(new Error('offline'));
    await dispatcher.dispatch();
    expect(state.change).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ Status: 'FAILED', LastErrorCode: SAFE_RETRY }),
      'QUEUE_FAILED',
    );
  });
  it('does not publish if a competing dispatcher already claimed the event', async () => {
    const { dispatcher, state, queue } = fixture([], [event]);
    state.change.mockResolvedValue(null);
    await dispatcher.dispatch();
    expect(queue.add).not.toHaveBeenCalled();
  });
  it('quarantines interrupted external sends rather than automatically repeating them', async () => {
    const { dispatcher, state, queue } = fixture([
      { ...event, Status: 'PROCESSING', Attempts: 2, LastErrorCode: SENDING },
    ]);
    await dispatcher.dispatch();
    expect(state.change).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ LastErrorCode: UNCERTAIN }),
      'INTERRUPTED',
    );
    expect(queue.add).not.toHaveBeenCalled();
  });
  it('honors each record maximum and excludes exhausted rows before pagination', async () => {
    const { dispatcher, db, queue } = fixture(
      [],
      [{ ...event, Attempts: 2, MaxAttempts: 2 }],
    );
    await dispatcher.dispatch();
    expect(queue.add).not.toHaveBeenCalled();
    expect(db.outboxEvent.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ Attempts: { lt: 'MaxAttempts' } }),
      }),
    );
  });
  it('does not recover an active queue job', async () => {
    const { dispatcher, state, queue } = fixture([
      { ...event, Status: 'QUEUED', Attempts: 1 },
    ]);
    queue.getJob.mockResolvedValue({
      getState: () => Promise.resolve('active'),
    });
    await dispatcher.dispatch();
    expect(state.change).not.toHaveBeenCalled();
  });
});
