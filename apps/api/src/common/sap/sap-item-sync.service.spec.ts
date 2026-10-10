/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { ConfigService } from '@nestjs/config';
import { SapItemSyncService } from './sap-item-sync.service';
import { request as httpsRequest } from 'node:https';
import { EventEmitter } from 'node:events';

jest.mock('node:https', () => ({ request: jest.fn() }));

describe('SapItemSyncService', () => {
  let service: SapItemSyncService;
  let fetchMock: jest.Mock;
  const originalFetch = global.fetch;
  const config = {
    SAP_SYNC_ENABLED: 'true',
    SAP_SERVICE_LAYER_URL: 'https://sap.test/b1s/v2/',
    SAP_COMPANY_DB: 'test',
    SAP_USERNAME: 'test',
    SAP_PASSWORD: 'test',
  };
  const item = { PartNumber: 'LOCAL', PartNumberSAP: 'SAP' };
  const response = (body: unknown, status = 200, cookies: string[] = []) => ({
    ok: status === 200,
    status,
    json: () => Promise.resolve(body),
    headers: { getSetCookie: () => cookies },
  });
  const login = () =>
    response({ SessionTimeout: 30 }, 200, [
      'B1SESSION=test; HttpOnly',
      'ROUTEID=.node1; Path=/',
    ]);
  const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

  it('marks both Genba variants synced when they share one SAP FG item', async () => {
    fetchMock
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(
        response({ value: [{ ItemCode: '5715B132-KD1' }] }),
      );
    const variants = ['5715B132-KD', '5715B132-KD1'].map((PartNumber) => ({
      PartNumber,
      PartNumberSAP: '5715B132-KD1',
    }));
    service.decorate(variants, 'finishGood');
    await settle();
    const result = service.decorate(variants, 'finishGood');
    expect(result.map((row) => row.SAPSyncStatus)).toEqual([
      'SYNCED',
      'SYNCED',
    ]);
    expect(result.map((row) => row.PartNumber)).toEqual([
      '5715B132-KD',
      '5715B132-KD1',
    ]);
  });

  it('reads BOM with shared session and escapes SAP keys', async () => {
    fetchMock
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(response({ TreeCode: "A'B/#" }));
    await service.getProductTree("A'B/#");
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      "ProductTrees('A''B%2F%23')",
    );
    fetchMock.mockResolvedValueOnce(
      response({ error: { code: '-2028' } }, 404),
    );
    expect(await service.getProductTree('MISSING')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not hide an unrelated upstream 404 as a missing BOM', async () => {
    fetchMock
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(response({ error: { code: 'other' } }, 404));
    await expect(service.getProductTree('SAP')).rejects.toThrow(
      'SAP item query failed',
    );
  });

  it('loads all warehouse pages once and shares concurrent lookups', async () => {
    fetchMock
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(
        response({
          value: [{ WarehouseCode: '900', WarehouseName: 'Main' }],
          '@odata.nextLink': 'Warehouses?$skip=1',
        }),
      )
      .mockResolvedValueOnce(
        response({ value: [{ WarehouseCode: '901', WarehouseName: 'Other' }] }),
      );
    const [a, b] = await Promise.all([
      service.getWarehouseNames(),
      service.getWarehouseNames(),
    ]);
    expect(a.get('900')).toBe('Main');
    expect(b.get('901')).toBe('Other');
    await service.getWarehouseNames();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('preserves the previous warehouse snapshot on failed refresh and applies cooldown', async () => {
    let now = 1000000;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      fetchMock.mockResolvedValueOnce(login()).mockResolvedValueOnce(
        response({
          value: [{ WarehouseCode: '900', WarehouseName: 'Main' }],
        }),
      );
      await service.getWarehouseNames();
      now += 31 * 60000;
      fetchMock.mockRejectedValue(new Error('offline'));
      expect((await service.getWarehouseNames()).get('900')).toBe('Main');
      await settle();
      const calls = fetchMock.mock.calls.length;
      await service.getWarehouseNames();
      expect(fetchMock).toHaveBeenCalledTimes(calls);
      now += 24 * 60 * 60000;
      expect((await service.getWarehouseNames()).size).toBe(0);
    } finally {
      clock.mockRestore();
    }
  });

  it('rejects foreign warehouse pagination and retries no sooner than cooldown', async () => {
    fetchMock.mockResolvedValueOnce(login()).mockResolvedValueOnce(
      response({
        value: [],
        '@odata.nextLink': 'https://other.test/Warehouses',
      }),
    );
    expect((await service.getWarehouseNames()).size).toBe(0);
    await service.getWarehouseNames();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('patches names and item-level stock limits, retaining zero values, then reuses login', async () => {
    service = new SapItemSyncService(
      new ConfigService({ ...config, SAP_MATERIAL_WRITE_ENABLED: 'true' }),
    );
    fetchMock
      .mockResolvedValueOnce(login())
      .mockResolvedValue({ ok: true, status: 204 });
    const values = { partName: 'New name', minimumStock: 0, maximumStock: 0 };
    await service.updateMaterial("A'B", values);
    await service.updateMaterial("A'B", values);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [url, options] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("Items('A''B')");
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({
      ItemName: 'New name',
      ForeignName: 'New name',
      ManageStockByWarehouse: 'tNO',
      MinInventory: 0,
      MaxInventory: 0,
    });
  });

  it('re-authenticates once for a rejected material PATCH without leaking upstream errors', async () => {
    service = new SapItemSyncService(
      new ConfigService({ ...config, SAP_MATERIAL_WRITE_ENABLED: 'true' }),
    );
    fetchMock
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(response({}, 401))
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(response({ secret: 'private' }, 500));
    await expect(
      service.updateMaterial('SAP', {
        partName: 'Name',
        minimumStock: 1,
        maximumStock: 2,
      }),
    ).rejects.toThrow('SAP material update failed');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('keeps SAP writes disabled unless explicitly enabled', async () => {
    await expect(
      service.updateMaterial('SAP', {
        partName: 'Name',
        minimumStock: 0,
        maximumStock: 0,
      }),
    ).rejects.toThrow('disabled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    (httpsRequest as jest.Mock).mockReset();
    service = new SapItemSyncService(new ConfigService(config));
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('disables certificate verification only for SAP when explicitly configured', async () => {
    service = new SapItemSyncService(
      new ConfigService({ ...config, SAP_TLS_REJECT_UNAUTHORIZED: 'false' }),
    );
    const previousGlobalSetting = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    const mock = httpsRequest as jest.Mock;
    for (const body of [
      { SessionTimeout: 30 },
      { value: [{ ItemCode: 'SAP' }] },
    ]) {
      mock.mockImplementationOnce(
        (
          _url: URL,
          _options: unknown,
          callback: (res: EventEmitter) => void,
        ) => {
          const res = Object.assign(new EventEmitter(), {
            statusCode: 200,
            headers: {
              'set-cookie': [
                'B1SESSION=test; HttpOnly',
                'ROUTEID=.node1; Path=/',
              ],
            },
          });
          return Object.assign(new EventEmitter(), {
            end: () => {
              callback(res);
              res.emit('data', Buffer.from(JSON.stringify(body)));
              res.emit('end');
            },
          });
        },
      );
    }
    service.decorate([item]);
    await settle();
    expect(service.decorate([item])[0].SAPSyncStatus).toBe('SYNCED');
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock.mock.calls[0][1].rejectUnauthorized).toBe(false);
    expect(mock.mock.calls[1][1].headers.Cookie).toBe(
      'B1SESSION=test; ROUTEID=.node1',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe(
      previousGlobalSetting,
    );
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('does not call SAP when disabled', () => {
    service = new SapItemSyncService(new ConfigService({}));
    expect(service.decorate([item])[0].SAPSyncStatus).toBe('UNKNOWN');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('isolates group snapshots and shares login across simultaneous material and FG refreshes', async () => {
    fetchMock.mockImplementation((url: URL) => {
      if (url.pathname.endsWith('/Login')) return Promise.resolve(login());
      const fg = url.searchParams.get('$filter') === 'ItemsGroupCode eq 120';
      return Promise.resolve(
        response({ value: [{ ItemCode: fg ? 'FG' : 'MAT' }] }),
      );
    });
    const items = [
      { PartNumber: 'FG', PartNumberSAP: null },
      { PartNumber: 'MAT', PartNumberSAP: null },
    ];
    service.decorate(items);
    service.decorate(items, 'finishGood');
    service.decorate(items, 'finishGood');
    await settle();
    expect(service.decorate(items).map((r) => r.SAPSyncStatus)).toEqual([
      'NOT_FOUND',
      'SYNCED',
    ]);
    expect(
      service.decorate(items, 'finishGood').map((r) => r.SAPSyncStatus),
    ).toEqual(['SYNCED', 'NOT_FOUND']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.filter((call: [URL]) =>
        call[0].pathname.endsWith('/Login'),
      ),
    ).toHaveLength(1);
  });

  it('keeps FG failures and backoff separate from material cache', async () => {
    fetchMock.mockImplementation((url: URL) => {
      if (url.pathname.endsWith('/Login')) return Promise.resolve(login());
      if (url.searchParams.get('$filter') === 'ItemsGroupCode eq 120')
        return Promise.resolve(response({}, 500));
      return Promise.resolve(response({ value: [{ ItemCode: 'SAP' }] }));
    });
    service.decorate([item], 'finishGood');
    service.decorate([item]);
    await settle();
    expect(service.decorate([item], 'finishGood')[0].SAPSyncStatus).toBe(
      'UNKNOWN',
    );
    expect(service.decorate([item])[0].SAPSyncStatus).toBe('SYNCED');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('coalesces cold reads, follows pages, matches SAP first with null fallback, and caches', async () => {
    fetchMock
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(
        response({
          value: [{ ItemCode: 'SAP' }],
          '@odata.nextLink': '/b1s/v2/Items?$skip=1',
        }),
      )
      .mockResolvedValueOnce(response({ value: [{ ItemCode: 'FALLBACK' }] }));
    expect(service.decorate([item])[0].SAPSyncStatus).toBe('UNKNOWN');
    service.decorate([item]);
    await settle();
    const results = service.decorate([
      item,
      { PartNumber: 'FALLBACK', PartNumberSAP: null },
      { PartNumber: 'FALLBACK', PartNumberSAP: 'MISSING' },
      { PartNumber: 'MISSING' },
    ]);
    expect(results.map((r) => r.SAPSyncStatus)).toEqual([
      'SYNCED',
      'SYNCED',
      'NOT_FOUND',
      'NOT_FOUND',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      'ItemsGroupCode+eq+128',
    );
    expect(fetchMock.mock.calls[1][1].headers.Cookie).toBe(
      'B1SESSION=test; ROUTEID=.node1',
    );
  });

  it('reuses session on cache refresh and marks stale data', async () => {
    const now = Date.now();
    const time = jest.spyOn(Date, 'now').mockReturnValue(now);
    fetchMock
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(response({ value: [{ ItemCode: 'SAP' }] }));
    service.decorate([item]);
    await settle();
    time.mockReturnValue(now + 6 * 60_000);
    fetchMock.mockResolvedValueOnce(response({ value: [] }));
    expect(service.decorate([item])[0]).toMatchObject({
      SAPSyncStatus: 'SYNCED',
      SAPSyncStale: true,
    });
    await settle();
    expect(service.decorate([item])[0].SAPSyncStatus).toBe('NOT_FOUND');
    expect(
      fetchMock.mock.calls.filter((call: [URL]) =>
        call[0].pathname.endsWith('/Login'),
      ),
    ).toHaveLength(1);
  });

  it('renews expired sessions once after 401', async () => {
    fetchMock
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(response({}, 401))
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(response({ value: [{ ItemCode: 'SAP' }] }));
    service.decorate([item]);
    await settle();
    expect(service.decorate([item])[0].SAPSyncStatus).toBe('SYNCED');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not retry indefinitely on repeated 401', async () => {
    fetchMock
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(response({}, 401))
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(response({}, 401));
    service.decorate([item]);
    await settle();
    expect(service.decorate([item])[0].SAPSyncStatus).toBe('UNKNOWN');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each(['https://evil.test/b1s/v2/Items', '/b1s/v2/BusinessPartners'])(
    'rejects unsafe nextLink %s without publishing partial results',
    async (next) => {
      fetchMock
        .mockResolvedValueOnce(login())
        .mockResolvedValueOnce(
          response({ value: [{ ItemCode: 'SAP' }], '@odata.nextLink': next }),
        );
      service.decorate([item]);
      await settle();
      expect(service.decorate([item])[0].SAPSyncStatus).toBe('UNKNOWN');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it('keeps last complete snapshot on failure, expires it, and backs off', async () => {
    const now = Date.now();
    const time = jest.spyOn(Date, 'now').mockReturnValue(now);
    fetchMock
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(response({ value: [{ ItemCode: 'SAP' }] }));
    service.decorate([item]);
    await settle();
    time.mockReturnValue(now + 6 * 60_000);
    fetchMock
      .mockResolvedValueOnce(
        response({
          value: [{ ItemCode: 'OTHER' }],
          '@odata.nextLink': 'Items?$skip=1',
        }),
      )
      .mockRejectedValueOnce(new Error('offline'));
    service.decorate([item]);
    await settle();
    expect(service.decorate([item])[0].SAPSyncStatus).toBe('SYNCED');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    time.mockReturnValue(now + 31 * 60_000);
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(service.decorate([item])[0].SAPSyncStatus).toBe('UNKNOWN');
    await settle();
  });
});
