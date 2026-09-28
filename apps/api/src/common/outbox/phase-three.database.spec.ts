import { PrinterService } from '../printer/printer.service';
/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { randomUUID } from 'node:crypto';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../log-process/log-process.service';
import {
  OutboxStateService,
  SAFE_RETRY,
  PRINT_READY,
  SENDING,
  UNCERTAIN,
} from './outbox-state.service';
import { OutboxService } from './outbox.service';
import { OutboxDispatcher } from './outbox.dispatcher';
import { OutboxProcessor } from './outbox.processor';
import { auditContext } from '../helpers/audit-context.helper';
import { RecoverIntegrationDto } from './outbox.dto';
const suite =
  process.env.PHASE3_DATABASE_TEST === '1' ? describe : describe.skip;
suite(
  'Phase 3 PostgreSQL and Redis integration recovery',
  () => {
    let db: PrismaService;
    let state: OutboxStateService;
    let service: OutboxService;
    let queue: Queue;
    const connection = {
      host: '127.0.0.1',
      port: 6385,
      maxRetriesPerRequest: null,
    };
    const payload = {
      poId: 'fixture',
      qtyOrder: 2,
      qtyPerbox: 1,
      partNumber: 'fixture',
      partName: 'fixture',
      vendorCode: 'v',
      classificationCode: 'c',
      deliveryDate: new Date().toISOString(),
      poNumber: 'fixture',
      receivingArea: 'fixture',
    };
    const create = (data = {}) =>
      db.outboxEvent.create({
        data: {
          IdempotencyKey: randomUUID(),
          Type: 'PRINT_PART_TAG_ANSEI',
          Payload: payload,
          ...data,
        },
      });
    const recover = (id: string, dto: RecoverIntegrationDto) =>
      auditContext.run({ requestId: randomUUID() }, () =>
        service.recover(id, dto, 'recovery-operator'),
      );
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL!);
      if (
        url.hostname !== '127.0.0.1' ||
        url.port !== '56835' ||
        url.pathname !== '/ansei_phase3'
      )
        throw new Error('Disposable phase3 database required');
      db = new PrismaService();
      await db.$connect();
      state = new OutboxStateService(db, new LogProcessService(db));
      queue = new Queue(`phase3-outbox-${randomUUID()}`, { connection });
      service = new OutboxService(db, state, queue);
    });
    afterEach(async () => {
      await db.outboxEvent.updateMany({
        where: { Status: { in: ['PENDING', 'QUEUED', 'PROCESSING'] } },
        data: { Status: 'FAILED', LastErrorCode: 'OUTBOX_CLOSED' },
      });
    });
    afterAll(async () => {
      await queue.obliterate({ force: true });
      await queue.close();
      await db.$disconnect();
    });
    it('allows one dispatcher claim and an immediately running consumer sees QUEUED', async () => {
      const event = await create();
      let observed = '';
      const worker = new Worker(
        queue.name,
        async (job) => {
          const row = await db.outboxEvent.findUniqueOrThrow({
            where: { Id: job.data.eventId },
          });
          observed = row.Status;
        },
        { connection },
      );
      const completed = new Promise<void>((resolve, reject) => {
        worker.once('completed', () => resolve());
        worker.once('failed', (_, e) => reject(e));
      });
      try {
        await Promise.all([
          new OutboxDispatcher(db, queue, state).dispatch(),
          new OutboxDispatcher(db, queue, state).dispatch(),
        ]);
        await completed;
        expect(observed).toBe('QUEUED');
        expect(
          (await db.outboxEvent.findUniqueOrThrow({ where: { Id: event.Id } }))
            .Attempts,
        ).toBe(1);
        expect(
          await db.actionAuditEvent.count({
            where: { SourceId: event.Id, Action: 'QUEUE' },
          }),
        ).toBe(1);
      } finally {
        await worker.close();
      }
    });
    it('manual forecast print retry creates one durable event and preserves its result', async () => {
      const printing = new PrinterService(db, service);
      const key = randomUUID();
      const print = () =>
        auditContext.run({ requestId: randomUUID(), idempotencyKey: key }, () =>
          printing.printPartTagAnsei(
            { ...payload, deliveryDate: new Date(payload.deliveryDate) },
            'manual-operator',
          ),
        );
      const [first, second] = await Promise.all([print(), print()]);
      expect(first.id).toBe(second.id);
      expect(
        await db.actionAuditEvent.count({
          where: { SourceId: first.id, Action: 'CREATE' },
        }),
      ).toBe(1);
      expect(await db.outboxEvent.count({ where: { Id: first.id } })).toBe(1);
    });
    it('fences a stale callback even when timestamps fall within the same millisecond', async () => {
      const event = await create({
        Status: 'PROCESSING',
        Attempts: 1,
        LastErrorCode: PRINT_READY,
      });
      await db.outboxEvent.update({
        where: { Id: event.Id },
        data: { LastErrorCode: SENDING, UpdatedAt: event.UpdatedAt },
      });
      expect(
        await state.change(
          event,
          { Status: 'FAILED', LastErrorCode: SAFE_RETRY },
          'QUEUE_FAILED',
        ),
      ).toBeNull();
      expect(
        (await db.outboxEvent.findUniqueOrThrow({ where: { Id: event.Id } }))
          .LastErrorCode,
      ).toBe(SENDING);
    });
    it('retains legacy completion uncertainty instead of claiming transport evidence', async () => {
      const event = await create({ Status: 'SUCCEEDED' });
      expect((await service.findById(event.Id)).completionEvidence).toBe(
        'LEGACY_UNVERIFIED',
      );
    });
    it('rejects recovery while the previous job remains queued in Redis', async () => {
      const event = await create({
        Status: 'FAILED',
        Attempts: 1,
        LastErrorCode: UNCERTAIN,
      });
      const job = await queue.add(
        'dispatchOutboxEvent',
        {},
        { jobId: `${event.Id}-1` },
      );
      await expect(
        recover(event.Id, {
          requestId: randomUUID(),
          expectedAttempts: 1,
          reason: 'Review',
          action: 'RETRY',
          outcomeReconciled: true,
        }),
      ).rejects.toMatchObject({ status: 409 });
      await job.remove();
    });
    it('rolls back state, logs and audit if the surrounding transaction fails', async () => {
      const event = await create();
      const before = await db.logProcess.count();
      await expect(
        db.$transaction(async (tx) => {
          await state.changeInTransaction(
            tx,
            event,
            { Status: 'QUEUED' },
            'QUEUE',
            'fixture',
          );
          throw new Error('injected rollback');
        }),
      ).rejects.toThrow('injected');
      expect(
        (await db.outboxEvent.findUniqueOrThrow({ where: { Id: event.Id } }))
          .Status,
      ).toBe('PENDING');
      expect(
        await db.actionAuditEvent.count({ where: { SourceId: event.Id } }),
      ).toBe(0);
      expect(await db.logProcess.count()).toBe(before);
    });
    it('quarantines a lost external result and rejects old attempt callbacks', async () => {
      const event = await create({
        Status: 'PROCESSING',
        Attempts: 1,
        LastErrorCode: SENDING,
        UpdatedAt: new Date(Date.now() - 700000),
      });
      await new OutboxDispatcher(db, queue, state).dispatch();
      const current = await db.outboxEvent.findUniqueOrThrow({
        where: { Id: event.Id },
      });
      expect(current.LastErrorCode).toBe(UNCERTAIN);
      expect(
        await state.change(
          event,
          { Status: 'SUCCEEDED' },
          'TRANSPORT_ACCEPTED',
        ),
      ).toBeNull();
      await expect(
        recover(event.Id, {
          requestId: randomUUID(),
          expectedAttempts: 1,
          reason: 'Check required',
          action: 'RETRY',
        }),
      ).rejects.toMatchObject({ status: 409 });
    });
    it('replays one recovery command and preserves lifetime attempts with one extra permit', async () => {
      const event = await create({
        Status: 'FAILED',
        Attempts: 5,
        MaxAttempts: 5,
        LastErrorCode: SAFE_RETRY,
      });
      const dto: RecoverIntegrationDto = {
        requestId: randomUUID(),
        expectedAttempts: 5,
        reason: 'Dependency restored',
        action: 'RETRY',
      };
      const results = await Promise.all([
        recover(event.Id, dto),
        recover(event.Id, dto),
      ]);
      expect(JSON.parse(JSON.stringify(results[0]))).toEqual(
        JSON.parse(JSON.stringify(results[1])),
      );
      const row = await db.outboxEvent.findUniqueOrThrow({
        where: { Id: event.Id },
      });
      expect(row.Attempts).toBe(5);
      expect(row.MaxAttempts).toBe(6);
      expect(
        await db.actionAuditEvent.count({
          where: { SourceId: event.Id, Action: 'RETRY' },
        }),
      ).toBe(1);
      await expect(
        db.actionAuditEvent.deleteMany({ where: { SourceId: event.Id } }),
      ).rejects.toThrow();
    });
    it('rejects competing recovery identities and a reused key with different content', async () => {
      const event = await create({
        Status: 'FAILED',
        Attempts: 1,
        LastErrorCode: SAFE_RETRY,
      });
      const dto: RecoverIntegrationDto = {
        requestId: randomUUID(),
        expectedAttempts: 1,
        reason: 'Ready',
        action: 'RETRY',
      };
      const result = await Promise.allSettled([
        recover(event.Id, dto),
        recover(event.Id, { ...dto, requestId: randomUUID() }),
      ]);
      expect(result.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      const successful = result[0].status === 'fulfilled';
      if (successful)
        await expect(
          recover(event.Id, { ...dto, reason: 'Changed' }),
        ).rejects.toMatchObject({ status: 409 });
    });
    it('keeps printer PROCESSING after enqueue and publishes a tracked job', async () => {
      const agent = await db.printAgent.create({
        data: {
          Name: 'Phase 3 print agent',
          CreatedBy: 'TEST',
          UpdatedBy: 'TEST',
        },
      });
      const profile = await db.profilePrinter.create({
        data: {
          AgentId: agent.Id,
          ExternalId: `phase3-${randomUUID()}`,
          Name: 'Phase 3 default profile',
          DocumentType: 'PART_TAG_ANSEI',
          IsDefault: true,
          Revision: 1,
          ProfileSnapshot: { printerName: 'Phase 3 test printer' },
          SyncedAt: new Date(),
        },
      });
      const event = await create({ Status: 'QUEUED', Attempts: 1 });
      const processor = new OutboxProcessor(
        db,
        {} as never,
        {} as never,
        state,
      );
      await processor.process({
        name: 'dispatchOutboxEvent',
        data: { eventId: event.Id, attempt: 1 },
      } as never);
      const row = await db.outboxEvent.findUniqueOrThrow({
        where: { Id: event.Id },
      });
      expect(row.Status).toBe('PROCESSING');
      expect(row.LastErrorCode).toBe(PRINT_READY);
      expect(row.SucceededAt).toBeNull();
      const job = await db.printJob.findUnique({
        where: { OutboxEventId: event.Id },
      });
      expect(job?.OutboxEventId).toBe(event.Id);
      expect(job?.Status).toBe('QUEUED');
      if (job) {
        await db.printJobEvent.deleteMany({ where: { JobId: job.Id } });
        await db.printJob.delete({ where: { Id: job.Id } });
      }
      await db.profilePrinter.delete({ where: { Id: profile.Id } });
      await db.printAgent.delete({ where: { Id: agent.Id } });
    });
    it('recovers a queued job lost from Redis without losing database evidence', async () => {
      const event = await create({
        Status: 'QUEUED',
        Attempts: 1,
        UpdatedAt: new Date(Date.now() - 700000),
      });
      await new OutboxDispatcher(db, queue, state).dispatch();
      expect(
        (await db.outboxEvent.findUniqueOrThrow({ where: { Id: event.Id } }))
          .Attempts,
      ).toBe(2);
      expect(await queue.getJob(`${event.Id}-2`)).toBeDefined();
      expect(
        await db.actionAuditEvent.count({
          where: { SourceId: event.Id, Action: 'RECOVER' },
        }),
      ).toBe(1);
    });
    it('exposes paginated safe monitoring without payload or recipients', async () => {
      const reference = randomUUID();
      const event = await create({
        ReferenceId: reference,
        Status: 'FAILED',
        Attempts: 5,
        MaxAttempts: 5,
        LastErrorCode: SAFE_RETRY,
      });
      const response = await service.list({
        page: 1,
        limit: 1,
        referenceId: reference,
      });
      expect(response.data[0].id).toBe(event.Id);
      expect(response.meta.totalItems).toBe(1);
      expect(JSON.stringify(response)).not.toContain('Payload');
      const summary = await service.summary();
      expect(summary.queueAvailable).toBe(true);
      expect(summary.exhausted).toBeGreaterThan(0);
    });
  },
  30000,
);
