/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request as httpsRequest } from 'node:https';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { SapCacheService } from './sap-cache.service';

export interface SapSync {
  SAPSyncStatus: 'SYNCED' | 'NOT_FOUND' | 'UNKNOWN';
  SAPSyncCheckedAt: string | null;
  SAPSyncStale: boolean;
}

type Item = { PartNumber: string; PartNumberSAP?: string | null };
type Snapshot = { codes: Set<string>; at: number };
type Domain = 'material' | 'finishGood';
type Cache = {
  snapshot?: Snapshot;
  refreshTask?: Promise<void>;
  retryAt: number;
};
type Session = { cookie: string; expiresAt: number };

export class SapPostingError extends Error {
  constructor(
    public readonly uncertain: boolean,
    public readonly httpStatus?: number,
  ) {
    super(
      uncertain
        ? 'SAP posting outcome is unknown; reconcile before retry.'
        : `SAP rejected the transaction${httpStatus ? ` (HTTP ${httpStatus})` : ''}.`,
    );
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid SAP response');
  }
  return value as Record<string, unknown>;
}

@Injectable()
export class SapItemSyncService {
  sessionHealth() {
    return {
      active: !!this.session && this.session.expiresAt > Date.now(),
      expiresAt: this.session
        ? new Date(this.session.expiresAt).toISOString()
        : null,
    };
  }

  async readResource(resource: string, query: Record<string, string> = {}) {
    if (!/^[A-Za-z][A-Za-z0-9_]*(?:\([^/]*\))?$/.test(resource))
      throw new Error('Invalid SAP resource');
    const url = new URL(resource, this.base());
    url.search = new URLSearchParams(query).toString();
    return this.getPage(url);
  }

