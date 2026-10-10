/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { ConfigService } from '@nestjs/config';
import { RedisConnection } from 'bullmq';
import { SapCacheService } from './sap-cache.service';
import { SapItemSyncService } from './sap-item-sync.service';
import { SapBomService } from './sap-bom.service';

jest.mock('bullmq', () => ({ RedisConnection: jest.fn() }));

describe('SapCacheService', () => {
  let now: number;
  let store: Map<string, { value: string; until: number }>;
  let client: {
    get: jest.Mock;
    runCommand: jest.Mock;
    defineCommand: jest.Mock;
  };
  const config = () => new ConfigService({ SAP_COMPANY_DB: 'test' });
  const read = (key: string) => {
    const row = store.get(key);
    return row && row.until > now ? row.value : null;
  };
  const write = (key: string, value: string, ttl: number) => {
    store.set(key, { value, until: now + ttl });
  };
  beforeEach(() => {
    now = 1000000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    store = new Map();
    client = {
      get: jest.fn((key: string) => Promise.resolve(read(key))),
      defineCommand: jest.fn(),
      runCommand: jest.fn(async (name: string, args: (string | number)[]) => {
        await Promise.resolve(); // Simulate an asynchronous Redis round trip.
        const [a, b, token] = args as string[];
        if (name === 'sapCacheAcquire') {
          if (read(a) || read(b)) return 0;
          write(a, token, Number(args[3]));
          return 1;
        }
        if (name === 'sapCachePublish') {
          if (read(a) !== token) return 0;
          write(b, String(args[3]), Number(args[4]));
          return 1;
        }
        if (name === 'sapCacheRelease') {
          if (read(a) !== token) return 0;
          if (args[3] === 'failed') write(b, '1', 60000);
          store.delete(a);
          return 1;
        }
        if (name === 'sapCacheInvalidate') {
          const raw = read(a);
          if (!raw || (JSON.parse(raw) as { value: unknown }).value !== b)
            return 0;
          store.delete(a);
          return 1;
        }
        throw new Error('Unexpected script');
      }),
    };
    jest.mocked(RedisConnection).mockImplementation(
      () =>
        ({
          client: Promise.resolve(client),
          on: jest.fn(),
          close: jest.fn(),
        }) as unknown as RedisConnection,
    );
  });
  afterEach(() => jest.restoreAllMocks());

  it('reuses a complete snapshot across new instances without rejuvenating its timestamp', async () => {
    const loader = jest.fn().mockResolvedValue(['A', 'B']);
    const first = await new SapCacheService(config()).load(
      'items:128',
      1000,
      5000,
      loader,
    );
    now += 500;
    const second = await new SapCacheService(config()).load(
      'items:128',
      1000,
      5000,
      loader,
    );
    expect(second).toEqual(first);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('elects only one loader across concurrent instances', async () => {
    const loader = jest.fn().mockResolvedValue(['A']);
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        new SapCacheService(config()).load('items', 1000, 5000, loader),
      ),
    );
    expect(loader).toHaveBeenCalledTimes(1);
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  it('retains stale success on failure and shares the cooldown across instances and BOM keys', async () => {
    const first = new SapCacheService(config());
    await first.load('bom:A', 1000, 5000, () => Promise.resolve('good'), 'bom');
    now += 1100;
    const loader = jest.fn().mockRejectedValue(new Error('upstream secret'));
    expect((await first.load('bom:A', 1000, 5000, loader, 'bom')).value).toBe(
      'good',
    );
    expect(
      (
        await new SapCacheService(config()).load(
          'bom:A',
          1000,
          5000,
          loader,
          'bom',
        )
      ).value,
    ).toBe('good');
    await expect(
      first.load('bom:B', 1000, 5000, loader, 'bom'),
    ).rejects.toThrow('deferred');
    expect(loader).toHaveBeenCalledTimes(1);
    now += 5000;
    await expect(
      first.load('bom:A', 1000, 5000, loader, 'bom'),
    ).rejects.toThrow();
  });

  it('caches genuine missing values, isolates company/group and does not cache errors as missing', async () => {
    const loader = jest.fn().mockResolvedValue(null);
    const first = new SapCacheService(config());
    await first.load('items:128', 1000, 5000, loader);
    await first.load('items:128', 1000, 5000, loader);
    await first.load('items:120', 1000, 5000, loader);
    await new SapCacheService(
      new ConfigService({ SAP_COMPANY_DB: 'other' }),
    ).load('items:128', 1000, 5000, loader);
    expect(loader).toHaveBeenCalledTimes(3);
    await expect(
      first.load('failure', 1000, 5000, () =>
        Promise.reject(new Error('secret')),
      ),
    ).rejects.toThrow('SAP cache refresh unavailable');
    expect(
      [...store.values()].some((row) => row.value.includes('secret')),
    ).toBe(false);
  });

  it('does not call SAP when Redis is unavailable', async () => {
    client.get.mockRejectedValue(new Error('Redis down'));
    const loader = jest.fn();
    await expect(
      new SapCacheService(config()).load('items', 1000, 5000, loader),
    ).rejects.toThrow();
    expect(loader).not.toHaveBeenCalled();
  });

  it('fences a slow loader after another owner has acquired the expired lease', async () => {
    const first = new SapCacheService(config());
    const second = new SapCacheService(config());
    await expect(
      first.load('items', 1000, 5000, async () => {
        now += 180001;
        await second.load('items', 1000, 5000, () => Promise.resolve('new'));
        return 'old';
      }),
    ).rejects.toThrow('SAP cache refresh unavailable');
    expect(
      (await second.load('items', 1000, 5000, () => Promise.resolve('wrong')))
        .value,
    ).toBe('new');
  });

  it('invalidates only the rejected session and preserves absolute expiry', async () => {
    const cache = new SapCacheService(config());
    const expiresAt = now + 5000;
    const lifetime = (_: string, at: number) => expiresAt - at;
    await cache.load('session', lifetime, lifetime, () =>
      Promise.resolve('new-session'),
    );
    await cache.invalidateSession('old-session');
    now += 3000;
    const loader = jest.fn().mockResolvedValue('replacement');
    expect(
      (await cache.load('session', lifetime, lifetime, loader)).value,
    ).toBe('new-session');
    expect(loader).not.toHaveBeenCalled();
    await cache.invalidateSession('new-session');
    expect(
      (await cache.load('session', lifetime, lifetime, loader)).value,
    ).toBe('replacement');
    now += 2001;
    await cache.load('session', 1000, 1000, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('shares encrypted SAP sessions between processes, renews on 401, and respects expiry', async () => {
    const cfg = new ConfigService({
      SAP_SERVICE_LAYER_URL: 'https://sap.test/b1s/v2/',
      SAP_COMPANY_DB: 'test',
      SAP_USERNAME: 'test',
      SAP_PASSWORD: 'test',
      SAP_SESSION_CACHE_KEY: 'ab'.repeat(32),
    });
    let logins = 0;
    let rejectSession = false;
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (url) => {
        await Promise.resolve();
        if (String(url).endsWith('/Login')) {
          logins++;
          return new Response(JSON.stringify({ SessionTimeout: 2 }), {
            headers: { 'Set-Cookie': `B1SESSION=secret-${logins}; HttpOnly` },
          });
        }
        if (rejectSession) {
          rejectSession = false;
          return new Response('{}', { status: 401 });
        }
        return new Response(JSON.stringify({ TreeCode: 'FG' }));
      });
    const make = () => new SapItemSyncService(cfg, new SapCacheService(cfg));
    await Promise.all([
      make().getProductTree('FG'),
      make().getProductTree('FG'),
    ]);
    expect(logins).toBe(1);
    expect(
      [...store.values()].some(
        (row) =>
          row.value.includes('B1SESSION') || row.value.includes('secret-'),
      ),
    ).toBe(false);
    now += 30000;
    await make().getProductTree('FG');
    expect(logins).toBe(1);
    rejectSession = true;
    await make().getProductTree('FG');
    expect(logins).toBe(2);
    now += 60001;
    await make().getProductTree('FG');
    expect(logins).toBe(3);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('hydrates material, FG, warehouse and BOM snapshots after restart without SAP requests', async () => {
    const cfg = new ConfigService({
      SAP_SYNC_ENABLED: 'true',
      SAP_SERVICE_LAYER_URL: 'https://sap.test/b1s/v2/',
      SAP_COMPANY_DB: 'test',
      SAP_USERNAME: 'test',
      SAP_PASSWORD: 'test',
      SAP_SESSION_CACHE_KEY: 'ab'.repeat(32),
    });
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (input) => {
        await Promise.resolve();
        const url = new URL(String(input));
        if (url.pathname.endsWith('/Login'))
          return new Response(JSON.stringify({ SessionTimeout: 30 }), {
            headers: { 'Set-Cookie': 'B1SESSION=test; HttpOnly' },
          });
        if (url.pathname.endsWith('/Items'))
          return new Response(JSON.stringify({ value: [{ ItemCode: 'SAP' }] }));
        if (url.pathname.endsWith('/Warehouses'))
          return new Response(
            JSON.stringify({
              value: [{ WarehouseCode: '900', WarehouseName: 'Main' }],
            }),
          );
        return new Response(
          JSON.stringify({
            TreeCode: 'SAP',
            Quantity: 1,
            ProductTreeLines: [
              { ItemCode: 'M', Quantity: 2, Warehouse: '900' },
            ],
          }),
        );
      });
    const make = () => {
      const cache = new SapCacheService(cfg);
      const items = new SapItemSyncService(cfg, cache);
      return { items, bom: new SapBomService(items, cfg, cache) };
    };
    const first = make();
    const second = make();
    const rows = [{ PartNumber: 'SAP', PartNumberSAP: ' ' }];
    first.items.decorate(rows);
    await new Promise((resolve) => setImmediate(resolve));
    first.items.decorate(rows, 'finishGood');
    await new Promise((resolve) => setImmediate(resolve));
    const original = await first.bom.get('SAP');
    expect(original.status).toBe('FOUND');
    expect(original.bom?.ProductTreeLines[0].WarehouseName).toBe('Main');
    const requests = fetchMock.mock.calls.length;
    now += 1000;
    second.items.decorate(rows);
    second.items.decorate(rows, 'finishGood');
    await new Promise((resolve) => setImmediate(resolve));
    expect(second.items.decorate(rows)[0].SAPSyncStatus).toBe('SYNCED');
    expect(second.items.decorate(rows, 'finishGood')[0].SAPSyncStatus).toBe(
      'SYNCED',
    );
    expect(await second.bom.get('SAP')).toEqual(original);
    expect(fetchMock).toHaveBeenCalledTimes(requests);
  });
});
