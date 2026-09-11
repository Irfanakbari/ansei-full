/* By Irfan Akbari Vuteq Indonesia - 2026-09-11 */
/**
 * SSO session store singleton.
 *
 * Next.js compiles each route handler into its own bundle, so a plain in-memory
 * store created per module instance in `lib/sso.ts` is NOT shared between the
 * `/auth/login`, `/auth/callback`, `/api/auth/session`, and proxy handlers.
 * That caused "Sign-in transaction was already used or expired." because the
 * PKCE transaction saved by the login route lived in a different memory store
 * than the one read by the callback route.
 *
 * This store attaches one instance to `globalThis` so every route bundle in the
 * same Node process shares the same session/transaction data. Use a shared
 * Redis/database `SessionStore` when running multiple replicas or if sessions
 * must survive process restarts.
 */

import 'server-only';
import type { SessionStore, StoredSession } from '@vuteq/sso-client-react';

const GLOBAL_KEY = '__vuteqSsoSessionStore';

interface GlobalStore {
  sessions: Map<string, StoredSession>;
  locks: Map<string, Promise<void>>;
}

function createStore(): SessionStore {
  let global = (globalThis as Record<string, unknown>)[GLOBAL_KEY] as
    | GlobalStore
    | undefined;

  if (!global) {
    global = { sessions: new Map(), locks: new Map() };
    (globalThis as Record<string, unknown>)[GLOBAL_KEY] = global;
  }

  const current = (key: string): StoredSession | null => {
    const value = global!.sessions.get(key);
    if (value && value.expiresAt <= Date.now()) {
      global!.sessions.delete(key);
      return null;
    }
    return value || null;
  };

  return {
    async get(key: string) {
      return current(key);
    },

    async set(key: string, session: StoredSession) {
      global!.sessions.set(key, session);
    },

    async take(key: string) {
      const value = current(key);
      global!.sessions.delete(key);
      return value;
    },

    async delete(key: string) {
      global!.sessions.delete(key);
    },

    async deleteMatching(clientId: string, subject?: string, sid?: string) {
      let deleted = 0;
      for (const [key, value] of global!.sessions) {
        if (value.expiresAt <= Date.now()) {
          global!.sessions.delete(key);
          continue;
        }
        if (
          value.clientId === clientId &&
          ((subject && value.subject === subject) || (sid && value.sid === sid))
        ) {
          global!.sessions.delete(key);
          deleted += 1;
        }
      }
      return deleted;
    },

    async withLock<T>(key: string, operation: () => Promise<T>) {
      const previous = global!.locks.get(key) || Promise.resolve();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const queued = previous.then(() => gate);
      global!.locks.set(key, queued);
      await previous;
      try {
        return await operation();
      } finally {
        release();
        if (global!.locks.get(key) === queued) global!.locks.delete(key);
      }
    },
  };
}

export const ssoSessionStore: SessionStore = createStore();