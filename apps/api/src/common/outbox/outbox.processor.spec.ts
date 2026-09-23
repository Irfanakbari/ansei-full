/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { OutboxProcessor } from './outbox.processor';
import { SAFE_RETRY, SENDING, UNCERTAIN } from './outbox-state.service';
import { OutboxService } from './outbox.service';
describe('OutboxProcessor', () => {
  const dn = {
    DeliveryNoteNum: 'TEST',
    Destination: 'fixture',
    Status: 'DRAFT',
    CreatedAt: new Date(),
    ShippedAt: null,
    ReceivedAt: null,
    Details: [],
  };
  function fixture(type = 'DELIVERY_NOTE_EMAIL') {
    const event = {
      Id: 'event',
      Type: type,
      Status: 'QUEUED',
      Attempts: 1,
      MaxAttempts: 5,
      Payload:
        type === 'DELIVERY_NOTE_EMAIL'
          ? {
              deliveryNoteId: 'dn',
              documentVersion: OutboxService.fingerprint([
                dn.DeliveryNoteNum,
                dn.Destination,
                dn.Status,
                dn.CreatedAt,
                dn.ShippedAt,
                dn.ReceivedAt,
                dn.Details,
              ]),
              to: ['fixture@example.invalid'],
              cc: [],
              sentBy: 'actor',
            }
          : {
              poId: 'po',
              qtyOrder: 2,
              qtyPerbox: 1,
              partNumber: 'fg',
              partName: 'test',
              vendorCode: 'v',
              classificationCode: 'c',
              deliveryDate: new Date().toISOString(),
              poNumber: 'po',
              receivingArea: 'test',
            },
    };
    const db = {
      outboxEvent: { findUnique: jest.fn().mockResolvedValue(event) },
      materialDeliveryNote: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(dn),
      },
    };
    const state = {
      change: jest.fn().mockImplementation((previous, data) =>
        Promise.resolve({
          ...previous,
          ...data,
        }),
      ),
    };
    const smtp = {
      sendDeliveryNoteEmail: jest.fn().mockResolvedValue({ success: true }),
    };
    const notes = {
      generateDeliveryNotePDF: jest
        .fn()
        .mockResolvedValue(Buffer.from('fixture')),
    };
    const queue = { add: jest.fn() };
    return {
      event,
      db,
      state,
      smtp,
      notes,
      queue,
      processor: new OutboxProcessor(
        db as never,
        smtp as never,
        notes as never,
        queue as never,
        state as never,
      ),
      job: {
        name: 'dispatchOutboxEvent',
        data: { eventId: 'event', attempt: 1 },
      },
    };
  }
  it('does not report printer success just because the downstream queue accepted the job', async () => {
    const f = fixture('PRINT_PART_TAG_ANSEI');
    await f.processor.process(f.job as never);
    expect(f.queue.add).toHaveBeenCalledWith(
      'printPartTagAnsei',
      expect.objectContaining({ outboxEventId: 'event', outboxAttempt: 1 }),
      expect.objectContaining({ attempts: 1 }),
    );
    expect(
      f.state.change.mock.calls.some((call) => call[1].Status === 'SUCCEEDED'),
    ).toBe(false);
  });
  it('fences stale attempts before preparing any external operation', async () => {
    const f = fixture();
    f.job.data.attempt = 0;
    await f.processor.process(f.job as never);
    expect(f.smtp.sendDeliveryNoteEmail).not.toHaveBeenCalled();
    expect(f.state.change).not.toHaveBeenCalled();
  });
  it('marks a failed preparation safe for bounded retry', async () => {
    const f = fixture();
    f.notes.generateDeliveryNotePDF.mockRejectedValue(
      new Error('renderer offline'),
    );
    await f.processor.process(f.job as never);
    expect(f.state.change).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ LastErrorCode: SAFE_RETRY }),
      'PREPARATION_FAILED',
    );
    expect(f.smtp.sendDeliveryNoteEmail).not.toHaveBeenCalled();
  });
  it('quarantines SMTP failure after the durable send marker', async () => {
    const f = fixture();
    f.smtp.sendDeliveryNoteEmail.mockImplementation(() => {
      expect(f.state.change).toHaveBeenLastCalledWith(
        expect.anything(),
        { LastErrorCode: SENDING },
        'SEND',
      );
      return Promise.resolve({ success: false });
    });
    await f.processor.process(f.job as never);
    expect(f.state.change).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ LastErrorCode: UNCERTAIN }),
      'UNCERTAIN',
    );
  });
  it('does not deliver a changed delivery note using an older command', async () => {
    const f = fixture();
    f.db.materialDeliveryNote.findUniqueOrThrow.mockResolvedValue({
      ...dn,
      Destination: 'changed',
    });
    await f.processor.process(f.job as never);
    expect(f.smtp.sendDeliveryNoteEmail).not.toHaveBeenCalled();
    expect(f.state.change).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ LastErrorCode: 'OUTBOX_DOCUMENT_CHANGED' }),
      'DOCUMENT_CHANGED',
    );
  });
  it('blocks delivery if the document changes while the PDF is being prepared', async () => {
    const f = fixture();
    f.db.materialDeliveryNote.findUniqueOrThrow
      .mockResolvedValueOnce(dn)
      .mockResolvedValueOnce({ ...dn, Destination: 'changed during render' });
    await f.processor.process(f.job as never);
    expect(f.smtp.sendDeliveryNoteEmail).not.toHaveBeenCalled();
    expect(f.state.change).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ LastErrorCode: 'OUTBOX_DOCUMENT_CHANGED' }),
      'DOCUMENT_CHANGED',
    );
  });

  it('submits pallet connector history to remote API and marks succeeded', async () => {
    const f = fixture('PALLET_CONNECTOR_HISTORY');
    f.event.Payload = { kode: 'PP2PANS001', deliveryId: 10 };
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch as any;

    await f.processor.process(f.job as never);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/connector/v2/histories'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode: 'PP2PANS001' }),
      }),
    );
    expect(f.state.change).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        Status: 'SUCCEEDED',
        LastErrorCode: 'OUTBOX_TRANSPORT_ACCEPTED',
      }),
      'TRANSPORT_ACCEPTED',
    );
  });
});
