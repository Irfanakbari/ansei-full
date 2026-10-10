/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { SapTransaction } from '../../generated/prisma/client';
import { OutboxStateService } from '../outbox/outbox-state.service';
import { SapItemSyncService } from './sap-item-sync.service';
import { SapPostingService } from './sap-posting.service';
import {
  sapCorrelationFilter,
  sapCountingMarker,
  sapDocumentMarker,
} from './sap-document-reference';

const id = '88e33be8-b34b-4f08-a461-0947f8b87f99';
describe('Incoming SAP document references', () => {
  it('recognizes SAP-appended counting remarks only with the matching reference', () => {
    for (const Remarks of [
      'STO: AIC-10102604',
      'STO: AIC-10102604 Based On Inventory Counting 263700156',
    ]) {
      expect(sapCountingMarker({ Remarks, Reference2: 'AIC10102604' })).toBe(
        'AIC-10102604',
      );
      expect(
        sapCountingMarker({ Remarks, Reference2: 'AIC10102603' }),
      ).toBeNull();
    }
    expect(
      sapCountingMarker({
        Remarks: 'STO: AIC-10102604 copied',
        Reference2: 'AIC10102604',
      }),
    ).toBeNull();
  });
  it('includes frozen dimensions on the production order and its backflush components', async () => {
    const sap = {
      getProductTree: jest.fn().mockResolvedValue({
        Quantity: 1,
        ProductTreeLines: [
          {
            ItemCode: 'MAT',
            Quantity: 1,
            IssueMethod: 'im_Backflush',
            ItemType: 'pit_Item',
          },
        ],
      }),
    };
    const service = new SapPostingService(
      {} as PrismaService,
      sap as unknown as SapItemSyncService,
      {} as OutboxStateService,
      new ConfigService({
        SAP_COMPANY_DB: 'TEST',
        SAP_TRANSACTION_WAREHOUSE: 'DMY-ANS',
      }),
    );
    jest.spyOn(service, 'validateItem').mockResolvedValue({});
    const result = await service.prepare({
      Id: id,
      Company: 'TEST',
      Warehouse: 'DMY-ANS',
      Kind: 'PRODUCTION_ORDER',
      Quantity: 30,
      ItemCode: 'FG',
      Snapshot: {
        releaseNumber: 'PR-20261009-001',
        projectCode: '2010',
        costCenter: '2000',
        components: [{ itemCode: 'MAT', perUnit: 1 }],
      },
    } as unknown as SapTransaction);
    expect(result.body).toMatchObject({
      Remarks: 'PR-20261009-001',
      JournalRemarks: `ANSEI:${id}`,
      Project: '2010',
      DistributionRule: '2000',
      ProductionOrderLines: [
        {
          ItemNo: 'MAT',
          Project: '2010',
          DistributionRule: '2000',
          PlannedQuantity: 30,
        },
      ],
    });
  });
  it('shows the frozen incoming PO in Remarks while retaining correlation separately', async () => {
    const service = new SapPostingService(
      {} as PrismaService,
      {} as SapItemSyncService,
      {} as OutboxStateService,
      new ConfigService({
        SAP_COMPANY_DB: 'TEST',
        SAP_TRANSACTION_WAREHOUSE: 'DMY-ANS',
      }),
    );
    jest.spyOn(service, 'validateItem').mockResolvedValue({ AvgStdPrice: 0 });
    const row = {
      Id: id,
      Company: 'TEST',
      Warehouse: 'DMY-ANS',
      Kind: 'GOODS_RECEIPT',
      Quantity: 500,
      ItemCode: 'MAT',
      Snapshot: { reference: 'PO-123', date: '2026-10-09' },
    } as unknown as SapTransaction;
    const result = await service.prepare(row);
    expect(result.body).toMatchObject({
      Comments: 'PO: PO-123',
      JournalMemo: `ANSEI:${id}`,
      DocumentLines: [
        { ItemCode: 'MAT', Quantity: 500, WarehouseCode: 'DMY-ANS' },
      ],
    });
    await expect(service.prepare({ ...row, Snapshot: {} })).rejects.toThrow(
      'Incoming PO number is missing',
    );
  });
  it('reconciles both old and new receipt formats without matching another receipt with the same PO', () => {
    expect(sapCorrelationFilter('GOODS_RECEIPT', id)).toBe(
      `(Comments eq 'ANSEI:${id}' or JournalMemo eq 'ANSEI:${id}')`,
    );
    expect(sapCorrelationFilter('SALES_ORDER', id)).toBe(
      `(Comments eq 'ANSEI:${id}' or JournalMemo eq 'ANSEI:${id}')`,
    );
    expect(sapDocumentMarker({ Comments: `ANSEI:${id}` })).toBe(id);
    expect(
      sapDocumentMarker({ Comments: 'PO: PO-123', JournalMemo: `ANSEI:${id}` }),
    ).toBe(id);
    expect(
      sapDocumentMarker({
        Comments: 'PO: PO-123',
        JournalMemo: 'Goods Receipt',
      }),
    ).toBeNull();
    expect(sapCorrelationFilter('PRODUCTION_ORDER', id)).toBe(
      `(Remarks eq 'ANSEI:${id}' or JournalRemarks eq 'ANSEI:${id}')`,
    );
  });
});