  async postTransaction(
    resource: string,
    body: Record<string, unknown>,
    beforeSend: () => Promise<void>,
    method: 'POST' | 'PATCH' = 'POST',
  ): Promise<Record<string, unknown>> {
    if (
      ![
        'Orders',
        'ProductionOrders',
        'InventoryGenEntries',
        'InventoryGenExits',
        'DeliveryNotes',
        'Returns',
        'InventoryCountings',
        'InventoryPostings',
      ].some(
        (name) =>
          resource === name ||
          new RegExp(`^${name}\\(\\d+\\)$`).test(resource) ||
          (name === 'InventoryCountings' &&
            /^InventoryCountings\(\d+\)\/Close$/.test(resource)),
      )
    )
      throw new Error('Invalid SAP posting resource');
    const url = new URL(resource, this.base());
    let marked = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const session = await this.login();
      if (!marked) {
        await beforeSend();
        marked = true;
      }
      let response: Response;
      try {
        response = await this.request(url, {
          method,
          headers: {
            Cookie: session.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
      } catch {
        throw new SapPostingError(true);
      }
      if (response.status === 401 && attempt === 0) {
        await this.rejectSession(session);
        continue;
      }
      if (!response.ok)
        throw new SapPostingError(
          response.status >= 500 || response.status === 408,
          response.status,
        );
      if (response.status === 204) return {};
      try {
        return object(await response.json());
      } catch {
        throw new SapPostingError(true);
      }
    }
    throw new SapPostingError(false, 401);
  }
  private readonly logger = new Logger(SapItemSyncService.name);
  private readonly caches: Record<Domain, Cache> = {
    material: { retryAt: 0 },
    finishGood: { retryAt: 0 },
  };
  private loginTask?: Promise<Session>;
  private session?: Session;
  private readonly ttl = 5 * 60_000;
  private readonly maxAge = 30 * 60_000;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly shared?: SapCacheService,
  ) {}

  private sessionCiphertext?: string;

  private sessionKey(): Buffer | undefined {
    const value = this.config.get<string>('SAP_SESSION_CACHE_KEY');
    if (!value) return undefined;
    if (!/^[a-f0-9]{64}$/i.test(value))
      throw new Error('Invalid SAP session cache key');
    return Buffer.from(value, 'hex');
  }

  private sealSession(session: Session, key: Buffer): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(session), 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      'base64',
    );
  }

  private openSession(value: string, key: Buffer): Session {
    const data = Buffer.from(value, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    const session = object(
      JSON.parse(
        Buffer.concat([
          decipher.update(data.subarray(28)),
          decipher.final(),
        ]).toString('utf8'),
      ),
    );
    if (
      typeof session.cookie !== 'string' ||
      typeof session.expiresAt !== 'number' ||
      !Number.isFinite(session.expiresAt)
    )
      throw new Error('Invalid cached SAP session');
    return { cookie: session.cookie, expiresAt: session.expiresAt };
  }

  private async loadSession(): Promise<Session> {
    const key = this.sessionKey();
    if (!this.shared || !key) {
      this.session = await this.createSession();
      return this.session;
    }
    // Preserve SAP's absolute session expiry when another process reuses it.
    const lifetime = (value: string, at: number) =>
      Math.max(0, this.openSession(value, key).expiresAt - at);
    const result = await this.shared.load(
      'session',
      lifetime,
      lifetime,
      async () => this.sealSession(await this.createSession(), key),
    );
    this.sessionCiphertext = result.value;
    this.session = this.openSession(result.value, key);
    return this.session;
  }

  private async rejectSession(session: Session): Promise<void> {
    if (this.session !== session) return;
    this.session = undefined;
    const previous = this.sessionCiphertext;
    this.sessionCiphertext = undefined;
    if (previous && this.shared) await this.shared.invalidateSession(previous);
  }

  private async request(
    url: URL,
    options: {
      method?: string;
      headers: Record<string, string>;
      body?: string;
    },
  ): Promise<Response> {
    if (this.config.get<string>('SAP_TLS_REJECT_UNAUTHORIZED') !== 'false') {
      return fetch(url, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
    }
    // Explicit opt-out applies only to SAP, never NODE_TLS_REJECT_UNAUTHORIZED.
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        url,
        {
          method: options.method ?? 'GET',
          headers: options.headers,
          rejectUnauthorized: false,
          signal: AbortSignal.timeout(10_000),
        },
        (res) => {
          const chunks: Buffer[] = [];
          let size = 0;
          res.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > 20 * 1024 * 1024) {
              res.destroy(new Error('SAP response too large'));
              return;
            }
            chunks.push(chunk);
          });
          res.on('error', reject);
          res.on('end', () => {
            const headers = new Headers();
            for (const [key, value] of Object.entries(res.headers)) {
              if (Array.isArray(value))
                value.forEach((entry) => headers.append(key, entry));
              else if (value !== undefined) headers.append(key, value);
            }
            // Native HTTPS never follows redirects, so cookies stay at this URL.
            const status = res.statusCode ?? 502;
            resolve(
              new Response(
                [204, 205, 304].includes(status)
                  ? null
                  : Buffer.concat(chunks).toString('utf8'),
                { status, headers },
              ),
            );
          });
        },
      );
      req.on('error', reject);
      req.end(options.body);
    });
  }

  // Never block a master-data read on SAP. Publish only a complete paginated snapshot.
  decorate<T extends Item>(
    items: T[],
    domain: Domain = 'material',
  ): (T & SapSync)[] {
    const cache = this.caches[domain];
    const enabled = this.config.get<string>('SAP_SYNC_ENABLED') === 'true';
    const now = Date.now();
    const snapshot = enabled ? cache.snapshot : undefined;
    if (
      enabled &&
      items.length &&
      !cache.refreshTask &&
      now >= cache.retryAt &&
      (!snapshot || now - snapshot.at >= this.ttl)
    ) {
      cache.refreshTask = this.refresh(domain)
        .catch(() => {
          cache.retryAt = Date.now() + 60_000;
          // Do not log upstream bodies, credentials, cookies, or item codes.
          this.logger.warn('SAP item cache refresh failed; retry deferred');
        })
        .finally(() => {
          cache.refreshTask = undefined;
        });
    }
    const usable = snapshot && now - snapshot.at < this.maxAge;
    return items.map((item) => ({
      ...item,
      SAPSyncStatus: usable
        ? snapshot.codes.has(
            item.PartNumberSAP?.trim() || item.PartNumber.trim(),
          )
          ? 'SYNCED'
          : 'NOT_FOUND'
        : 'UNKNOWN',
      SAPSyncCheckedAt: snapshot ? new Date(snapshot.at).toISOString() : null,
      SAPSyncStale: !!snapshot && now - snapshot.at >= this.ttl,
    }));
  }

  private base(): URL {
    const base = new URL(
      this.config.get<string>('SAP_SERVICE_LAYER_URL') || '',
    );
    if (
      base.protocol !== 'https:' ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      throw new Error('Invalid SAP URL configuration');
    }
    base.pathname = base.pathname.replace(/\/$/, '') + '/';
    if (!/\/b1s\/v[12]\/$/.test(base.pathname))
      throw new Error('Invalid SAP base path');
    return base;
  }

  private async login(): Promise<Session> {
    if (this.session && this.session.expiresAt > Date.now())
      return this.session;
    if (this.loginTask) return this.loginTask;
    this.loginTask = this.loadSession();
    try {
      return await this.loginTask;
    } finally {
      this.loginTask = undefined;
    }
  }

  private async createSession(): Promise<Session> {
    const CompanyDB = this.config.get<string>('SAP_COMPANY_DB');
    const UserName = this.config.get<string>('SAP_USERNAME');
    const Password = this.config.get<string>('SAP_PASSWORD');
    if (!CompanyDB || !UserName || !Password)
      throw new Error('Missing SAP configuration');
    const response = await this.request(new URL('Login', this.base()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ CompanyDB, UserName, Password }),
    });
    if (!response.ok) throw new Error('SAP login failed');
    const body = object(await response.json());
    const cookies = response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';')[0])
      .filter((cookie) => /^(B1SESSION|ROUTEID)=/.test(cookie));
    if (!cookies.some((cookie) => cookie.startsWith('B1SESSION='))) {
      throw new Error('SAP session cookie missing');
    }
    if (typeof body.SessionTimeout !== 'number' || body.SessionTimeout <= 0) {
      throw new Error('Invalid SAP session timeout');
    }
    return {
      cookie: cookies.join('; '),
      expiresAt:
        Date.now() + Math.max(1000, body.SessionTimeout * 60_000 - 60_000),
    };
  }

  private warehouseSnapshot?: { names: Map<string, string>; at: number };
  private warehouseTask?: Promise<void>;
  private warehouseRetryAt = 0;

  async getWarehouseNames(): Promise<ReadonlyMap<string, string>> {
    const now = Date.now();
    if (
      (!this.warehouseSnapshot ||
        now - this.warehouseSnapshot.at >= 30 * 60_000) &&
      !this.warehouseTask &&
      now >= this.warehouseRetryAt
    ) {
      this.warehouseTask = this.loadWarehouseNames()
        .catch(() => {
          this.warehouseRetryAt = Date.now() + 60_000;
        })
        .finally(() => {
          this.warehouseTask = undefined;
        });
    }
    if (
      !this.warehouseSnapshot ||
      now - this.warehouseSnapshot.at >= 24 * 60 * 60_000
    )
      await this.warehouseTask;
    return this.warehouseSnapshot &&
      Date.now() - this.warehouseSnapshot.at < 24 * 60 * 60_000
      ? this.warehouseSnapshot.names
      : new Map<string, string>();
  }

  private async loadWarehouseNames(): Promise<void> {
    if (!this.shared) {
      this.warehouseSnapshot = {
        names: new Map(await this.fetchWarehouseNames()),
        at: Date.now(),
      };
      return;
    }
    const result = await this.shared.load(
      'warehouses',
      30 * 60_000,
      24 * 60 * 60_000,
      () => this.fetchWarehouseNames(),
    );
    this.warehouseSnapshot = { names: new Map(result.value), at: result.at };
    if (Date.now() - result.at >= 30 * 60_000)
      this.warehouseRetryAt = Date.now() + 10_000;
  }

  private async fetchWarehouseNames(): Promise<[string, string][]> {
    const base = this.base();
    let url = new URL('Warehouses', base);
    url.search = new URLSearchParams({
      $select: 'WarehouseCode,WarehouseName',
      $orderby: 'WarehouseCode',
    }).toString();
    const names = new Map<string, string>();
    const visited = new Set<string>();
    const deadline = Date.now() + 120_000;
    for (let page = 0; page < 100; page++) {
      if (
        url.origin !== base.origin ||
        url.pathname !== `${base.pathname}Warehouses` ||
        url.username ||
        url.password ||
        url.hash ||
        visited.has(url.href) ||
        Date.now() > deadline
      )
        throw new Error('Invalid SAP warehouse pagination');
      visited.add(url.href);
      const body = await this.getPage(url);
      if (!Array.isArray(body.value)) throw new Error('Invalid SAP warehouses');
      for (const value of body.value) {
        const row = object(value);
        if (
          typeof row.WarehouseCode !== 'string' ||
          typeof row.WarehouseName !== 'string'
        )
          throw new Error('Invalid SAP warehouse');
        names.set(row.WarehouseCode, row.WarehouseName);
      }
      const next = body['@odata.nextLink'] ?? body['odata.nextLink'];
      if (next === undefined || next === null) {
        return [...names];
      }
      if (typeof next !== 'string' || !next)
        throw new Error('Invalid SAP warehouse next page');
      url = new URL(next, url);
    }
    throw new Error('SAP warehouse pagination limit exceeded');
  }

  materialWritesEnabled(): boolean {
    return this.config.get<string>('SAP_MATERIAL_WRITE_ENABLED') === 'true';
  }

  async updateMaterial(
    code: string,
    input: { partName: string; minimumStock: number; maximumStock: number },
  ): Promise<void> {
    if (!this.materialWritesEnabled())
      throw new Error('SAP material writes disabled');
    const escaped = encodeURIComponent(code.replace(/'/g, "''"));
    const url = new URL(`Items('${escaped}')`, this.base());
    const body = JSON.stringify({
      ItemName: input.partName,
      ForeignName: input.partName,
      ManageStockByWarehouse: 'tNO',
      MinInventory: input.minimumStock,
      MaxInventory: input.maximumStock,
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const session = await this.login();
      const response = await this.request(url, {
        method: 'PATCH',
        headers: { Cookie: session.cookie, 'Content-Type': 'application/json' },
        body,
      });
      if (response.status === 401 && attempt === 0) {
        await this.rejectSession(session);
        continue;
      }
      if (!response.ok) throw new Error('SAP material update failed');
      // No upstream payload is returned or logged. PATCH commonly returns 204.
      return;
    }
    throw new Error('SAP session rejected');
  }

  async getProductTree(code: string): Promise<Record<string, unknown> | null> {
    const escaped = encodeURIComponent(code.replace(/'/g, "''"));
    return this.getPage(
      new URL(`ProductTrees('${escaped}')`, this.base()),
      true,
    );
  }

  private getPage(url: URL): Promise<Record<string, unknown>>;
  private getPage(
    url: URL,
    allowMissing: true,
  ): Promise<Record<string, unknown> | null>;
  private async getPage(
    url: URL,
    allowMissing = false,
  ): Promise<Record<string, unknown> | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const session = await this.login();
      const response = await this.request(url, {
        headers: {
          Cookie: session.cookie,
          Accept: 'application/json',
          Prefer: 'odata.maxpagesize=1000',
        },
      });
      if (response.status === 401 && attempt === 0) {
        await this.rejectSession(session);
        continue;
      }
      if (allowMissing && response.status === 404) {
        const body = object(await response.json());
        const error = object(body.error);
        if (String(error.code) === '-2028') return null;
      }
      if (!response.ok) throw new Error('SAP item query failed');
      return object(await response.json());
    }
    throw new Error('SAP session rejected');
  }

  private async refresh(domain: Domain): Promise<void> {
    const cache = this.caches[domain];
    const group =
      domain === 'material'
        ? (this.config.get<string>('SAP_MATERIAL_ITEM_GROUP') ?? '128')
        : (this.config.get<string>('SAP_FINISH_GOOD_ITEM_GROUP') ?? '120');
    if (!/^\d+$/.test(group)) throw new Error('Invalid SAP item group');
    if (!this.shared) {
      cache.snapshot = {
        codes: new Set(await this.fetchItemCodes(group)),
        at: Date.now(),
      };
      return;
    }
    const result = await this.shared.load(
      `items:${group}`,
      this.ttl,
      this.maxAge,
      () => this.fetchItemCodes(group),
    );
    cache.snapshot = { codes: new Set(result.value), at: result.at };
    if (Date.now() - result.at >= this.ttl) cache.retryAt = Date.now() + 10_000;
  }

  private async fetchItemCodes(group: string): Promise<string[]> {
    const base = this.base();
    let url = new URL('Items', base);
    url.search = new URLSearchParams({
      $select: 'ItemCode',
      $filter: `ItemsGroupCode eq ${group}`,
      $orderby: 'ItemCode',
    }).toString();
    const codes = new Set<string>();
    const visited = new Set<string>();
    const deadline = Date.now() + 120_000;
    for (let page = 0; page < 1000; page++) {
      // Do not forward session cookies to an upstream-controlled origin or other resource.
      if (
        url.origin !== base.origin ||
        url.pathname !== `${base.pathname}Items` ||
        url.username ||
        url.password ||
        url.hash ||
        visited.has(url.href) ||
        Date.now() > deadline
      ) {
        throw new Error('Invalid SAP pagination');
      }
      visited.add(url.href);
      const body = await this.getPage(url);
      if (!Array.isArray(body.value)) throw new Error('Invalid SAP items');
      for (const value of body.value) {
        const item = object(value);
        if (typeof item.ItemCode !== 'string' || !item.ItemCode.trim())
          throw new Error('Invalid SAP item code');
        codes.add(item.ItemCode.trim());
      }
      const next = body['@odata.nextLink'] ?? body['odata.nextLink'];
      if (next === undefined || next === null) {
        return [...codes];
      }
      if (typeof next !== 'string' || !next)
        throw new Error('Invalid SAP next page');
      url = new URL(next, url);
    }
    throw new Error('SAP pagination limit exceeded');
  }
}
