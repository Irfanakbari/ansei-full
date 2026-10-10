/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisConnection, RedisClient } from 'bullmq';
import { createHash, randomUUID } from 'node:crypto';

export type SapCacheEntry<T> = { value: T; at: number };
type Lifetime<T> = number | ((value: T, at: number) => number);

// Tokens fence both publication and release after a lease expires.
const scripts = {
  sapCacheAcquire: {
    numberOfKeys: 2,
    lua: `if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
      if redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2], 'NX') then return 1 end
      return 0`,
  },
  sapCachePublish: {
    numberOfKeys: 2,
    lua: `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
      redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3])
      return 1`,
  },
  sapCacheRelease: {
    numberOfKeys: 2,
    lua: `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
      if ARGV[2] == 'failed' then redis.call('SET', KEYS[2], '1', 'PX', 60000) end
      return redis.call('DEL', KEYS[1])`,
  },
  sapCacheInvalidate: {
    numberOfKeys: 1,
    lua: `local raw = redis.call('GET', KEYS[1])
      if not raw then return 0 end
      local entry = cjson.decode(raw)
      if entry.value ~= ARGV[1] then return 0 end
      return redis.call('DEL', KEYS[1])`,
  },
};

@Injectable()
export class SapCacheService implements OnModuleDestroy {
  async health() {
    try {
      const client = await this.client();
      const info = await this.bounded(client.info());
      const fields = Object.fromEntries(
        info
          .split(/\r?\n/)
          .filter((line) => line.includes(':'))
          .map((line) => line.split(':')),
      );
      return {
        available: true,
        aofEnabled: fields.aof_enabled === '1',
        aofWriteHealthy: fields.aof_last_write_status === 'ok',
        observedAt: new Date().toISOString(),
      };
    } catch {
      return {
        available: false,
        aofEnabled: null,
        aofWriteHealthy: null,
        observedAt: new Date().toISOString(),
      };
    }
  }
  private connection?: RedisConnection;
  private clientTask?: Promise<RedisClient>;
  private readonly namespace: string;

  constructor(config: ConfigService) {
    this.config = config;
    // Separate credentials, companies, environments and cache schema versions.
    const scope = [
      'v1',
      config.get<string>('SAP_SERVICE_LAYER_URL')?.replace(/\/$/, ''),
      config.get<string>('SAP_COMPANY_DB'),
      config.get<string>('SAP_USERNAME'),
      config.get<string>('SAP_PASSWORD'),
      config.get<string>('SAP_SESSION_CACHE_KEY'),
    ];
    this.namespace = `ansei:sap:{${createHash('sha256').update(JSON.stringify(scope)).digest('hex')}}`;
  }
  private readonly config: ConfigService;

  private key(name: string): string {
    return `${this.namespace}:${createHash('sha256').update(name).digest('hex')}`;
  }

  private async bounded<T>(work: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('SAP cache unavailable')),
            2000,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private client(): Promise<RedisClient> {
    if (!this.connection) {
      this.connection = new RedisConnection(
        {
          host: this.config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(this.config.get<string>('REDIS_PORT', '6379')),
          password: this.config.get<string>('REDIS_PASSWORD') || undefined,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          commandTimeout: 1500,
          connectTimeout: 1500,
          retryStrategy: (times: number) => Math.min(times * 1000, 15000),
        },
        { blocking: false },
      );
      // Callers handle availability; never log Redis errors containing connection data.
      this.connection.on('error', () => undefined);
      const connection = this.connection;
      this.clientTask = connection.client
        .then((client) => {
          for (const [name, script] of Object.entries(scripts))
            client.defineCommand(name, script);
          return client;
        })
        .catch(() => {
          if (this.connection === connection) {
            this.connection = undefined;
            this.clientTask = undefined;
          }
          void connection.close(true).catch(() => undefined);
          throw new Error('SAP cache unavailable');
        });
    }
    return this.bounded(this.clientTask!);
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close(true);
  }

  async invalidateSession(expected: string): Promise<void> {
    const client = await this.client();
    await this.bounded(
      client.runCommand('sapCacheInvalidate', [this.key('session'), expected]),
    );
  }

  async load<T>(
    name: string,
    freshMs: Lifetime<T>,
    maxAgeMs: Lifetime<T>,
    loader: () => Promise<T>,
    cooldownGroup = name,
  ): Promise<SapCacheEntry<T>> {
    const client = await this.client();
    const key = this.key(name);
    const lock = `${key}:lock`;
    const cooldown = `${this.key(cooldownGroup)}:cooldown`;
    const lifetime = (limit: Lifetime<T>, value: T, at: number) =>
      typeof limit === 'number' ? limit : limit(value, at);
    const read = async (): Promise<SapCacheEntry<T> | undefined> => {
      const raw = await this.bounded(client.get(key));
      if (!raw) return undefined;
      const entry = JSON.parse(raw) as SapCacheEntry<T>;
      if (
        !Number.isFinite(entry.at) ||
        entry.at > Date.now() ||
        !Object.prototype.hasOwnProperty.call(entry, 'value')
      )
        throw new Error('Invalid SAP cache entry');
      return Date.now() - entry.at < lifetime(maxAgeMs, entry.value, entry.at)
        ? entry
        : undefined;
    };
    const fresh = (entry: SapCacheEntry<T> | undefined) =>
      entry && Date.now() - entry.at < lifetime(freshMs, entry.value, entry.at);
    let cached = await read();
    if (fresh(cached)) return cached!;
    const token = randomUUID();
    const acquired: unknown = await this.bounded(
      client.runCommand('sapCacheAcquire', [lock, cooldown, token, 180000]),
    );
    if (acquired !== 1) {
      if (cached) return cached;
      // A cold replica briefly waits for the elected loader, never starts a duplicate.
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        cached = await read();
        if (cached) return cached;
      }
      throw new Error('SAP cache refresh deferred');
    }
    let failed = false;
    try {
      // Another instance may have published between the initial GET and lease acquisition.
      cached = await read();
      if (fresh(cached)) return cached!;
      const value = await loader();
      const result = { value, at: Date.now() };
      const published: unknown = await this.bounded(
        client.runCommand('sapCachePublish', [
          lock,
          key,
          token,
          JSON.stringify(result),
          Math.max(1, lifetime(maxAgeMs, value, result.at)),
        ]),
      );
      if (published !== 1) throw new Error('SAP cache lease expired');
      return result;
    } catch {
      failed = true;
      if (
        cached &&
        Date.now() - cached.at < lifetime(maxAgeMs, cached.value, cached.at)
      )
        return cached;
      throw new Error('SAP cache refresh unavailable');
    } finally {
      await this.bounded(
        client.runCommand('sapCacheRelease', [
          lock,
          cooldown,
          token,
          failed ? 'failed' : 'ok',
        ]),
      ).catch(() => undefined);
    }
  }
}
