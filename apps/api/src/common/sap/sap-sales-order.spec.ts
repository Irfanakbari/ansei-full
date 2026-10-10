/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { ConfigService } from '@nestjs/config';
import { SapPostingService } from './sap-posting.service';
import { SapItemSyncService } from './sap-item-sync.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxStateService } from '../outbox/outbox-state.service';
import type { SapTransaction } from '../../generated/prisma/client';

describe('Automatic SAP Sales Order preparation', () => {
  function fixture() {
    const mapping = {
      AutoCreate: true,
      Company: 'TEST',
      ItemCode: 'FG',
      CardCode: 'CUSTOMER',
      SalesOrderEntry: null,
    };
    const db = {
      sapDemandMapping: { findUnique: jest.fn().mockResolvedValue(mapping) },
      sapTransaction: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const sap = {
      readResource: jest.fn().mockResolvedValue({
        CardType: 'cCustomer',
        Valid: 'tYES',
        Frozen: 'tNO',
        PriceListNum: 1,
      }),
    };
    const service = new SapPostingService(
      db as unknown as PrismaService,
      sap as unknown as SapItemSyncService,
      {} as OutboxStateService,
      new ConfigService({
        SAP_COMPANY_DB: 'TEST',
        SAP_TRANSACTION_WAREHOUSE: 'DMY-ANS',
        SAP_AUTO_SALES_ORDER_ENABLED: 'true',
      }),
    );
    const item = {
      SalesItem: 'tYES',
      ItemPrices: [{ PriceList: 1, Price: 1250 }],
    };
    jest.spyOn(service, 'validateItem').mockResolvedValue(item);
    const row = {
      Id: 'event',
      Kind: 'SALES_ORDER',
      DemandId: 'DEMAND',
      Company: 'TEST',
      Warehouse: 'DMY-ANS',
      ItemCode: 'FG',
      Quantity: 30,
      Snapshot: {
        poNumber: 'CUSTOMER-PO',
        date: '2026-10-09',
        dueDate: '2026-10-10',
      },
    } as unknown as SapTransaction;
    return { service, db, sap, row, item };
  }
  it('uses SAP customer pricing and freezes only source reference, item and quantity', async () => {
    const f = fixture();
    const request = await f.service.prepare(f.row);
    expect(request.resource).toBe('Orders');
    expect(request.body).toMatchObject({
      CardCode: 'CUSTOMER',
      NumAtCard: 'CUSTOMER-PO',
      Comments: 'PO: CUSTOMER-PO',
      JournalMemo: 'ANSEI:event',
      DocumentLines: [
        { ItemCode: 'FG', Quantity: 30, WarehouseCode: 'DMY-ANS' },
      ],
    });
    expect(JSON.stringify(request.body)).not.toMatch(
      /UnitPrice|TaxCode|DiscountPercent/,
    );
  });
  it('shows the release and customer PO without changing the customer reference', async () => {
    const f = fixture();
    f.row.Snapshot = {
      ...(f.row.Snapshot as object),
      releaseNumber: 'PR-20261009-001',
    };
    const request = await f.service.prepare(f.row);
    expect(request.body).toMatchObject({
      NumAtCard: 'CUSTOMER-PO',
      Comments: 'PR-20261009-001 | PO: CUSTOMER-PO',
      JournalMemo: 'ANSEI:event',
    });
  });
  it('blocks a missing customer mapping instead of guessing one', async () => {
    const f = fixture();
    f.db.sapDemandMapping.findUnique.mockResolvedValue(null);
    await expect(f.service.prepare(f.row)).rejects.toThrow(
      'Map an active SAP customer',
    );
  });
  it('uses frozen project and cost center on Sales Order lines', async () => {
    const f = fixture();
    f.row.Snapshot = {
      ...(f.row.Snapshot as object),
      projectCode: '2010',
      costCenter: '2000',
    };
    const request = await f.service.prepare(f.row);
    expect(request.body.DocumentLines).toEqual([
      expect.objectContaining({ ProjectCode: '2010', CostingCode: '2000' }),
    ]);
  });
  it('blocks a second SO when the demand already has a document', async () => {
    const f = fixture();
    f.db.sapDemandMapping.findUnique.mockResolvedValue({
      AutoCreate: true,
      Company: 'TEST',
      ItemCode: 'FG',
      CardCode: 'CUSTOMER',
      SalesOrderEntry: 12,
    });
    await expect(f.service.prepare(f.row)).rejects.toThrow('already linked');
  });
  it('blocks an unpriced customer list instead of using another list', async () => {
    const f = fixture();
    f.sap.readResource.mockResolvedValue({
      CardType: 'cCustomer',
      Valid: 'tYES',
      Frozen: 'tNO',
      PriceListNum: 2,
    });
    await expect(f.service.prepare(f.row)).rejects.toThrow(
      'no positive item price',
    );
  });
  it('production order waits for confirmed SO evidence', async () => {
    const f = fixture();
    f.row.Kind = 'PRODUCTION_ORDER';
    f.row.Snapshot = { salesOrderEventId: 'sales' };
    await expect(f.service.prepare(f.row)).rejects.toThrow(
      'Waiting for a verified SAP Sales Order',
    );
  });
});
