/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { ConfigService } from '@nestjs/config';
import type {
  OutboxEvent,
  Prisma,
  SapTransaction,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OutboxStateService,
  SENDING,
  UNCERTAIN,
} from '../outbox/outbox-state.service';
import { SapItemSyncService, SapPostingError } from './sap-item-sync.service';
import { SapPostingService, SapBlocked } from './sap-posting.service';
import { captureSapIntent, createSapLedger } from './sap-transaction-capture';
import { reconcileStock, sapStatus } from './sap-connection.service';

describe('SAP stock reconciliation', () => {
  test.each([
    [100, 0, 0, 100, 0],
    [80, 20, 0, 100, 0],
    [80, 0, -20, 100, 0],
    [80, 0, 0, 80, 0],
    [120, 0, 20, 100, 0],
    [78, 0, -2, 80, 0],
    [78, 2, 0, 80, 0],
    [80, 18, -2, 100, 0],
    [80, 18, 0, 98, 0],
    [80, 0, 0, 85, 5],
  ])(
    'reconciles MES %s + bridge %s - pending %s against SAP %s',
    (mes, bridge, pending, sap, expected) => {
      expect(reconcileStock(mes, bridge, pending, sap).unexplained).toBe(
        expected,
      );
    },
  );
  it('never treats missing SAP stock as zero', () =>
    expect(reconcileStock(0, 0, 0, null).unexplained).toBeNull());
  it('requires SAP completion evidence for Synced', () => {
    expect(
      sapStatus({
        Status: 'SUCCEEDED',
        LastErrorCode: 'OUTBOX_MANUALLY_CONFIRMED',
      }),
    ).toBe('BLOCKED');
    expect(
      sapStatus({
        Status: 'SUCCEEDED',
        LastErrorCode: 'SAP_TRANSACTION_SYNCED',
      }),
    ).toBe('SYNCED');
  });
});

describe('Atomic SAP intent capture', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.SAP_TRANSACTION_CAPTURE_ENABLED = 'true';
    process.env.SAP_TRANSACTION_MATERIAL_ALLOWLIST = 'MAT';
    process.env.SAP_COMPANY_DB = 'TEST';
  });
  afterEach(() => {
    process.env = { ...original };
  });
  function fixture(type = 'INCOMING_SUPPLIER', demand?: string) {
    const ledger = {
      Id: 'ledger',
      MaterialId: 'MES-MAT',
      FinishGoodId: null,
      TransactionType: type,
      QtyIn: type === 'INCOMING_SUPPLIER' ? 20 : 0,
      QtyOut: type === 'INCOMING_SUPPLIER' ? 0 : 20,
      CreatedBy: 'operator',
      TransactionDate: new Date(),
      ReferenceDoc: 'reference',
    };
    const db = {
      inventoryLedger: { create: jest.fn().mockResolvedValue(ledger) },
      sapConnectionState: { findUnique: jest.fn().mockResolvedValue(null) },
      material: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ PartNumber: 'MES-MAT', PartNumberSAP: 'MAT' }),
      },
      sapTransaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation((args: { data: unknown }) => args.data),
      },
      outboxEvent: { create: jest.fn() },
      sapBackflushPick: { create: jest.fn() },
      logProcess: { create: jest.fn() },
      actionAuditEvent: { create: jest.fn() },
    };
    return {
      db,
      ledger,
      run: () =>
        createSapLedger(
          db as unknown as Prisma.TransactionClient,
          { data: {} } as Prisma.InventoryLedgerCreateArgs,
          demand,
        ),
    };
  }
  it('captures incoming and ledger in the same provided transaction', async () => {
    const f = fixture();
    await f.run();
    expect(f.db.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ Type: 'SAP_TRANSACTION' }),
      }),
    );
    expect(f.db.sapTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          LedgerId: 'ledger',
          Kind: 'GOODS_RECEIPT',
          Effects: [{ itemCode: 'MAT', quantity: 20 }],
        }),
      }),
    );
  });
  it('standard picking creates bridge quantity, not a Goods Issue', async () => {
    const f = fixture('PRODUCTION_USAGE', 'demand');
    await f.run();
    expect(f.db.sapBackflushPick.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ Quantity: 20, DemandId: 'demand' }),
      }),
    );
    expect(f.db.outboxEvent.create).not.toHaveBeenCalled();
  });
  it('additional non-production picking creates only one Goods Issue', async () => {
    const f = fixture('PRODUCTION_USAGE');
    await f.run();
    expect(f.db.sapTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ Kind: 'GOODS_ISSUE', Quantity: 20 }),
      }),
    );
    expect(f.db.sapBackflushPick.create).not.toHaveBeenCalled();
  });
  it('disabled capture preserves the existing ledger operation without integration writes', async () => {
    process.env.SAP_TRANSACTION_CAPTURE_ENABLED = 'false';
    const f = fixture();
    expect(await f.run()).toBe(f.ledger);
    expect(f.db.outboxEvent.create).not.toHaveBeenCalled();
  });
  it('duplicate source events do not create a second outbox job', async () => {
    const f = fixture();
    f.db.sapTransaction.findUnique.mockResolvedValue({
      Id: 'existing',
    });
    const result = await captureSapIntent(
      f.db as unknown as Prisma.TransactionClient,
      {
        sourceKey: 'same',
        kind: 'GOODS_RECEIPT',
        itemCode: 'MAT',
        quantity: 1,
        snapshot: {},
        effects: [],
      },
      'operator',
    );
    expect(result.Id).toBe('existing');
    expect(f.db.outboxEvent.create).not.toHaveBeenCalled();
  });
});

