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
    const printJob = { Id: 'print-job' };
    const db = {
      outboxEvent: { findUnique: jest.fn().mockResolvedValue(event) },
      profilePrinter: {
        findFirst: jest.fn().mockResolvedValue({
          Id: 'profile',
          AgentId: 'agent',
          ProfileSnapshot: { printer: 'fixture' },
        }),
      },
      printJob: { create: jest.fn().mockResolvedValue(printJob) },
      printJobEvent: { create: jest.fn() },
      $transaction: jest.fn((callback) => callback(db)),
      materialDeliveryNote: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(dn),
      },
      stockOpname: {
        findUnique: jest.fn().mockResolvedValue({ RecordNumber: 'STO-001' }),
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
      sendEmail: jest.fn().mockResolvedValue({ success: true }),
    };
    const notes = {
      generateDeliveryNotePDF: jest
        .fn()
        .mockResolvedValue(Buffer.from('fixture')),
    };
    const documents = {
      buildAndPersist: jest.fn(),
      download: jest.fn().mockResolvedValue({
        artifact: { FileName: 'package.zip' },
        response: {
          response: {
            arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('zip')),
          },
        },
      }),
    };
    const inventoryCounting = {
      generateSnapshot: jest.fn().mockResolvedValue(Buffer.from('snapshot')),
    };
    const sapMaterial = { send: jest.fn().mockResolvedValue('SENT') };
    const queue = { add: jest.fn() };
    return {
      event,
      sapMaterial,
      db,
      state,
      smtp,
      notes,
      documents,
      inventoryCounting,
      queue,
      processor: new OutboxProcessor(
        db as never,
        smtp as never,
        notes as never,
        documents as never,
        inventoryCounting as never,
        state as never,
        sapMaterial as never,
      ),
      job: {
        name: 'dispatchOutboxEvent',
        data: { eventId: 'event', attempt: 1 },
      },
    };
  }
  it('records successful SAP delivery without email or printer side effects', async () => {
    const f = fixture('SAP_MATERIAL_UPDATE');
    await f.processor.process(f.job as never);
    expect(f.sapMaterial.send).toHaveBeenCalledWith(f.event.Payload);
    expect(f.state.change).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        Status: 'SUCCEEDED',
        LastErrorCode: 'SAP_MATERIAL_SYNCED',
      }),
      'SAP_SYNCED',
    );
    expect(f.smtp.sendEmail).not.toHaveBeenCalled();
  });
  it('marks idempotent SAP field updates retryable on failure', async () => {
    const f = fixture('SAP_MATERIAL_UPDATE');
    f.sapMaterial.send.mockRejectedValue(
      new Error('private upstream response'),
    );
    await f.processor.process(f.job as never);
    expect(f.state.change).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        Status: 'FAILED',
        LastErrorCode: SAFE_RETRY,
        LastError: 'SAP material synchronization failed; retry scheduled.',
      }),
      'PREPARATION_FAILED',
    );
  });
  it('records a superseded SAP event without claiming it was applied', async () => {
    const f = fixture('SAP_MATERIAL_UPDATE');
    f.sapMaterial.send.mockResolvedValue('SUPERSEDED');
    await f.processor.process(f.job as never);
    expect(f.state.change).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ LastErrorCode: 'SAP_MATERIAL_SUPERSEDED' }),
      'SAP_SUPERSEDED',
    );
  });
  it('uses the established stock snapshot workbook for inventory package generation', async () => {
    const f = fixture('INVENTORY_COUNTING_PACKAGE');
    f.event.Payload = { inventoryCountingId: 'sto-1', actor: 'counter' };

    await f.processor.process(f.job as never);

    expect(f.inventoryCounting.generateSnapshot).toHaveBeenCalledWith('sto-1');
    expect(f.documents.buildAndPersist).toHaveBeenCalledWith(
      'sto-1',
      'counter',
      Buffer.from('snapshot'),
    );
    expect(f.state.change).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        Status: 'SUCCEEDED',
        LastErrorCode: 'OUTBOX_ARTIFACT_PERSISTED',
      }),
      'ARTIFACT_PERSISTED',
    );
  });

  it('escapes package email content before SMTP submission', async () => {
    const f = fixture('INVENTORY_COUNTING_PACKAGE_EMAIL');
    f.event.Payload = {
      inventoryCountingId: 'sto-1',
      actor: 'counter',
      recipients: ['user@example.test'],
      message: '<script>alert("x")</script>\nNext',
    };
    f.smtp.sendEmail = jest.fn().mockResolvedValue({ success: true });

    await f.processor.process(f.job as never);

    expect(f.smtp.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['user@example.test'],
        html: expect.stringContaining(
          '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;<br>Next',
        ),
      }),
      'counter',
    );
  });

  it('creates an immutable agent print job without completing the outbox event', async () => {
    const f = fixture('PRINT_PART_TAG_ANSEI');
    await f.processor.process(f.job as never);
    expect(f.db.printJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        OutboxEventId: 'event',
        AgentId: 'agent',
        ProfileId: 'profile',
        PayloadSnapshot: expect.objectContaining({ poId: 'po' }),
        ProfileSnapshot: { printer: 'fixture' },
      }),
    });
    expect(f.db.printJobEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ JobId: 'print-job', Type: 'CREATED' }),
    });
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
