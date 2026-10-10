/* By Irfan Akbari Vuteq Indonesia - 2026-10-10 */
import { ConfigService } from '@nestjs/config';
import type { Prisma, SapTransaction } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxStateService, UNCERTAIN } from '../outbox/outbox-state.service';
import { SapPostingService } from './sap-posting.service';
import { SapItemSyncService } from './sap-item-sync.service';
import { SapConnectionService } from './sap-connection.service';
import { SapCacheService } from './sap-cache.service';
import { SapExternalMonitorService } from './sap-external-monitor.service';
import { captureSapIncomingReceipt } from './sap-transaction-capture';
import {
  incomingLines,
  matchesIncomingDocument,
  receiptItemLabel,
} from './sap-incoming-document';
import { summarizeSapDocuments } from './sap-document-summary';

const lines = [
  { ledgerId: 'l1', partNumber: 'MES-A', itemCode: 'SAP-A', quantity: 10 },
  { ledgerId: 'l2', partNumber: 'MES-B', itemCode: 'SAP-B', quantity: 10 },
];
function row(): SapTransaction {
  return {
    Id: 'event',
    Kind: 'GOODS_RECEIPT',
    Company: 'TEST',
    Warehouse: 'DMY-ANS',
    ItemCode: 'SAP-A',
    Quantity: 20,
    Snapshot: {
      lines,
      disallowedItemCodes: [],
      reference: 'PO-1',
      incomingId: 'INC-1',
      date: '2026-10-10',
      projectCode: '2010',
      costCenter: '2000',
    },
  } as unknown as SapTransaction;
}
const config = () =>
  new ConfigService({
    SAP_COMPANY_DB: 'TEST',
    SAP_TRANSACTION_WAREHOUSE: 'DMY-ANS',
  });
