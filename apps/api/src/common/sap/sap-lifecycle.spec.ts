/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import type { Prisma } from '../../generated/prisma/client';
import { captureSapDemand } from './sap-transaction-capture';
describe('Durable SAP production lifecycle capture', () => {
  const original = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, {
      SAP_TRANSACTION_CAPTURE_ENABLED: 'true',
      SAP_TRANSACTION_ITEM_ALLOWLIST: 'FG',
      SAP_COMPANY_DB: 'TEST',
      SAP_AUTO_SALES_ORDER_ENABLED: 'true',
    });
  });
  afterEach(() => {
    process.env = { ...original };
  });
  function fixture() {
    const rows: Record<string, unknown>[] = [];
    const settings = {
      enabled: false,
      projectCode: '2010',
      costCenter: '2000',
    };
    const db = {
      productionOrder: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          PoId: 'DEMAND',
          Qty: 30,
          FinishGoodId: 'MES-FG',
          PoNumber: 'PO',
          DeliveryDate: new Date('2026-10-09'),
          PartData: { PartNumberSAP: 'FG', ActiveBomRevisionId: 'BOM' },
        }),
      },
      productionBomSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
      bomRevision: {
        findUnique: jest.fn().mockResolvedValue({
          Lines: [
            {
              PartNumber: 'MAT',
              Qty: 1,
              UnitName: 'PCS',
              Material: { PartNumberSAP: null },
            },
          ],
        }),
      },
      sapDemandMapping: { findUnique: jest.fn().mockResolvedValue(null) },
      sapConnectionState: {
        findUnique: jest
          .fn()
          .mockImplementation(() => ({ IntegrationSettings: { ...settings } })),
      },
      sapTransaction: {
        findFirst: jest
          .fn()
          .mockImplementation(
            ({ where }: { where: Record<string, unknown> }) =>
              [...rows]
                .reverse()
                .find((r) =>
                  Object.entries(where).every(([k, v]) => r[k] === v),
                ) ?? null,
          ),
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: { SourceKey: string } }) => {
            const row = rows.find((r) => r.SourceKey === where.SourceKey);
            return row
              ? {
                  ...row,
                  Event: {
                    Status: 'PENDING',
                    LastErrorCode: null,
                    UpdatedAt: new Date(),
                  },
                }
              : null;
          }),
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            rows.push(data);
            return data;
          }),
      },
      outboxEvent: {
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      logProcess: { create: jest.fn() },
      actionAuditEvent: { create: jest.fn() },
    };
    return {
      tx: db as unknown as Prisma.TransactionClient,
      db,
      rows,
      settings,
    };
  }
  it('records Draft while paused, then release and cancellation as distinct dependent events', async () => {
    const f = fixture();
    await captureSapDemand(f.tx, 'DEMAND', 'actor', 'draft');
    expect(f.rows.map((r) => r.Kind)).toEqual(['PRODUCTION_ORDER']);
    expect(f.rows[0].Snapshot).toMatchObject({
      autoRelease: false,
      projectCode: '2010',
      costCenter: '2000',
    });
    await captureSapDemand(f.tx, 'DEMAND', 'actor', 'draft');
    expect(f.rows).toHaveLength(1);
    await captureSapDemand(f.tx, 'DEMAND', 'actor');
    expect(f.rows.map((r) => r.Kind)).toEqual([
      'PRODUCTION_ORDER',
      'SALES_ORDER',
      'PRODUCTION_RELEASE',
    ]);
    expect(f.rows[2].Snapshot).toMatchObject({
      orderEventId: f.rows[0].Id,
      salesOrderEventId: f.rows[1].Id,
    });
    await captureSapDemand(f.tx, 'DEMAND', 'actor');
    expect(f.rows).toHaveLength(3);
    await captureSapDemand(f.tx, 'DEMAND', 'actor', 'cancel');
    expect(f.rows[3]).toMatchObject({
      Kind: 'PRODUCTION_CANCEL',
      Snapshot: expect.objectContaining({ orderEventId: f.rows[0].Id }),
    });
  });
  it('freezes dimensions and preserves the creation event when settings change', async () => {
    const f = fixture();
    await captureSapDemand(f.tx, 'DEMAND', 'actor', 'draft');
    f.settings.projectCode = 'NEW';
    f.settings.enabled = true;
    await captureSapDemand(f.tx, 'DEMAND', 'actor');
    expect(f.rows[0].Snapshot).toMatchObject({ projectCode: '2010' });
    expect(f.rows[1].Snapshot).toMatchObject({ projectCode: 'NEW' });
  });
});