describe('SAP posting failure boundaries', () => {
  function fixture() {
    const event = {
      Id: 'event',
      Status: 'PROCESSING',
      Attempts: 1,
      LastErrorCode: 'OUTBOX_PREPARING',
    } as OutboxEvent;
    const row = {
      Id: 'event',
      Kind: 'GOODS_RECEIPT',
      SubmittedRequest: null,
    } as SapTransaction;
    const db = {
      sapTransaction: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(row),
        update: jest.fn(),
      },
      sapConnectionState: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ IntegrationSettings: { enabled: true } }),
      },
      $transaction: jest.fn(),
      $executeRaw: jest.fn(),
    };
    db.$transaction.mockImplementation((work: (tx: unknown) => unknown) =>
      work(db),
    );
    const state = {
      change: jest
        .fn()
        .mockImplementation((previous: OutboxEvent, data: object) => ({
          ...previous,
          ...data,
        })),
      changeInTransaction: jest
        .fn()
        .mockImplementation(
          (_tx: unknown, previous: OutboxEvent, data: object) => ({
            ...previous,
            ...data,
          }),
        ),
    };
    const sap = {
      postTransaction: jest
        .fn()
        .mockImplementation(
          async (
            _resource: string,
            _body: object,
            before: () => Promise<void>,
          ) => {
            await before();
            return { DocEntry: 1, DocNum: 2 };
          },
        ),
    };
    const service = new SapPostingService(
      db as unknown as PrismaService,
      sap as unknown as SapItemSyncService,
      state as unknown as OutboxStateService,
      new ConfigService({ SAP_TRANSACTION_WRITE_ENABLED: 'true' }),
    );
    const prepare = jest.spyOn(service, 'prepare').mockResolvedValue({
      resource: 'InventoryGenEntries',
      body: {},
      method: 'POST',
    });
    const confirm = jest.spyOn(service, 'confirm').mockResolvedValue(undefined);
    return { service, event, db, state, sap, prepare, confirm };
  }
  it('persists a send marker and immutable request before external POST', async () => {
    const f = fixture();
    await f.service.process(f.event);
    expect(f.state.changeInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      f.event,
      { LastErrorCode: SENDING },
      'SAP_SENDING',
      'SYSTEM:OUTBOX',
    );
    expect(f.db.sapTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          SubmittedRequest: {
            resource: 'InventoryGenEntries',
            body: {},
            method: 'POST',
          },
        },
      }),
    );
    expect(f.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ LastErrorCode: SENDING }),
      1,
      2,
    );
  });
  it('pauses without calling SAP or exhausting retry budget, then resumes the same event', async () => {
    const f = fixture();
    f.db.sapConnectionState.findUnique.mockResolvedValue({
      IntegrationSettings: { enabled: false },
    });
    await f.service.process(f.event);
    expect(f.sap.postTransaction).not.toHaveBeenCalled();
    expect(f.state.change).toHaveBeenLastCalledWith(
      f.event,
      expect.objectContaining({
        Status: 'PENDING',
        LastErrorCode: 'SAP_PAUSED',
        MaxAttempts: { increment: 1 },
      }),
      'SAP_PAUSED',
    );
    f.db.sapConnectionState.findUnique.mockResolvedValue({
      IntegrationSettings: { enabled: true },
    });
    await f.service.process(f.event);
    expect(f.sap.postTransaction).toHaveBeenCalledTimes(1);
  });
  it('an interrupted POST is held for reconciliation instead of automatic retry', async () => {
    const f = fixture();
    f.sap.postTransaction.mockImplementation(
      async (_r: string, _b: object, before: () => Promise<void>) => {
        await before();
        throw new SapPostingError(true);
      },
    );
    await f.service.process(f.event);
    expect(f.state.change).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ Status: 'FAILED', LastErrorCode: UNCERTAIN }),
      'SAP_FAILED',
    );
    expect(f.confirm).not.toHaveBeenCalled();
  });
  it('a database failure after SAP acceptance remains uncertain', async () => {
    const f = fixture();
    f.confirm.mockRejectedValue(new Error('database unavailable'));
    await f.service.process(f.event);
    expect(f.state.change).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ LastErrorCode: UNCERTAIN }),
      'SAP_FAILED',
    );
  });
  it('SAP business rejection is blocked and visible', async () => {
    const f = fixture();
    f.sap.postTransaction.mockRejectedValue(new SapPostingError(false, 400));
    await f.service.process(f.event);
    expect(f.state.change).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ LastErrorCode: 'SAP_BLOCKED' }),
      'SAP_FAILED',
    );
  });
  it('dependency waiting does not exhaust retry attempts', async () => {
    const f = fixture();
    f.prepare.mockRejectedValue(
      new SapBlocked('Waiting for a verified SAP production order.'),
    );
    await f.service.process(f.event);
    expect(f.sap.postTransaction).not.toHaveBeenCalled();
    expect(f.state.change).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        Status: 'PENDING',
        MaxAttempts: { increment: 1 },
      }),
      'SAP_WAIT_DEPENDENCY',
    );
  });
  it('a fenced worker cannot confirm a posting', async () => {
    const f = fixture();
    f.state.changeInTransaction.mockResolvedValue(null);
    await f.service.process(f.event);
    expect(f.confirm).not.toHaveBeenCalled();
    expect(f.db.sapTransaction.update).not.toHaveBeenCalled();
  });
});