describe('Grouped incoming capture', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });
  it('captures one immutable event for all ledger lines, and replays the same source safely', async () => {
    process.env.SAP_TRANSACTION_CAPTURE_ENABLED = 'true';
    process.env.SAP_TRANSACTION_MATERIAL_ALLOWLIST = 'SAP-A,SAP-B';
    const db = {
      sapTransaction: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: object }) => data),
      },
      sapConnectionState: { findUnique: jest.fn().mockResolvedValue(null) },
      outboxEvent: { create: jest.fn() },
      logProcess: { create: jest.fn() },
      actionAuditEvent: { create: jest.fn() },
    };
    const incoming = {
      id: 'INC-1',
      poNumber: 'PO-1',
      date: new Date('2026-10-09T23:10:44.641Z'),
    };
    const tx = db as unknown as Prisma.TransactionClient;
    const result = await captureSapIncomingReceipt(
      tx,
      incoming,
      lines,
      'operator',
    );
    expect(db.sapTransaction.create).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      SourceKey: 'incoming:INC-1',
      LedgerId: 'l1',
      Quantity: 20,
      Snapshot: { lines, disallowedItemCodes: [], date: '2026-10-10' },
      Effects: [
        { itemCode: 'SAP-A', quantity: 10 },
        { itemCode: 'SAP-B', quantity: 10 },
      ],
    });
    db.sapTransaction.findUnique.mockResolvedValue(result);
    await captureSapIncomingReceipt(tx, incoming, lines, 'operator');
    expect(db.outboxEvent.create).toHaveBeenCalledTimes(1);
    process.env.SAP_TRANSACTION_CAPTURE_ENABLED = 'false';
    await captureSapIncomingReceipt(tx, incoming, lines, 'operator');
    expect(db.outboxEvent.create).toHaveBeenCalledTimes(1);
  });
});
describe('Grouped SAP Goods Receipt preparation and proof', () => {
  function fixture() {
    const service = new SapPostingService(
      {} as PrismaService,
      {} as SapItemSyncService,
      {} as OutboxStateService,
      config(),
    );
    const validate = jest
      .spyOn(service, 'validateItem')
      .mockResolvedValue({ AvgStdPrice: 0 });
    return { service, validate };
  }
  it('prepares a single POST with two complete lines and readable PO remarks', async () => {
    const { service, validate } = fixture();
    const request = await service.prepare(row());
    expect(request.resource).toBe('InventoryGenEntries');
    expect(receiptItemLabel(row())).toBe('SAP-A, SAP-B');
    expect(request.body).toMatchObject({
      Comments: 'PO: PO-1',
      JournalMemo: 'ANSEI:event',
      DocumentLines: [
        {
          ItemCode: 'SAP-A',
          Quantity: 10,
          UnitPrice: 0,
          ProjectCode: '2010',
          CostingCode: '2000',
        },
        {
          ItemCode: 'SAP-B',
          Quantity: 10,
          UnitPrice: 0,
          ProjectCode: '2010',
          CostingCode: '2000',
        },
      ],
    });
    expect(validate.mock.calls.map((call) => call[0])).toEqual([
      'SAP-A',
      'SAP-B',
    ]);
    expect(matchesIncomingDocument(row(), request.body)).toBe(true);
    expect(
      matchesIncomingDocument(row(), {
        ...request.body,
        DocumentLines: [(request.body.DocumentLines as object[])[0]],
      }),
    ).toBe(false);
  });
  it('blocks the whole receipt if any line fails valuation or the pilot scope', async () => {
    const { service, validate } = fixture();
    validate
      .mockResolvedValueOnce({ AvgStdPrice: 0 })
      .mockResolvedValueOnce({ AvgStdPrice: 5 });
    await expect(service.prepare(row())).rejects.toThrow('zero-cost');
    const mixed = row();
    mixed.Snapshot = {
      ...(mixed.Snapshot as Prisma.InputJsonObject),
      disallowedItemCodes: ['SAP-B'],
    };
    await expect(service.prepare(mixed)).rejects.toThrow('No partial receipt');
  });
  it('rejects invalid totals and duplicate ledger identities, preserving legacy single-line events', () => {
    expect(() => incomingLines({ ...row(), Quantity: 10 })).toThrow(
      'quantities',
    );
    expect(() =>
      incomingLines({ ...row(), Snapshot: { lines: [lines[0], lines[0]] } }),
    ).toThrow('quantities');
    expect(incomingLines({ ...row(), Snapshot: {} })).toBeNull();
  });
  it('retains separate part references when aliases map to one SAP item', async () => {
    const { service, validate } = fixture();
    const alias = row();
    alias.Snapshot = {
      ...(alias.Snapshot as Prisma.InputJsonObject),
      lines: lines.map((line) => ({ ...line, itemCode: 'SAP-A' })),
    };
    const request = await service.prepare(alias);
    expect(request.body.DocumentLines).toHaveLength(2);
    expect(validate).toHaveBeenCalledTimes(1);
    const documents = summarizeSapDocuments([
      {
        ...alias,
        DocumentEntry: 1,
        DocumentNumber: 260001,
        PostedAt: new Date(),
        Event: { Status: 'SUCCEEDED', LastErrorCode: 'SAP_TRANSACTION_SYNCED' },
      },
    ]);
    expect(documents).toHaveLength(1);
    expect(documents[0].references.map((ref) => ref.partNumber)).toEqual([
      'MES-A',
      'MES-B',
    ]);
  });
  it('reconciles a timeout only when the complete grouped SAP document matches; never reposts', async () => {
    const { service } = fixture();
    const request = await service.prepare(row());
    const event = { Status: 'FAILED', LastErrorCode: UNCERTAIN };
    const db = {
      sapTransaction: {
        findUnique: jest.fn().mockResolvedValue({
          ...row(),
          Event: event,
          SubmittedRequest: request,
        }),
      },
    };
    const sap = {
      readResource: jest.fn().mockResolvedValue({
        value: [{ ...request.body, DocEntry: 1, DocNum: 260001 }],
      }),
      postTransaction: jest.fn(),
    };
    const posting = { confirm: jest.fn() };
    const recovery = new SapConnectionService(
      db as unknown as PrismaService,
      sap as unknown as SapItemSyncService,
      {} as SapCacheService,
      posting as unknown as SapPostingService,
      {} as OutboxStateService,
      config(),
      {} as SapExternalMonitorService,
    );
    await recovery.reconcile('event', 'operator');
    expect(posting.confirm).toHaveBeenCalledWith(event, 1, 260001, 'operator');
    posting.confirm.mockClear();
    sap.readResource.mockResolvedValue({
      value: [
        {
          ...request.body,
          DocEntry: 1,
          DocNum: 260001,
          DocumentLines: [(request.body.DocumentLines as object[])[0]],
        },
      ],
    });
    await expect(recovery.reconcile('event', 'operator')).rejects.toThrow(
      'differs',
    );
    expect(posting.confirm).not.toHaveBeenCalled();
    expect(sap.postTransaction).not.toHaveBeenCalled();
  });
});
