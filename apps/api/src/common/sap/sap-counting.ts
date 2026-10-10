/* By Irfan Akbari Vuteq Indonesia - 2026-10-10 */
import { ConflictException } from '@nestjs/common';
import type { Prisma, SapTransaction } from '../../generated/prisma/client';
import {
  captureSapIntent,
  sapCaptureEnabled,
  sapScope,
  sapAudit,
} from './sap-transaction-capture';
import { UNCERTAIN, SENDING, SAFE_RETRY } from '../outbox/outbox-state.service';
import { sapPostingDate } from './sap-posting-date';
import type { SapItemSyncService } from './sap-item-sync.service';

export const countingKinds = [
  'INVENTORY_COUNTING',
  'COUNTING_UPDATE',
  'INVENTORY_POSTING',
  'COUNTING_CLOSE',
];
export type CountingLine = {
  itemCode: string;
  before: number;
  counted: number;
  parts: string[];
};
type CountingSnapshot = {
  countingId: string;
  reference: string;
  category: string;
  date: string;
  time: string;
  lines: CountingLine[];
  rootId?: string;
  dependencyId?: string;
  cancelled?: boolean;
  projectCode?: string;
  costCenter?: string;
};
type Detail = {
  MaterialId: string | null;
  FinishGoodId: string | null;
  Location: string;
  SystemQty: number;
  SystemQtyRack: number;
  ActualQty: number | null;
  ActualQtyRack: number | null;
};
export function countingSnapshot(
  row: Pick<SapTransaction, 'Snapshot'>,
): CountingSnapshot {
  const value = row.Snapshot as unknown as CountingSnapshot;
  if (
    !value?.countingId ||
    !value.reference ||
    !Array.isArray(value.lines) ||
    !value.lines.length ||
    value.lines.some(
      (l) =>
        !l.itemCode ||
        !Number.isSafeInteger(l.before) ||
        l.before < 0 ||
        !Number.isSafeInteger(l.counted) ||
        l.counted < 0,
    )
  )
    throw new ConflictException('Invalid frozen inventory counting snapshot.');
  return value;
}
export function aggregateCounting(
  details: Detail[],
  mapping: Map<string, string>,
  actual: boolean,
): CountingLine[] {
  const groups = new Map<string, CountingLine>();
  const seen = new Set<string>();
  for (const d of details) {
    const part = d.MaterialId ?? d.FinishGoodId ?? '';
    const code = mapping.get(part);
    if (!code) continue;
    const key = `${part}:${d.Location}`;
    if (seen.has(key))
      throw new ConflictException(
        'Duplicate item/location in inventory counting.',
      );
    seen.add(key);
    const before = d.Location === 'RACK' ? d.SystemQtyRack : d.SystemQty;
    const counted = actual
      ? d.Location === 'RACK'
        ? d.ActualQtyRack
        : d.ActualQty
      : before;
    if (counted === null || !Number.isSafeInteger(counted) || counted < 0)
      throw new ConflictException(
        'Complete every counted quantity before approval.',
      );
    const line = groups.get(code) ?? {
      itemCode: code,
      before: 0,
      counted: 0,
      parts: [],
    };
    line.before += before;
    line.counted += counted;
    if (!line.parts.includes(part)) line.parts.push(part);
    groups.set(code, line);
  }
  return [...groups.values()].sort((a, b) =>
    a.itemCode.localeCompare(b.itemCode),
  );
}

