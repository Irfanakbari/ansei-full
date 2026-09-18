/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */

import 'server-only';
import type { SessionStore, StoredSession } from '@vuteq/sso-client-react';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

const PREFIX = `${process.env.VUTEQ_SSO_REDIS_KEY_PREFIX ?? ''}ansei:sso:`;
const LOCK_PREFIX = `${PREFIX}lock:`;
const GLOBAL_KEY = '__anseiVuteqSsoRedis';
const LOCK_ACQUIRE_TIMEOUT_MS = 5_000;
const LOCK_LEASE_MS = 30_000;
const LOCK_RETRY_MS = 50;

function logRedisError(event: string, error: unknown): void {
  const redisError = error as { name?: unknown; code?: unknown; message?: unknown };
  console.error(
    JSON.stringify({
      event,
      errorName: redisError.name,
      errorCode: redisError.code,
      errorMessage: redisError.message,
    }),
  );
}

function redisClient(): Redis {
  const globalStore = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: Redis;
  };

  if (!globalStore[GLOBAL_KEY]) {
    const client = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.VUTEQ_SSO_REDIS_DB ?? 0),
      connectionName: 'ansei-web-sso-session',
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
    client.on('error', (error: Error & { code?: string }) => {
      logRedisError('sso_session_redis_error', error);
    });
    globalStore[GLOBAL_KEY] = client;
  }

  return globalStore[GLOBAL_KEY];
}

const entryKey = (key: string): string => `${PREFIX}entry:${key}`;

async function parseStoredSession(
  redis: Redis,
  key: string,
  value: string,
): Promise<StoredSession | null> {
  try {
    const session = JSON.parse(value) as StoredSession;
    if (typeof session.expiresAt !== 'number' || session.expiresAt <= Date.now()) {
      await redis.del(key);
      return null;
    }
    return session;
  } catch {
    await redis.del(key);
    console.error(JSON.stringify({ event: 'sso_session_invalid_record' }));
    return null;
  }
}

const store: SessionStore = {
  async get(key) {
    const redis = redisClient();
    const redisKey = entryKey(key);
    const value = await redis.get(redisKey);
    return value ? parseStoredSession(redis, redisKey, value) : null;
  },

  async set(key, session) {
    const ttl = Math.max(1, session.expiresAt - Date.now());
    await redisClient().set(entryKey(key), JSON.stringify(session), 'PX', ttl);
  },

  async take(key) {
    const redis = redisClient();
    const redisKey = entryKey(key);
    const value = (await redis.eval(
      "local v=redis.call('GET',KEYS[1]); if v then redis.call('DEL',KEYS[1]); end; return v",
      1,
      redisKey,
    )) as string | null;
    return value ? parseStoredSession(redis, redisKey, value) : null;
  },

  async delete(key) {
    await redisClient().del(entryKey(key));
  },

  async deleteMatching(clientId, subject, sid) {
    const redis = redisClient();
    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${PREFIX}entry:*`,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const value = await redis.get(key);
        if (!value) continue;
        const session = await parseStoredSession(redis, key, value);
        if (
          session?.clientId === clientId &&
          ((subject && session.subject === subject) || (sid && session.sid === sid))
        ) {
          deleted += await redis.del(key);
        }
      }
    } while (cursor !== '0');

    return deleted;
  },

  async withLock(key, operation) {
    const redis = redisClient();
    const lockKey = `${LOCK_PREFIX}${key}`;
    const owner = randomUUID();
    const deadline = Date.now() + LOCK_ACQUIRE_TIMEOUT_MS;

    while ((await redis.set(lockKey, owner, 'PX', LOCK_LEASE_MS, 'NX')) !== 'OK') {
      if (Date.now() >= deadline) throw new Error('SSO session lock timed out');
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }

    try {
      return await operation();
    } finally {
      try {
        await redis.eval(
          "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
          1,
          lockKey,
          owner,
        );
      } catch (error) {
        logRedisError('sso_session_lock_release_failed', error);
      }
    }
  },
};

export const ssoSessionStore: SessionStore = store;
