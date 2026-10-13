/* By Irfan Akbari Vuteq Indonesia - 2026-10-13 */
import { ConfigService } from '@nestjs/config';
import type {
  OutboxEvent,
  SapTransaction,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OutboxStateService,
  SAFE_RETRY,
  UNCERTAIN,
} from '../outbox/outbox-state.service';
import { SapCacheService } from './sap-cache.service';
import { SapConnectionService, sapRetryRank } from './sap-connection.service';
import { SapExternalMonitorService } from './sap-external-monitor.service';
import { SapItemSyncService } from './sap-item-sync.service';
import { SapPostingService } from './sap-posting.service';

describe('SAP dependency-aware recovery', () => {
  function event(id: string, kind: string, code = SAFE_RETRY) {
    return {
      Id: id,
      Type: 'SAP_TRANSACTION',
      Status: 'FAILED',
      Attempts: 2,
      MaxAttempts: 5,
      LastErrorCode: code,
      LastError: 'failure',
      FailedAt: new Date(),
      UpdatedAt: new Date(),
      CreatedAt: new Date('2026-10-13T00:00:00.000Z'),
    } as OutboxEvent;
  }
  function row(id: string, kind: string, code = SAFE_RETRY) {
    return {
      Id: id,
      Kind: kind,
      Company: 'TEST',
      Warehouse: 'DMY-ANS',
      ItemCode: 'FG',
      Quantity: 10,
      DemandId: 'DEMAND',
      Snapshot: {},
      Effects: [],
      SubmittedRequest: null,
      CreatedAt: new Date('2026-10-13T00:00:00.000Z'),
      Event: event(id, kind, code),
    } as SapTransaction & { Event: OutboxEvent };
  }
  function fixture(rows: ReturnType<typeof row>[]) {
    const commands = new Map<string, Record<string, unknown>>();
    const db = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(),
      businessCommand: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }) =>
            Promise.resolve(
              commands.get(where.Scope_RequestId.RequestId) ?? null,
            ),
          ),
        create: jest.fn().mockImplementation(({ data }) => {
          const command = {
            Id: `command-${commands.size}`,
            Result: null,
            ...data,
          };
          commands.set(data.RequestId, command);
          return Promise.resolve(command);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const command = [...commands.values()].find(
            (value) => value.Id === where.Id,
          )!;
          Object.assign(command, data);
          return Promise.resolve(command);
        }),
      },
      sapConnectionState: { findUnique: jest.fn().mockResolvedValue(null) },
      sapTransaction: {
        findMany: jest.fn().mockResolvedValue(rows),
        findUnique: jest
          .fn()
          .mockImplementation(({ where }) =>
            Promise.resolve(
              rows.find((value) => value.Id === where.Id) ?? null,
            ),
          ),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve(data)),
      },
      outboxEvent: { create: jest.fn() },
      actionAuditEvent: { create: jest.fn() },
      logProcess: { create: jest.fn() },
      logProcessDetail: { create: jest.fn(), createMany: jest.fn() },
    };
    db.$transaction.mockImplementation((work: (tx: unknown) => unknown) =>
      work(db),
    );
    const state = {
      changeInTransaction: jest
        .fn()
        .mockImplementation((_tx, previous, data) =>
          Promise.resolve({ ...previous, ...data }),
        ),
    };
    const posting = { prepare: jest.fn() };
    const service = new SapConnectionService(
      db as unknown as PrismaService,
      {} as SapItemSyncService,
      {} as SapCacheService,
      posting as unknown as SapPostingService,
      state as unknown as OutboxStateService,
      new ConfigService({
        SAP_COMPANY_DB: 'TEST',
        SAP_TRANSACTION_WAREHOUSE: 'DMY-ANS',
      }),
      {} as SapExternalMonitorService,
    );
    return { service, db, state, posting };
  }

  it('orders safe retries by SAP dependencies and never exposes stock writes', async () => {
    const rows = [
      row('delivery', 'DELIVERY'),
      row('order', 'PRODUCTION_ORDER'),
      row('release', 'PRODUCTION_RELEASE'),
    ];
    const f = fixture(rows);
    const result = await f.service.retryAll(
      {
        requestId: '00000000-0000-4000-8000-000000000001',
        reason: 'safe recovery',
      },
      'operator',
    );
    expect(result).toEqual({
      retried: ['order', 'release', 'delivery'],
      count: 3,
    });
    expect(
      f.state.changeInTransaction.mock.calls.map((call) => call[1].Id),
    ).toEqual(['order', 'release', 'delivery']);
    expect(f.db).not.toHaveProperty('inventoryLedger');
    expect(f.db).not.toHaveProperty('material');
    expect(f.db).not.toHaveProperty('finishGood');
    expect(sapRetryRank('PRODUCTION_ORDER')).toBeLessThan(
      sapRetryRank('DELIVERY'),
    );
  });

  it('queries only definitive failures without uncertain outcomes', async () => {
    const f = fixture([]);
    await f.service.retryAll(
      {
        requestId: '00000000-0000-4000-8000-000000000002',
        reason: 'safe recovery',
      },
      'operator',
    );
    expect(f.db.sapTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          Event: {
            Status: 'FAILED',
            LastErrorCode: { in: [SAFE_RETRY, 'SAP_BLOCKED'] },
          },
        }),
      }),
    );
    expect(UNCERTAIN).not.toBe(SAFE_RETRY);
  });

  it('is idempotent and takes the global advisory lock once', async () => {
    const f = fixture([row('order', 'PRODUCTION_ORDER')]);
    const dto = {
      requestId: '00000000-0000-4000-8000-000000000003',
      reason: 'safe recovery',
    };
    const first = await f.service.retryAll(dto, 'operator');
    const second = await f.service.retryAll(dto, 'operator');
    expect(second).toEqual(first);
    expect(f.state.changeInTransaction).toHaveBeenCalledTimes(1);
    expect(f.db.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('creates a replacement intent for a definitively rejected stale production order', async () => {
    const stale = row('old-order', 'PRODUCTION_ORDER', 'SAP_BLOCKED');
    stale.SubmittedRequest = {
      resource: 'ProductionOrders',
      method: 'POST',
      body: { PlannedQuantity: 9 },
    };
    const f = fixture([stale]);
    f.posting.prepare.mockResolvedValue({
      resource: 'ProductionOrders',
      method: 'POST',
      body: { PlannedQuantity: 10 },
    });
    const result = await f.service.retry(
      'old-order',
      {
        requestId: '00000000-0000-4000-8000-000000000004',
        reason: 'payload corrected',
      },
      'operator',
    );
    expect(result).toMatchObject({ replacedId: 'old-order' });
    expect(f.db.sapTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          SourceKey: 'replacement:old-order',
          Snapshot: expect.objectContaining({
            replacesIntentId: 'old-order',
            dueDate: expect.any(String),
          }),
        }),
      }),
    );
    expect(stale.SubmittedRequest).toEqual({
      resource: 'ProductionOrders',
      method: 'POST',
      body: { PlannedQuantity: 9 },
    });
  });

  it('retryAll includes and creates replacements for rejected production orders with stale requests', async () => {
    const stale = row('old-order-all', 'PRODUCTION_ORDER', 'SAP_BLOCKED');
    stale.SubmittedRequest = {
      resource: 'ProductionOrders',
      method: 'POST',
      body: { PlannedQuantity: 9 },
    };
    const f = fixture([stale]);
    f.posting.prepare.mockResolvedValue({
      resource: 'ProductionOrders',
      method: 'POST',
      body: { PlannedQuantity: 10 },
    });
    const result = await f.service.retryAll(
      {
        requestId: '00000000-0000-4000-8000-000000000005',
        reason: 'retry all stale orders',
      },
      'operator',
    );
    expect(result.count).toBe(1);
    expect(f.db.sapTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          SourceKey: 'replacement:old-order-all',
          Snapshot: expect.objectContaining({
            replacesIntentId: 'old-order-all',
            dueDate: expect.any(String),
          }),
        }),
      }),
    );
  });

  it('retryAll includes and creates replacements for rejected sales orders with duplicate NumAtCard', async () => {
    const stale = row('old-so-all', 'SALES_ORDER', 'SAP_BLOCKED');
    stale.SubmittedRequest = {
      resource: 'Orders',
      method: 'POST',
      body: { NumAtCard: 'PO-OLD' },
    };
    const f = fixture([stale]);
    f.posting.prepare.mockResolvedValue({
      resource: 'Orders',
      method: 'POST',
      body: { NumAtCard: 'DEMAND-UNIQUE' },
    });
    const result = await f.service.retryAll(
      {
        requestId: '00000000-0000-4000-8000-000000000006',
        reason: 'retry all stale sales orders',
      },
      'operator',
    );
    expect(result.count).toBe(1);
    expect(f.db.sapTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          SourceKey: 'replacement:old-so-all',
          Snapshot: expect.objectContaining({
            replacesIntentId: 'old-so-all',
          }),
        }),
      }),
    );
  });
});
