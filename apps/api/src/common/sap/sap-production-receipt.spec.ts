/* By Irfan Akbari Vuteq Indonesia - 2026-10-10 */
import { ConfigService } from '@nestjs/config';
import type { SapTransaction } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxStateService } from '../outbox/outbox-state.service';
import { SapPostingService } from './sap-posting.service';
import { SapItemSyncService } from './sap-item-sync.service';

describe('SAP receipt from production', () => {
  function fixture() {
    const live = {
      ItemNo: '5715B132-KD',
      Warehouse: 'DMY-ANS',
      ProductionOrderStatus: 'boposReleased',
      ProductionOrderLines: [
        {
          ItemNo: 'COMP',
          BaseQuantity: 1,
          Warehouse: 'DMY-ANS',
          ProductionOrderIssueType: 'im_Backflush',
        },
      ],
    };
    const sap = { readResource: jest.fn().mockResolvedValue(live) };
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
    jest
      .spyOn(service, 'order')
      .mockResolvedValue({ DocumentEntry: 123 } as SapTransaction);
    const row = {
      Id: 'receipt',
      Kind: 'PRODUCTION_RECEIPT',
      Company: 'TEST',
      Warehouse: 'DMY-ANS',
      ItemCode: '5715B132-KD',
      Quantity: 15,
      Snapshot: {
        date: '2026-10-10',
        components: [{ itemCode: 'COMP', perUnit: 1 }],
        projectCode: '2010',
        costCenter: '2000',
      },
    } as unknown as SapTransaction;
    return { service, row, live };
  }
  it('references the production order without setting ItemCode or a service sales price', async () => {
    const { service, row } = fixture();
    const request = await service.prepare(row);
    expect(request.resource).toBe('InventoryGenEntries');
    expect(request.body.DocumentLines).toEqual([
      {
        BaseType: 202,
        BaseEntry: 123,
        Quantity: 15,
        WarehouseCode: 'DMY-ANS',
        UseBaseUnits: 'tYES',
        ProjectCode: '2010',
        CostingCode: '2000',
      },
    ]);
  });
  it('still blocks changed backflush components', async () => {
    const { service, row, live } = fixture();
    live.ProductionOrderLines[0].BaseQuantity = 2;
    await expect(service.prepare(row)).rejects.toThrow('captured BOM');
  });
  it('still waits for a released order', async () => {
    const { service, row, live } = fixture();
    live.ProductionOrderStatus = 'boposPlanned';
    await expect(service.prepare(row)).rejects.toThrow('released');
  });
});
