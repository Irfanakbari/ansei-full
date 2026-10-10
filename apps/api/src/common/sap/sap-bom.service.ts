/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SapItemSyncService } from './sap-item-sync.service';
import { SapCacheService } from './sap-cache.service';

export interface SapBomLine {
  LineNumber: number;
  ItemCode: string;
  Quantity: number;
  Warehouse: string | null;
  WarehouseName: string | null;
  ItemType: string | null;
}
export interface SapBom {
  TreeCode: string;
  Quantity: number;
  ProductDescription: string | null;
  ProductTreeLines: SapBomLine[];
}
export interface SapBomResult {
  status: 'FOUND' | 'NOT_FOUND' | 'UNKNOWN' | 'DISABLED' | 'UNMAPPED';
  checkedAt: string | null;
  stale: boolean;
  bom: SapBom | null;
}
type Entry = {
  snapshot?: { bom: SapBom | null; at: number };
  task?: Promise<void>;
};

@Injectable()
export class SapBomService {
  private readonly cache = new Map<string, Entry>();
  private active = 0;
  private retryAt = 0;
  private readonly ttl = 5 * 60_000;
  private readonly maxAge = 30 * 60_000;

  constructor(
    private readonly sap: SapItemSyncService,
    private readonly config: ConfigService,
    @Optional() private readonly shared?: SapCacheService,
  ) {}

  async get(code: string): Promise<SapBomResult> {
    const empty = { checkedAt: null, stale: false, bom: null };
    if (this.config.get<string>('SAP_SYNC_ENABLED') !== 'true')
      return { ...empty, status: 'DISABLED' };
    if (!code) return { ...empty, status: 'UNMAPPED' };
    let entry = this.cache.get(code);
    if (!entry) {
      if (this.cache.size >= 500) {
        const candidate = [...this.cache].find(([, value]) => !value.task);
        if (!candidate) return { ...empty, status: 'UNKNOWN' };
        this.cache.delete(candidate[0]);
      }
      entry = {};
      this.cache.set(code, entry);
    } else {
      this.cache.delete(code);
      this.cache.set(code, entry);
    }
    const current = entry;
    const expired =
      !current.snapshot || Date.now() - current.snapshot.at >= this.ttl;
    if (
      expired &&
      !current.task &&
      this.active < 4 &&
      Date.now() >= this.retryAt
    ) {
      this.active++;
      current.task = this.load(code)
        .then((snapshot) => {
          current.snapshot = snapshot;
          if (Date.now() - snapshot.at >= this.ttl)
            this.retryAt = Date.now() + 10_000;
        })
        .catch(() => {
          // Global failure cooldown protects SAP even when users open different FGs.
          this.retryAt = Date.now() + 60_000;
        })
        .finally(() => {
          this.active--;
          current.task = undefined;
        });
    }
    // Cold lookups wait; stale results return immediately while one refresh runs.
    if (!current.snapshot || Date.now() - current.snapshot.at >= this.maxAge)
      await current.task;
    const snapshot = current.snapshot;
    if (!snapshot || Date.now() - snapshot.at >= this.maxAge)
      return { ...empty, status: 'UNKNOWN' };
    const names = snapshot.bom?.ProductTreeLines.some((line) => line.Warehouse)
      ? await this.sap.getWarehouseNames()
      : new Map<string, string>();
    return {
      status: snapshot.bom ? 'FOUND' : 'NOT_FOUND',
      checkedAt: new Date(snapshot.at).toISOString(),
      stale: Date.now() - snapshot.at >= this.ttl,
      bom: snapshot.bom
        ? {
            ...snapshot.bom,
            ProductTreeLines: snapshot.bom.ProductTreeLines.map((line) => ({
              ...line,
              WarehouseName: line.Warehouse
                ? (names.get(line.Warehouse) ?? null)
                : null,
            })),
          }
        : null,
    };
  }

  private async load(
    code: string,
  ): Promise<{ bom: SapBom | null; at: number }> {
    const loader = async () => {
      const body = await this.sap.getProductTree(code);
      return body === null ? null : this.parse(body, code);
    };
    if (!this.shared) return { bom: await loader(), at: Date.now() };
    const result = await this.shared.load(
      `bom:${code}`,
      this.ttl,
      this.maxAge,
      loader,
      'bom',
    );
    return { bom: result.value, at: result.at };
  }

  private parse(body: Record<string, unknown>, code: string): SapBom {
    if (
      body.TreeCode !== code ||
      typeof body.Quantity !== 'number' ||
      !Number.isFinite(body.Quantity) ||
      body.Quantity <= 0 ||
      !Array.isArray(body.ProductTreeLines)
    )
      throw new Error('Invalid SAP BOM');
    return {
      TreeCode: code,
      Quantity: body.Quantity,
      ProductDescription:
        typeof body.ProductDescription === 'string'
          ? body.ProductDescription
          : null,
      ProductTreeLines: body.ProductTreeLines.map((value: unknown, index) => {
        if (!value || typeof value !== 'object')
          throw new Error('Invalid SAP BOM line');
        const line = value as Record<string, unknown>;
        if (
          typeof line.ItemCode !== 'string' ||
          typeof line.Quantity !== 'number' ||
          !Number.isFinite(line.Quantity)
        )
          throw new Error('Invalid SAP BOM line');
        return {
          LineNumber: index + 1,
          ItemCode: line.ItemCode,
          Quantity: line.Quantity,
          Warehouse: typeof line.Warehouse === 'string' ? line.Warehouse : null,
          WarehouseName: null,
          ItemType: typeof line.ItemType === 'string' ? line.ItemType : null,
        };
      }),
    };
  }
}
