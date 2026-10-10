/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { ConfigService } from '@nestjs/config';
import { SapBomService } from './sap-bom.service';
import { SapItemSyncService } from './sap-item-sync.service';

describe('SapBomService', () => {
  let service: SapBomService;
  let getProductTree: jest.Mock;
  let now: number;
  const body = {
    TreeCode: 'SAP',
    Quantity: 2,
    ProductTreeLines: [
      {
        ItemCode: 'M',
        Quantity: 3,
        Warehouse: 'W',
        ItemType: 'pit_Item',
        Price: 999,
      },
    ],
  };
  beforeEach(() => {
    now = 1000000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    getProductTree = jest.fn().mockResolvedValue(body);
    service = new SapBomService(
      {
        getProductTree,
        getWarehouseNames: jest
          .fn()
          .mockResolvedValue(new Map([['W', 'Main Warehouse']])),
      } as unknown as SapItemSyncService,
      new ConfigService({ SAP_SYNC_ENABLED: 'true' }),
    );
  });
  afterEach(() => jest.restoreAllMocks());

  it('shares concurrent lookups and the cached result for a SAP code', async () => {
    const results = await Promise.all([service.get('SAP'), service.get('SAP')]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0].status).toBe('FOUND');
    expect(results[0].bom?.ProductTreeLines[0].WarehouseName).toBe(
      'Main Warehouse',
    );
    expect(results[0].bom?.ProductTreeLines[0]).not.toHaveProperty('Price');
    await service.get('SAP');
    expect(getProductTree).toHaveBeenCalledTimes(1);
  });
  it('caches missing BOMs without treating failures as not found', async () => {
    getProductTree.mockResolvedValueOnce(null);
    expect((await service.get('MISSING')).status).toBe('NOT_FOUND');
    await service.get('MISSING');
    expect(getProductTree).toHaveBeenCalledTimes(1);
    getProductTree.mockRejectedValueOnce(new Error('upstream secret'));
    expect((await service.get('FAIL')).status).toBe('UNKNOWN');
    await service.get('OTHER');
    expect(getProductTree).toHaveBeenCalledTimes(2);
    now += 60001;
    expect((await service.get('SAP')).status).toBe('FOUND');
  });
  it('returns stale data during refresh then expires it after 30 minutes', async () => {
    await service.get('SAP');
    now += 300001;
    getProductTree.mockRejectedValue(new Error('offline'));
    expect((await service.get('SAP')).stale).toBe(true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    now += 1800000;
    const result = await service.get('SAP');
    expect(result.status).toBe('UNKNOWN');
    expect(result.bom).toBeNull();
  });
  it('limits concurrent requests to four', async () => {
    const pending: ((value: null) => void)[] = [];
    getProductTree.mockImplementation(
      () => new Promise((resolve) => pending.push(resolve)),
    );
    const tasks = ['A', 'B', 'C', 'D'].map((code) => service.get(code));
    expect((await service.get('E')).status).toBe('UNKNOWN');
    expect(getProductTree).toHaveBeenCalledTimes(4);
    pending.forEach((resolve) => resolve(null));
    await Promise.all(tasks);
  });
  it('rejects malformed or mismatched BOM data', async () => {
    getProductTree.mockResolvedValue({ ...body, Quantity: 0 });
    expect((await service.get('SAP')).status).toBe('UNKNOWN');
    now += 60001;
    getProductTree.mockResolvedValue(body);
    expect((await service.get('WRONG')).status).toBe('UNKNOWN');
  });
  it('does not contact SAP when disabled or unmapped', async () => {
    expect((await service.get('')).status).toBe('UNMAPPED');
    const disabled = new SapBomService(
      {
        getProductTree,
        getWarehouseNames: jest
          .fn()
          .mockResolvedValue(new Map([['W', 'Main Warehouse']])),
      } as unknown as SapItemSyncService,
      new ConfigService(),
    );
    expect((await disabled.get('SAP')).status).toBe('DISABLED');
    expect(getProductTree).not.toHaveBeenCalled();
  });
  it('bounds the cache to 500 codes', async () => {
    getProductTree.mockResolvedValue(null);
    for (let i = 0; i < 501; i++) await service.get(String(i));
    await service.get('0');
    expect(getProductTree).toHaveBeenCalledTimes(502);
  });
});