export async function captureCountingStart(
  tx: Prisma.TransactionClient,
  id: string,
  actor: string,
) {
  if (!sapCaptureEnabled()) return;
  const count = await tx.stockOpname.findUniqueOrThrow({
    where: { Id: id },
    include: { Details: true },
  });
  const scope = sapScope();
  if (
    await tx.outboxEvent.findFirst({
      where: {
        ReferenceType: 'STO_HOLD',
        SapTransaction: { Company: scope.company, Warehouse: scope.warehouse },
      },
    })
  )
    throw new ConflictException(
      'Finish or recover the previous SAP inventory counting before starting another.',
    );
  const allowed = new Set(
    (
      process.env[
        count.Category === 'MATERIAL'
          ? 'SAP_TRANSACTION_MATERIAL_ALLOWLIST'
          : 'SAP_TRANSACTION_ITEM_ALLOWLIST'
      ] ?? ''
    )
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  );
  const masters =
    count.Category === 'MATERIAL'
      ? (
          await tx.material.findMany({
            select: {
              PartNumber: true,
              PartNumberSAP: true,
              QtyWarehouse: true,
              QtyRack: true,
            },
          })
        ).map((m) => ({
          part: m.PartNumber,
          code: m.PartNumberSAP?.trim() || m.PartNumber,
          locations: [
            { name: 'WAREHOUSE', qty: m.QtyWarehouse },
            { name: 'RACK', qty: m.QtyRack },
          ],
        }))
      : (
          await tx.finishGood.findMany({
            select: { PartNumber: true, PartNumberSAP: true, Qty: true },
          })
        ).map((m) => ({
          part: m.PartNumber,
          code: m.PartNumberSAP?.trim() || m.PartNumber,
          locations: [{ name: 'FINISH_GOOD_AREA', qty: m.Qty }],
        }));
  const codes = new Set(
    masters
      .filter(
        (m) =>
          allowed.has(m.code) &&
          count.Details.some(
            (d) => (d.MaterialId ?? d.FinishGoodId) === m.part,
          ),
      )
      .map((m) => m.code),
  );
  if (!codes.size) return;
  const mapping = new Map(
    masters.filter((m) => codes.has(m.code)).map((m) => [m.part, m.code]),
  );
  for (const m of masters.filter((m) => codes.has(m.code))) {
    for (const loc of m.locations) {
      const d = count.Details.find(
        (d) =>
          (d.MaterialId ?? d.FinishGoodId) === m.part &&
          d.Location === loc.name,
      );
      if (!d && loc.qty !== 0)
        throw new ConflictException(
          'Count every Warehouse/Rack location and alias of the selected SAP items.',
        );
      const balance = await tx.inventoryLedger.aggregate({
        where: {
          ItemCategory: count.Category,
          ...(count.Category === 'MATERIAL'
            ? { MaterialId: m.part }
            : { FinishGoodId: m.part }),
          Location: loc.name as 'WAREHOUSE' | 'RACK' | 'FINISH_GOOD_AREA',
        },
        _sum: { QtyIn: true, QtyOut: true },
      });
      if ((balance._sum.QtyIn ?? 0) - (balance._sum.QtyOut ?? 0) !== loc.qty)
        throw new ConflictException(
          'Reconcile MES ledger and stock cache before counting.',
        );
    }
  }
  const transactions = await tx.sapTransaction.findMany({
    where: { Company: scope.company, Warehouse: scope.warehouse },
    include: { Event: true },
  });
  if (
    transactions.some(
      (t) =>
        !countingKinds.includes(t.Kind) &&
        t.Event.Status !== 'SUCCEEDED' &&
        (codes.has(t.ItemCode) ||
          (t.Effects as { itemCode: string }[]).some((e) =>
            codes.has(e.itemCode),
          )),
    )
  )
    throw new ConflictException(
      'Finish pending SAP transactions before starting inventory counting.',
    );
  const bridge = new Map<string, number>();
  for (const pick of await tx.sapBackflushPick.findMany({
    where: {
      Company: scope.company,
      Warehouse: scope.warehouse,
      ItemCode: { in: [...codes] },
    },
  }))
    bridge.set(pick.ItemCode, (bridge.get(pick.ItemCode) ?? 0) + pick.Quantity);
  for (const t of transactions.filter((t) => t.Kind === 'PRODUCTION_RECEIPT'))
    for (const e of t.Effects as { itemCode: string; quantity: number }[])
      if (e.quantity < 0)
        bridge.set(e.itemCode, (bridge.get(e.itemCode) ?? 0) + e.quantity);
  if ([...codes].some((c) => (bridge.get(c) ?? 0) !== 0))
    throw new ConflictException(
      'Finish production backflush before inventory counting.',
    );
  const lines = aggregateCounting(count.Details, mapping, false),
    now = count.StartedAt ?? new Date();
  const row = await captureSapIntent(
    tx,
    {
      sourceKey: `sto:${id}:start`,
      kind: 'INVENTORY_COUNTING',
      itemCode: lines[0].itemCode,
      quantity: lines.length,
      snapshot: {
        valuationPolicy: 'CUSTOMER_OWNED_ZERO',
        countingId: id,
        reference: count.RecordNumber,
        category: count.Category,
        date: sapPostingDate(now),
        time: new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
        }).format(now),
        lines,
      },
      effects: [],
    },
    actor,
  );
  await tx.outboxEvent.update({
    where: { Id: row.Id },
    data: { ReferenceType: 'STO_HOLD', ReferenceId: id },
  });
}

