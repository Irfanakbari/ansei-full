/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { ConfigService } from '@nestjs/config';
import type { SapTransaction } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxStateService } from '../outbox/outbox-state.service';
import { SapItemSyncService, SapPostingError } from './sap-item-sync.service';
import { SapPostingService } from './sap-posting.service';

describe('Production Order release after creation', () => {
  function fixture(status = 'boposPlanned') {
    const row = {
      Id: 'trial',
      ItemCode: 'FG',
      Quantity: 30,
      Warehouse: 'DMY-ANS',
    } as SapTransaction;
    const doc = {
      Remarks: 'ANSEI:trial',
      ItemNo: 'FG',
      PlannedQuantity: 30,
      Warehouse: 'DMY-ANS',
      ProductionOrderStatus: status,
    };
    const sap = {
      readResource: jest
        .fn()
        .mockResolvedValueOnce(doc)
        .mockResolvedValue({ ...doc, ProductionOrderStatus: 'boposReleased' }),
      postTransaction: jest.fn().mockResolvedValue({}),
    };
    const service = new SapPostingService(
      {} as PrismaService,
      sap as unknown as SapItemSyncService,
      {} as OutboxStateService,
      new ConfigService(),
    );
    return { row, sap, service };
  }
  it('releases the existing document with PATCH and verifies its status', async () => {
    const f = fixture();
    await f.service.releaseProductionOrder(f.row, 12);
    expect(f.sap.postTransaction).toHaveBeenCalledWith(
      'ProductionOrders(12)',
      { ProductionOrderStatus: 'boposReleased' },
      expect.any(Function),
      'PATCH',
    );
    expect(f.sap.readResource).toHaveBeenCalledTimes(2);
  });
  it('does not repost or repatch a release already accepted by SAP', async () => {
    const f = fixture('boposReleased');
    await f.service.releaseProductionOrder(f.row, 12);
    expect(f.sap.postTransaction).not.toHaveBeenCalled();
  });
  it('requires reconciliation even when the second step is rejected, because creation already succeeded', async () => {
    const f = fixture();
    f.sap.postTransaction.mockRejectedValue(new SapPostingError(false, 400));
    await expect(
      f.service.releaseProductionOrder(f.row, 12),
    ).rejects.toMatchObject({ uncertain: true });
  });
  it('never releases a different document', async () => {
    const f = fixture();
    f.row.ItemCode = 'OTHER';
    await expect(
      f.service.releaseProductionOrder(f.row, 12),
    ).rejects.toMatchObject({ uncertain: true });
    expect(f.sap.postTransaction).not.toHaveBeenCalled();
  });
});
