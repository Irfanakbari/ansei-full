/* By Irfan Akbari Vuteq Indonesia - 2026-10-10 */
import type { Prisma } from '../../generated/prisma/client';
import { cancelRejectedCounting } from './sap-counting-recovery';

describe('STO rejected posting compensation', () => {
  function fixture() {
    const snapshot = {
      countingId: 'sto',
      rootId: 'root',
      reference: 'AIC-10102601',
      category: 'MATERIAL',
      date: '2026-10-10',
      lines: [{ itemCode: 'MAT', parts: ['MAT'], before: 10, counted: 9 }],
    };
    const event = {
      Status: 'FAILED',
      LastErrorCode: 'SAP_BLOCKED',
      UpdatedAt: new Date(),
    };
    const posting = {
      Id: 'post',
      Kind: 'INVENTORY_POSTING',
      PostedAt: null,
      DocumentEntry: null,
      Snapshot: snapshot,
      Event: event,
    };
    const root = {
      Id: 'root',
      ItemCode: 'MAT',
      PostedAt: new Date(),
      Event: { ReferenceType: 'STO_HOLD' },
    };
    const close = {
      Id: 'close',
      PostedAt: null,
      SubmittedRequest: null,
      Event: { ...event, Status: 'PENDING', LastErrorCode: 'SAP_DEPENDENCY' },
    };
    const ledger = {
      Id: 'original',
      ItemCategory: 'MATERIAL',
      MaterialId: 'MAT',
      FinishGoodId: null,
      Location: 'WAREHOUSE',
      QtyIn: 0,
      QtyOut: 1,
      BalanceBefore: 10,
      BalanceAfter: 9,
    };
    const db = {
      sapTransaction: {
        findUniqueOrThrow: jest
          .fn()
          .mockImplementation(({ where }: { where: { Id: string } }) =>
            Promise.resolve(where.Id === 'post' ? posting : root),
          ),
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: { SourceKey: string } }) =>
            Promise.resolve(where.SourceKey === 'sto:sto:close' ? close : null),
          ),
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: unknown }) =>
            Promise.resolve(data),
          ),
      },
      stockOpname: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          Id: 'sto',
          RecordNumber: 'AIC-10102601',
          Status: 'COMPLETED',
        }),
        update: jest.fn(),
      },
      outboxEvent: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
      inventoryLedger: {
        findMany: jest.fn().mockResolvedValue([ledger]),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { QtyIn: 10, QtyOut: 1 } }),
        create: jest.fn(),
      },
      material: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ QtyWarehouse: 9, QtyRack: 0 }),
        update: jest.fn(),
      },
      logProcess: { create: jest.fn() },
      actionAuditEvent: { create: jest.fn() },
    };
    return {
      db,
      posting,
      close,
      run: () =>
        cancelRejectedCounting(
          db as unknown as Prisma.TransactionClient,
          'post',
          'operator',
          'Trial cancelled',
        ),
    };
  }
  it('reverses the local ledger and retains a dependent SAP close and hold', async () => {
    const f = fixture();
    await f.run();
    expect(f.db.inventoryLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ReferenceDoc: 'STO_CANCEL:AIC-10102601',
        BalanceBefore: 9,
        QtyIn: 1,
        QtyOut: 0,
        BalanceAfter: 10,
      }),
    });
    expect(f.db.sapTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        Kind: 'COUNTING_CLOSE',
        Snapshot: expect.objectContaining({
          dependencyId: 'root',
          cancelled: true,
        }),
      }),
    });
    expect(
      f.db.outboxEvent.updateMany.mock.calls.every(
        ([args]) => !('ReferenceType' in args.data),
      ),
    ).toBe(true);
    expect(f.db.logProcess.create).toHaveBeenCalled();
  });
  it.each([
    'OUTBOX_DELIVERY_UNCERTAIN',
    'OUTBOX_SENDING',
    'SAP_TRANSACTION_SYNCED',
  ])('refuses ambiguous or posted result %s', async (code) => {
    const f = fixture();
    f.posting.Event.LastErrorCode = code;
    await expect(f.run()).rejects.toThrow('definitely');
    expect(f.db.inventoryLedger.create).not.toHaveBeenCalled();
  });
  it('refuses to reverse stock changed after approval', async () => {
    const f = fixture();
    f.db.material.findUniqueOrThrow.mockResolvedValue({
      QtyWarehouse: 8,
      QtyRack: 0,
    });
    await expect(f.run()).rejects.toThrow('Stock moved');
    expect(f.db.inventoryLedger.create).not.toHaveBeenCalled();
  });
  it('uses CAS against a worker claim before any ledger writes', async () => {
    const f = fixture();
    f.db.outboxEvent.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.run()).rejects.toThrow('worker state changed');
    expect(f.db.inventoryLedger.create).not.toHaveBeenCalled();
  });
});