export async function captureCountingFinish(
  tx: Prisma.TransactionClient,
  id: string,
  actor: string,
  cancelled = false,
) {
  // Existing holds must finish even when capture is subsequently disabled.
  const root = await tx.sapTransaction.findUnique({
    where: { SourceKey: `sto:${id}:start` },
    include: { Event: true },
  });
  if (!root) return;
  const snapshot = countingSnapshot(root);
  const frozenDimensions = {
    projectCode: snapshot.projectCode ?? null,
    costCenter: snapshot.costCenter ?? null,
  };
  if (
    cancelled &&
    !root.PostedAt &&
    ['PENDING', 'QUEUED', 'FAILED'].includes(root.Event.Status) &&
    ![UNCERTAIN, SENDING].includes(root.Event.LastErrorCode ?? '')
  ) {
    // A CAS against the worker's sending claim proves this event cannot start posting afterwards.
    const safe =
      !root.SubmittedRequest ||
      ['SAP_BLOCKED', SAFE_RETRY].includes(root.Event.LastErrorCode ?? '');
    if (safe) {
      const changed = await tx.outboxEvent.updateMany({
        where: {
          Id: root.Id,
          Status: root.Event.Status,
          UpdatedAt: root.Event.UpdatedAt,
          LastErrorCode: root.Event.LastErrorCode,
        },
        data: {
          Status: 'FAILED',
          LastErrorCode: 'SAP_COUNTING_CANCELLED',
          LastError: 'Cancelled before SAP counting was created.',
          ReferenceType: 'STOCK_OPNAME',
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'SAP worker changed the counting state. Refresh before cancelling.',
        );
      await sapAudit(tx, actor, 'STO_CANCELLED_BEFORE_SEND', root.Id);
      return;
    }
  }
  if (!cancelled && (!root.PostedAt || root.Event.Status !== 'SUCCEEDED'))
    throw new ConflictException(
      'Wait for verified SAP counting/freeze before approving this STO.',
    );
  let dependencyId = root.Id;
  let lines = snapshot.lines;
  if (!cancelled) {
    const count = await tx.stockOpname.findUniqueOrThrow({
      where: { Id: id },
      include: { Details: true },
    });
    for (const detail of count.Details.filter((d) =>
      snapshot.lines.some((l) =>
        l.parts.includes(d.MaterialId ?? d.FinishGoodId ?? ''),
      ),
    )) {
      const master = detail.MaterialId
        ? await tx.material.findUnique({
            where: { PartNumber: detail.MaterialId },
          })
        : await tx.finishGood.findUnique({
            where: { PartNumber: detail.FinishGoodId! },
          });
      const before =
        detail.Location === 'RACK' ? detail.SystemQtyRack : detail.SystemQty;
      const current =
        master &&
        ('QtyRack' in master
          ? detail.Location === 'RACK'
            ? master.QtyRack
            : master.QtyWarehouse
          : master.Qty);
      const balance = await tx.inventoryLedger.aggregate({
        where: {
          ItemCategory: count.Category,
          MaterialId: detail.MaterialId,
          FinishGoodId: detail.FinishGoodId,
          Location: detail.Location,
        },
        _sum: { QtyIn: true, QtyOut: true },
      });
      if (
        current !== before ||
        (balance._sum.QtyIn ?? 0) - (balance._sum.QtyOut ?? 0) !== before
      )
        throw new ConflictException(
          'MES stock changed after cutoff. Reconcile the movement before approving STO.',
        );
    }
    lines = aggregateCounting(
      count.Details,
      new Map(
        snapshot.lines.flatMap((l) =>
          l.parts.map((p) => [p, l.itemCode] as [string, string]),
        ),
      ),
      true,
    );
    if (
      JSON.stringify(lines.map((l) => [l.itemCode, l.before])) !==
      JSON.stringify(snapshot.lines.map((l) => [l.itemCode, l.before]))
    )
      throw new ConflictException('STO cutoff changed after SAP freeze.');
    const update = await captureSapIntent(
      tx,
      {
        frozenDimensions,
        sourceKey: `sto:${id}:counts`,
        kind: 'COUNTING_UPDATE',
        itemCode: root.ItemCode,
        quantity: lines.length,
        snapshot: { ...snapshot, lines, rootId: root.Id, dependencyId },
        effects: [],
      },
      actor,
    );
    dependencyId = update.Id;
    if (lines.some((l) => l.counted !== l.before)) {
      const posting = await captureSapIntent(
        tx,
        {
          frozenDimensions,
          sourceKey: `sto:${id}:post`,
          kind: 'INVENTORY_POSTING',
          itemCode: root.ItemCode,
          quantity: lines.length,
          snapshot: { ...snapshot, lines, rootId: root.Id, dependencyId },
          effects: lines
            .filter((l) => l.counted !== l.before)
            .map((l) => ({
              itemCode: l.itemCode,
              quantity: l.counted - l.before,
            })),
        },
        actor,
      );
      dependencyId = posting.Id;
    }
  }
  await captureSapIntent(
    tx,
    {
      frozenDimensions,
      sourceKey: `sto:${id}:close`,
      kind: 'COUNTING_CLOSE',
      itemCode: root.ItemCode,
      quantity: lines.length,
      snapshot: {
        ...snapshot,
        lines,
        rootId: root.Id,
        dependencyId,
        cancelled,
      },
      effects: [],
    },
    actor,
  );
}

export class CountingBlocked extends Error {}
// SAP Ref2 permits 11 characters. The immutable, unique MES STO number fits without its separator.
export function countingReference(reference: string): string {
  if (!/^AIC-\d{8}$/.test(reference))
    throw new CountingBlocked('Invalid STO number for SAP reference.');
  return reference.replace('-', '');
}
export async function prepareCounting(
  tx: Pick<Prisma.TransactionClient, 'sapTransaction'>,
  sap: SapItemSyncService,
  row: SapTransaction,
) {
  const s = countingSnapshot(row),
    marker = countingReference(s.reference);
  const dimensions = {
    ...(s.projectCode ? { ProjectCode: s.projectCode } : {}),
    ...(s.costCenter ? { CostingCode: s.costCenter } : {}),
  };
  let root: (SapTransaction & { Event: { Status: string } }) | null = null;
  if (s.rootId) {
    root = await tx.sapTransaction.findUnique({
      where: { Id: s.rootId },
      include: { Event: true },
    });
    const dependency = await tx.sapTransaction.findUnique({
      where: { Id: s.dependencyId },
      include: { Event: true },
    });
    if (
      !root?.PostedAt ||
      root.DocumentEntry === null ||
      root.Event.Status !== 'SUCCEEDED' ||
      !dependency?.PostedAt ||
      dependency.Event.Status !== 'SUCCEEDED'
    )
      throw new CountingBlocked(
        'Waiting for verified SAP inventory counting dependency.',
      );
  }
  if (row.Kind === 'COUNTING_CLOSE') {
    const doc = await sap.readResource(
      `InventoryCountings(${root!.DocumentEntry})`,
    );
    if (
      doc.Reference2 !== marker ||
      doc.Remarks !== `STO: ${s.reference}` ||
      doc.DocumentStatus !== 'cdsOpen'
    )
      throw new CountingBlocked(
        'SAP counting identity or status changed. Reconcile before closing.',
      );
    return {
      resource: `InventoryCountings(${root!.DocumentEntry})/Close`,
      method: 'POST' as const,
      body: {},
    };
  }
  const warehouse = await sap.readResource(
    `Warehouses('${encodeURIComponent(row.Warehouse.replace(/'/g, "''"))}')`,
  );
  if (warehouse.EnableBinLocations === 'tYES')
    throw new CountingBlocked(
      'SAP bin-managed warehouses require a reviewed bin mapping before STO.',
    );
  const expected =
    row.Kind === 'INVENTORY_POSTING'
      ? s.lines.filter((l) => l.counted !== l.before)
      : s.lines;
  if (
    row.Kind === 'INVENTORY_POSTING' &&
    expected.some((l) => l.counted > l.before)
  ) {
    const settings = await sap.readResource('CompanyService_GetAdminInfo');
    if (settings.AllowInBoundPostingWithZeroPrice !== 'tYES')
      throw new CountingBlocked(
        'Zero-price STO surplus is disabled in SAP. Enable Allow Inbound Posting with Zero Price in Document Settings for this company, then retry. Keep customer-owned material value at zero.',
      );
  }
  for (const l of s.lines) {
    const item = await sap.readResource(
      `Items('${encodeURIComponent(l.itemCode.replace(/'/g, "''"))}')`,
    );
    const wh = (
      item.ItemWarehouseInfoCollection as {
        WarehouseCode: string;
        InStock: number;
        StandardAveragePrice?: number;
      }[]
    ).find((w) => w.WarehouseCode === row.Warehouse);
    if (
      item.InventoryItem !== 'tYES' ||
      item.ManageBatchNumbers === 'tYES' ||
      item.ManageSerialNumbers === 'tYES' ||
      (!['PCS', 'PC', 'EA'].includes(
        String(item.InventoryUOM ?? '')
          .trim()
          .toUpperCase(),
      ) &&
        !(
          item.UoMGroupEntry === -1 &&
          item.InventoryUoMEntry === -1 &&
          !item.InventoryUOM
        ))
    )
      throw new CountingBlocked(
        'STO requires inventory items with reviewed piece units and no batch/serial management.',
      );
    if (wh?.InStock !== l.before)
      throw new CountingBlocked(
        'SAP stock differs from the frozen MES cutoff. Review external movements before posting STO.',
      );
    const inventoryCost =
      item.ManageStockByWarehouse === 'tYES'
        ? wh?.StandardAveragePrice
        : item.AvgStdPrice;
    if (row.Kind === 'INVENTORY_POSTING' && inventoryCost !== 0)
      throw new CountingBlocked(
        `Customer-owned STO requires zero inventory cost for ${l.itemCode}. Review the SAP valuation before posting; the FG service price must not be used as inventory cost.`,
      );
  }
  if (row.Kind === 'INVENTORY_COUNTING')
    return {
      resource: 'InventoryCountings',
      method: 'POST' as const,
      body: {
        CountDate: s.date,
        CountTime: s.time,
        Remarks: `STO: ${s.reference}`,
        Reference2: marker,
        CountingType: 'ctSingleCounter',
        InventoryCountingLines: s.lines.map((l) => ({
          ItemCode: l.itemCode,
          WarehouseCode: row.Warehouse,
          Freeze: 'tYES',
          Counted: 'tNO',
          ...dimensions,
        })),
      },
    };
  const doc = await sap.readResource(
    `InventoryCountings(${root!.DocumentEntry})`,
  );
  const current = doc.InventoryCountingLines as Record<string, unknown>[];
  if (
    doc.Reference2 !== marker ||
    doc.Remarks !== `STO: ${s.reference}` ||
    doc.DocumentStatus !== 'cdsOpen' ||
    current?.length !== s.lines.length ||
    Number(doc.DocObjectCodeEx) !== 1470000065
  )
    throw new CountingBlocked(
      'SAP counting was changed or closed outside MES.',
    );
  for (const l of s.lines)
    if (
      !current.some(
        (c) =>
          c.ItemCode === l.itemCode &&
          c.WarehouseCode === row.Warehouse &&
          c.Freeze === 'tYES' &&
          c.InWarehouseQuantity === l.before,
      )
    )
      throw new CountingBlocked(
        'SAP counting freeze or cutoff differs from MES.',
      );
  if (row.Kind === 'COUNTING_UPDATE')
    return {
      resource: `InventoryCountings(${root!.DocumentEntry})`,
      method: 'PATCH' as const,
      body: {
        InventoryCountingLines: s.lines.map((l) => ({
          LineNumber: current.find((c) => c.ItemCode === l.itemCode)!
            .LineNumber,
          ItemCode: l.itemCode,
          WarehouseCode: row.Warehouse,
          Counted: 'tYES',
          CountedQuantity: l.counted,
          Freeze: 'tYES',
        })),
      },
    };
  if (
    !s.lines.every((l) =>
      current.some(
        (c) =>
          c.ItemCode === l.itemCode &&
          c.Counted === 'tYES' &&
          c.CountedQuantity === l.counted,
      ),
    )
  )
    throw new CountingBlocked('Approved counting quantities differ from SAP.');
  return {
    resource: 'InventoryPostings',
    method: 'POST' as const,
    body: {
      PostingDate: sapPostingDate(new Date()),
      PriceSource: 'ippsItemCost',
      CountDate: s.date,
      CountTime: s.time,
      Remarks: `STO: ${s.reference}`,
      Reference2: marker,
      InventoryPostingLines: expected.map((l) => ({
        BaseEntry: root!.DocumentEntry,
        BaseLine: current.find((c) => c.ItemCode === l.itemCode)!.LineNumber,
        BaseType: 1470000065,
        ItemCode: l.itemCode,
        WarehouseCode: row.Warehouse,
        CountedQuantity: l.counted,
        Price: 0,
        ...dimensions,
      })),
    },
  };
}

export function matchesCounting(
  row: SapTransaction,
  doc: Record<string, unknown>,
  rootEntry?: number,
): boolean {
  const s = countingSnapshot(row);
  if (row.Kind === 'COUNTING_CLOSE')
    return (
      doc.DocumentStatus === 'cdsClosed' &&
      doc.Reference2 === countingReference(s.reference) &&
      doc.Remarks === `STO: ${s.reference}`
    );
  const posting = row.Kind === 'INVENTORY_POSTING';
  const lines = doc[
    posting ? 'InventoryPostingLines' : 'InventoryCountingLines'
  ] as Record<string, unknown>[];
  const expected = posting
    ? s.lines.filter((l) => l.before !== l.counted)
    : s.lines;
  return (
    (posting || doc.DocumentStatus === 'cdsOpen') &&
    doc.Reference2 === countingReference(s.reference) &&
    (doc.Remarks === `STO: ${s.reference}` ||
      (posting &&
        new RegExp(
          `^STO: ${s.reference} Based On Inventory Counting \\d+$`,
        ).test(String(doc.Remarks)))) &&
    Array.isArray(lines) &&
    lines.length === expected.length &&
    new Set(
      lines.map((l) => `${String(l.ItemCode)}:${String(l.WarehouseCode)}`),
    ).size === lines.length &&
    expected.every((l) =>
      lines.some(
        (c) =>
          c.ItemCode === l.itemCode &&
          c.WarehouseCode === row.Warehouse &&
          (posting
            ? c.BaseEntry === rootEntry &&
              c.BaseType === 1470000065 &&
              c.CountedQuantity === l.counted &&
              c.Variance === l.counted - l.before &&
              c.ActualPrice === 0 &&
              c.PostedValueLC === 0 &&
              c.PostedValueSC === 0
            : c.InWarehouseQuantity === l.before &&
              c.Freeze === 'tYES' &&
              (row.Kind === 'INVENTORY_COUNTING'
                ? c.Counted === 'tNO'
                : c.Counted === 'tYES' && c.CountedQuantity === l.counted)),
      ),
    )
  );
}
