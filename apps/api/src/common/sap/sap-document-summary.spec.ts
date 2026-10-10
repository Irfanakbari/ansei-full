/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import type { PrismaService } from '../../prisma/prisma.service';
import { UNCERTAIN } from '../outbox/outbox-state.service';
import {
  decorateSapForecastDocuments,
  decorateSapIncomingDocuments,
  decorateSapReleaseDocuments,
  summarizeSapDocuments,
} from './sap-document-summary';

type Posting = Parameters<typeof summarizeSapDocuments>[0][number];
const posting = (values: Partial<Posting> = {}): Posting => ({
  Id: 'event-1',
  Kind: 'PRODUCTION_ORDER',
  Company: 'TEST',
  LedgerId: null,
  DemandId: 'PO-1',
  ItemCode: 'FG-1',
  Snapshot: { releaseNumber: 'PR-1' },
  DocumentEntry: 12,
  DocumentNumber: 260001,
  PostedAt: new Date('2026-10-09'),
  Event: { Status: 'SUCCEEDED', LastErrorCode: 'SAP_TRANSACTION_SYNCED' },
  ...values,
});
function fixture() {
  const db = {
    sapTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    inventoryLedger: { findMany: jest.fn().mockResolvedValue([]) },
    sapDemandMapping: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { db, prisma: db as unknown as PrismaService };
}
describe('Local SAP document summaries', () => {
  it('requires confirmed evidence, not a successful job or an uncertain stored number', () => {
    const rows = [
      posting({
        Id: 'unconfirmed',
        Event: { Status: 'SUCCEEDED', LastErrorCode: null },
      }),
      posting({ Id: 'no-time', PostedAt: null }),
      posting({ Id: 'no-entry', DocumentEntry: null }),
      posting({
        Id: 'timeout',
        Event: { Status: 'FAILED', LastErrorCode: UNCERTAIN },
      }),
    ];
    expect(
      summarizeSapDocuments(rows).every((row) => row.documentNumber === null),
    ).toBe(true);
    expect(
      summarizeSapDocuments(rows).find((row) => row.key === 'timeout')
        ?.statuses,
    ).toEqual(['RECONCILE']);
    expect(summarizeSapDocuments([posting()])[0].documentNumber).toBe(260001);
  });
  it('retains the verified number through pending and failed lifecycle jobs, without repeating it', () => {
    const root = posting();
    const children = [
      posting({
        Id: 'released',
        Kind: 'PRODUCTION_RELEASE',
        Snapshot: { orderEventId: root.Id },
      }),
      posting({
        Id: 'close',
        Kind: 'PRODUCTION_CLOSE',
        Snapshot: { orderEventId: root.Id },
        DocumentNumber: null,
        Event: { Status: 'QUEUED', LastErrorCode: null },
      }),
      posting({
        Id: 'cancel',
        Kind: 'PRODUCTION_CANCEL',
        Snapshot: { orderEventId: root.Id },
        Event: { Status: 'FAILED', LastErrorCode: 'SAP_BLOCKED' },
      }),
    ];
    expect(summarizeSapDocuments([root], children)).toEqual([
      expect.objectContaining({
        documentNumber: 260001,
        statuses: ['SYNCED', 'PENDING', 'BLOCKED'],
      }),
    ]);
  });
  it('deduplicates by document entry and company while retaining all part references', () => {
    const result = summarizeSapDocuments([
      posting(),
      posting({ Id: 'second', ItemCode: 'FG-2', DemandId: 'PO-2' }),
      posting({ Id: 'other-company', Company: 'OTHER' }),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].references).toHaveLength(2);
  });
  it('aggregates receipt materials and partial success for each incoming in batch', async () => {
    const { db, prisma } = fixture();
    db.inventoryLedger.findMany.mockResolvedValue([
      { Id: 'l1', ReferenceDoc: 'IN-1' },
      { Id: 'l2', ReferenceDoc: 'IN-1' },
      { Id: 'l3', ReferenceDoc: 'IN-2' },
    ]);
    db.sapTransaction.findMany.mockResolvedValue([
      posting({
        Kind: 'GOODS_RECEIPT',
        LedgerId: 'l1',
        ItemCode: 'MAT-1',
        DemandId: null,
      }),
      posting({
        Id: 'pending',
        Kind: 'GOODS_RECEIPT',
        LedgerId: 'l2',
        ItemCode: 'MAT-2',
        DemandId: null,
        DocumentNumber: null,
        Event: { Status: 'PENDING', LastErrorCode: null },
      }),
      posting({
        Id: 'receipt-2',
        Kind: 'GOODS_RECEIPT',
        LedgerId: 'l3',
        DocumentNumber: 260002,
        DocumentEntry: 13,
      }),
    ]);
    const result = await decorateSapIncomingDocuments(prisma, [
      { PoId: 'IN-1' },
      { PoId: 'IN-2' },
    ]);
    expect(result[0].SAPDocuments.map((row) => row.documentNumber)).toEqual([
      260001,
      null,
    ]);
    expect(result[1].SAPDocuments.map((row) => row.documentNumber)).toEqual([
      260002,
    ]);
    expect(db.inventoryLedger.findMany).toHaveBeenCalledTimes(1);
    expect(db.sapTransaction.findMany).toHaveBeenCalledTimes(1);
    expect(db.inventoryLedger.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ReferenceDoc: { in: ['IN-1', 'IN-2'] },
          TransactionType: 'INCOMING_SUPPLIER',
        },
      }),
    );
  });
  it('associates production documents by frozen release, even after a forecast is moved', async () => {
    const { db, prisma } = fixture();
    db.sapTransaction.findMany
      .mockResolvedValueOnce([
        posting({ Snapshot: { releaseNumber: 'OLD' } }),
        posting({
          Id: 'new',
          Snapshot: { releaseNumber: 'NEW' },
          DocumentNumber: 260002,
          DocumentEntry: 13,
        }),
        posting({ Id: 'unknown', Snapshot: {}, DemandId: 'PO-2' }),
      ])
      .mockResolvedValueOnce([]);
    const result = await decorateSapReleaseDocuments(prisma, [
      { ReleaseNumber: 'OLD', Forecasts: [] },
      { ReleaseNumber: 'NEW', Forecasts: [{ PoId: 'PO-1' }, { PoId: 'PO-2' }] },
    ]);
    expect(result[0].SAPDocuments.map((row) => row.documentNumber)).toEqual([
      260001,
    ]);
    expect(result[1].SAPDocuments.map((row) => row.documentNumber)).toEqual([
      260002,
      null,
    ]);
    expect(result[1].SAPDocuments[1].statuses).toEqual(['UNVERIFIED']);
    expect(db.sapTransaction.findMany).toHaveBeenCalledTimes(2);
  });
  it('shows SO evidence per demand and never substitutes a manual DocEntry for DocNum', async () => {
    const { db, prisma } = fixture();
    db.sapTransaction.findMany.mockResolvedValue([
      posting({ Kind: 'SALES_ORDER' }),
      posting({
        Id: 'pending',
        Kind: 'SALES_ORDER',
        DemandId: 'PO-2',
        PostedAt: null,
        Event: { Status: 'PROCESSING', LastErrorCode: null },
      }),
      posting({
        Id: 'failed',
        Kind: 'SALES_ORDER',
        DemandId: 'PO-3',
        PostedAt: null,
        Event: { Status: 'FAILED', LastErrorCode: null },
      }),
    ]);
    db.sapDemandMapping.findMany.mockResolvedValue([
      {
        DemandId: 'PO-1',
        Company: 'TEST',
        SalesOrderEntry: 12,
        ItemCode: 'FG-1',
      },
      {
        DemandId: 'PO-4',
        Company: 'TEST',
        SalesOrderEntry: 99,
        ItemCode: 'FG-4',
      },
    ]);
    const result = await decorateSapForecastDocuments(
      prisma,
      ['PO-1', 'PO-2', 'PO-3', 'PO-4', 'PO-5'].map((PoId) => ({ PoId })),
    );
    expect(
      result.map((row) =>
        row.SAPDocuments.map((document) => document.documentNumber),
      ),
    ).toEqual([[260001], [null], [null], [null], []]);
    expect(result[3].SAPDocuments[0].statuses).toEqual(['UNVERIFIED']);
    expect(result[2].SAPDocuments[0].statuses).toEqual(['FAILED']);
    expect(db.sapTransaction.findMany).toHaveBeenCalledTimes(1);
    expect(db.sapDemandMapping.findMany).toHaveBeenCalledTimes(1);
  });
  it('skips database queries for empty pages', async () => {
    const { db, prisma } = fixture();
    expect(await decorateSapIncomingDocuments(prisma, [])).toEqual([]);
    expect(await decorateSapReleaseDocuments(prisma, [])).toEqual([]);
    expect(await decorateSapForecastDocuments(prisma, [])).toEqual([]);
    expect(db.sapTransaction.findMany).not.toHaveBeenCalled();
  });
});
