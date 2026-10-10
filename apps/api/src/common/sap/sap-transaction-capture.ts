/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { sapRuntimeSettings } from './sap-runtime-settings';
import { sapPostingDate } from './sap-posting-date';

export type SapEffect = { itemCode: string; quantity: number };
export type SapIncomingLine = {
  ledgerId: string;
  partNumber: string;
  itemCode: string;
  quantity: number;
};

/** One immutable receipt intent per Incoming; all inventory rows stay in the caller's transaction. */
export async function captureSapIncomingReceipt(
  tx: Prisma.TransactionClient,
  incoming: { id: string; poNumber: string; date: Date },
  lines: SapIncomingLine[],
  actor: string,
) {
  if (!sapCaptureEnabled() || !lines.length) return;
  const allowlist = (process.env.SAP_TRANSACTION_MATERIAL_ALLOWLIST ?? '')
    .split(',')
    .map((value) => value.trim());
  if (!lines.some((line) => allowlist.includes(line.itemCode))) return;
  return captureSapIntent(
    tx,
    {
      sourceKey: `incoming:${incoming.id}`,
      kind: 'GOODS_RECEIPT',
      ledgerId: lines[0].ledgerId,
      itemCode: lines[0].itemCode,
      quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
      snapshot: {
        incomingId: incoming.id,
        reference: incoming.poNumber,
        date: sapPostingDate(incoming.date),
        lines,
        disallowedItemCodes: [
          ...new Set(
            lines
              .filter((line) => !allowlist.includes(line.itemCode))
              .map((line) => line.itemCode),
          ),
        ],
      },
      effects: lines.map((line) => ({
        itemCode: line.itemCode,
        quantity: line.quantity,
      })),
    },
    actor,
  );
}
export type SapIntent = {
  sourceKey: string;
  kind: string;
  itemCode: string;
  quantity: number;
  demandId?: string;
  ledgerId?: string;
  snapshot: Prisma.InputJsonObject;
  effects: SapEffect[];
  frozenDimensions?: { projectCode: string | null; costCenter: string | null };
};
export function sapCaptureEnabled(): boolean {
  return process.env.SAP_TRANSACTION_CAPTURE_ENABLED === 'true';
}
export function sapScope() {
  return {
    company: process.env.SAP_COMPANY_DB ?? '',
    warehouse: process.env.SAP_TRANSACTION_WAREHOUSE ?? 'DMY-ANS',
  };
}
export function sapAllowed(code: string): boolean {
  return (process.env.SAP_TRANSACTION_ITEM_ALLOWLIST ?? '5715B132-KD')
    .split(',')
    .map((x) => x.trim())
    .includes(code);
}
export async function sapAudit(
  tx: Prisma.TransactionClient,
  actor: string,
  action: string,
  sourceId: string,
) {
  const id = randomUUID();
  const now = new Date();
  await tx.logProcess.create({
    data: {
      ProcessId: id,
      FunctionId: 'SAP_CONNECTION',
      FunctionName: `SAP.${action}`,
      ProcessStatus: 'SUCCESS',
      ProcessStart: now,
      ProcessEnd: now,
      ProcessDate: now,
      CreatedAt: now,
      CreatedBy: actor,
      LogProcessDetails: {
        create: {
          MessageId: 'SAP_CONNECTION',
          Message: `${action}; reference ${sourceId}`,
          Type: 'INFO',
          Location: 'SapConnection',
          ProcessDate: now,
          CreatedAt: now,
        },
      },
    },
  });
  await tx.actionAuditEvent.create({
    data: {
      SourceType: 'SapConnection',
      SourceId: sourceId,
      Action: action,
      Actor: actor,
      ActorSource: actor.startsWith('SYSTEM:')
        ? 'SYSTEM_WORKER'
        : 'AUTHENTICATED_COMMAND',
      ProcessId: id,
    },
  });
}
export async function captureSapIntent(
  tx: Prisma.TransactionClient,
  input: SapIntent,
  actor: string,
) {
  const scope = sapScope();
  const previous = await tx.sapTransaction.findUnique({
    where: { SourceKey: input.sourceKey },
  });
  if (previous) return previous;
  const id = randomUUID();
  await tx.outboxEvent.create({
    data: {
      Id: id,
      IdempotencyKey: `sap:${input.sourceKey}`,
      Type: 'SAP_TRANSACTION',
      Payload: { transactionId: id },
      Actor: actor,
      ReferenceType: input.ledgerId ? 'InventoryLedger' : 'ProductionDemand',
      ReferenceId: input.ledgerId ?? input.demandId,
    },
  });
  const settings =
    input.frozenDimensions ?? (await sapRuntimeSettings(tx, scope.company));
  const row = await tx.sapTransaction.create({
    data: {
      Id: id,
      SourceKey: input.sourceKey,
      LedgerId: input.ledgerId,
      DemandId: input.demandId,
      Kind: input.kind,
      Company: scope.company,
      Warehouse: scope.warehouse,
      ItemCode: input.itemCode,
      Quantity: input.quantity,
      Snapshot: {
        ...input.snapshot,
        projectCode: settings.projectCode || null,
        costCenter: settings.costCenter || null,
      },
      Effects: input.effects,
    },
  });
  await sapAudit(tx, actor, 'CAPTURE', id);
  return row;
}
export async function captureSapDemand(
  tx: Prisma.TransactionClient,
  demandId: string,
  actor: string,
  close: boolean | 'cancel' | 'draft' = false,
) {
  if (!sapCaptureEnabled()) return;
  const order = await tx.productionOrder.findUniqueOrThrow({
    where: { PoId: demandId },
    include: { PartData: true, ProductionRelease: true },
  });
  const previous = await tx.sapTransaction.findFirst({
    where: { DemandId: demandId, Kind: 'PRODUCTION_ORDER' },
    orderBy: { CreatedAt: 'desc' },
  });
  const ending = close === true || close === 'cancel';
  if (ending && !previous) return;
  if (close === 'cancel' && previous) {
    const release = await tx.sapTransaction.findUnique({
      where: { SourceKey: `release:${previous.Id}` },
      include: { Event: true },
    });
    if (
      release &&
      ['PENDING', 'QUEUED', 'FAILED'].includes(release.Event.Status) &&
      !['OUTBOX_SENDING', 'OUTBOX_DELIVERY_UNCERTAIN'].includes(
        release.Event.LastErrorCode ?? '',
      )
    ) {
      const stopped = await tx.outboxEvent.updateMany({
        where: {
          Id: release.Id,
          Status: release.Event.Status,
          UpdatedAt: release.Event.UpdatedAt,
        },
        data: {
          Status: 'FAILED',
          LastErrorCode: 'SAP_CANCELLED_BEFORE_RELEASE',
          LastError:
            'MES production was cancelled before SAP release. Do not retry this release.',
        },
      });
      if (stopped.count)
        await sapAudit(tx, actor, 'CANCEL_PENDING_RELEASE', release.Id);
    }
  }
  const terminal = previous
    ? await tx.sapTransaction.findFirst({
        where: { SourceKey: 'cancel:' + previous.Id },
      })
    : null;
  if (close === 'draft' && previous && !terminal) return;
  const code =
    ending && previous
      ? previous.ItemCode
      : order.PartData.PartNumberSAP?.trim() || order.FinishGoodId;
  if (!sapAllowed(code)) return;
  const bom = await tx.productionBomSnapshot.findFirst({
    where: { ProductionDemandId: demandId },
    orderBy: { Version: 'desc' },
    include: { Lines: { include: { Material: true } } },
  });
  let components = (bom?.Lines ?? []).map((line) => ({
    partNumber: line.PartNumber,
    itemCode: line.Material.PartNumberSAP?.trim() || line.PartNumber,
    perUnit: line.QtyPerUnit,
    unit: line.UnitName ?? '',
  }));
  if (!bom && order.PartData.ActiveBomRevisionId) {
    const revision = await tx.bomRevision.findUnique({
      where: { Id: order.PartData.ActiveBomRevisionId },
      include: { Lines: { include: { Material: true } } },
    });
    components = (revision?.Lines ?? []).map((line) => ({
      partNumber: line.PartNumber,
      itemCode: line.Material.PartNumberSAP?.trim() || line.PartNumber,
      perUnit: line.Qty,
      unit: line.UnitName ?? '',
    }));
  }
  let salesOrderEventId: string | null = null;
  if (!close && process.env.SAP_AUTO_SALES_ORDER_ENABLED === 'true') {
    const binding = await tx.sapDemandMapping.findUnique({
      where: { DemandId: demandId },
    });
    if (!binding?.SalesOrderEntry) {
      const sales = await captureSapIntent(
        tx,
        {
          sourceKey: 'sales-order:' + demandId,
          kind: 'SALES_ORDER',
          itemCode: code,
          quantity: order.Qty,
          demandId,
          snapshot: {
            dueDate: order.DeliveryDate.toISOString().slice(0, 10),
            date: sapPostingDate(new Date()),
            poNumber: order.PoNumber,
            releaseNumber: order.ProductionRelease?.ReleaseNumber ?? null,
          },
          effects: [],
        },
        actor,
      );
      salesOrderEventId = sales.Id;
    }
  }
  if (!ending && previous && !terminal) {
    await captureSapIntent(
      tx,
      {
        sourceKey: `release:${previous.Id}`,
        kind: 'PRODUCTION_RELEASE',
        itemCode: code,
        quantity: order.Qty,
        demandId,
        snapshot: { orderEventId: previous.Id, salesOrderEventId, components },
        effects: [],
      },
      actor,
    );
    return;
  }
  const capturedOrder = await captureSapIntent(
    tx,
    {
      sourceKey: ending
        ? `${close === 'cancel' ? 'cancel' : 'close'}:${previous!.Id}`
        : `order:${demandId}:${randomUUID()}`,
      kind:
        close === 'cancel'
          ? 'PRODUCTION_CANCEL'
          : ending
            ? 'PRODUCTION_CLOSE'
            : 'PRODUCTION_ORDER',
      itemCode: code,
      quantity: order.Qty,
      demandId,
      snapshot: {
        components,
        orderEventId: ending ? previous!.Id : null,
        autoRelease: false,
        releaseNumber: order.ProductionRelease?.ReleaseNumber ?? null,
        salesOrderEventId,
        previousCancellationId: !ending ? (terminal?.Id ?? null) : null,
        bomId: bom?.Id ?? null,
        dueDate: order.DeliveryDate.toISOString().slice(0, 10),
      },
      effects: [],
    },
    actor,
  );
  if (!close)
    await captureSapIntent(
      tx,
      {
        sourceKey: `release:${capturedOrder.Id}`,
        kind: 'PRODUCTION_RELEASE',
        itemCode: code,
        quantity: order.Qty,
        demandId,
        snapshot: {
          orderEventId: capturedOrder.Id,
          salesOrderEventId,
          components,
        },
        effects: [],
      },
      actor,
    );
}
/** Called in the caller's inventory transaction; never contacts SAP or Redis. */
export async function createSapLedger(
  tx: Prisma.TransactionClient,
  args: Prisma.InventoryLedgerCreateArgs,
  demandId?: string,
) {
  const ledger = await tx.inventoryLedger.create(args);
  if (!sapCaptureEnabled()) return ledger;
  const scope = sapScope();
  const material = ledger.MaterialId
    ? await tx.material.findUnique({ where: { PartNumber: ledger.MaterialId } })
    : null;
  const fg = ledger.FinishGoodId
    ? await tx.finishGood.findUnique({
        where: { PartNumber: ledger.FinishGoodId },
      })
    : null;
  const frozenOrder = demandId
    ? await tx.sapTransaction.findFirst({
        where: { DemandId: demandId, Kind: 'PRODUCTION_ORDER' },
        orderBy: { CreatedAt: 'desc' },
      })
    : null;
  const frozenComponents = (
    frozenOrder?.Snapshot as
      { components?: { partNumber: string; itemCode: string }[] } | undefined
  )?.components;
  const frozenCode = material
    ? frozenComponents?.find((c) => c.partNumber === material.PartNumber)
        ?.itemCode
    : frozenOrder?.ItemCode;
  const code =
    frozenCode ||
    material?.PartNumberSAP?.trim() ||
    fg?.PartNumberSAP?.trim() ||
    ledger.MaterialId ||
    ledger.FinishGoodId ||
    '';
  // Material allowlist is explicit; FG allowlist alone must never include all materials.
  const materialAllowed = (process.env.SAP_TRANSACTION_MATERIAL_ALLOWLIST ?? '')
    .split(',')
    .map((x) => x.trim())
    .includes(code);
  if (
    material
      ? !materialAllowed && !frozenCode
      : !sapAllowed(code) && !frozenCode
  )
    return ledger;
  if (ledger.TransactionType === 'PRODUCTION_USAGE' && demandId) {
    await tx.sapBackflushPick.create({
      data: {
        LedgerId: ledger.Id,
        Company: scope.company,
        Warehouse: scope.warehouse,
        ItemCode: code,
        DemandId: demandId,
        Quantity: ledger.QtyOut,
      },
    });
    await sapAudit(tx, ledger.CreatedBy, 'BACKFLUSH_PICK', ledger.Id);
    return ledger;
  }
  const kind =
    ledger.TransactionType === 'INCOMING_SUPPLIER'
      ? 'GOODS_RECEIPT'
      : ledger.TransactionType === 'PRODUCTION_RESULT'
        ? 'PRODUCTION_RECEIPT'
        : ledger.TransactionType === 'DELIVERY_TO_CUSTOMER'
          ? 'DELIVERY'
          : ledger.TransactionType === 'CUSTOMER_RETURN'
            ? 'RETURN'
            : ledger.TransactionType === 'NG_SCRAP' ||
                ledger.TransactionType === 'PRODUCTION_USAGE'
              ? 'GOODS_ISSUE'
              : 'UNSUPPORTED_MOVEMENT';
  const effects: SapEffect[] = [
    { itemCode: code, quantity: ledger.QtyIn - ledger.QtyOut },
  ];
  let components: Prisma.JsonValue = [];
  if (kind === 'PRODUCTION_RECEIPT' && demandId) {
    const order = frozenOrder;
    const snapshot = order?.Snapshot as
      { components?: { itemCode: string; perUnit: number }[] } | undefined;
    components = snapshot?.components ?? [];
    for (const line of snapshot?.components ?? [])
      effects.push({
        itemCode: line.itemCode,
        quantity: -line.perUnit * ledger.QtyIn,
      });
  }
  let deliveryId: number | null = ledger.ReferenceDoc.startsWith('DELIVERY-')
    ? Number(ledger.ReferenceDoc.slice(9))
    : null;
  let dependencyId: string | null = null;
  if (
    ledger.ReferenceDoc.startsWith('CUSTOMER_RETURN:') ||
    ledger.ReferenceDoc.startsWith('RETURN_SCRAP:')
  ) {
    const returned = await tx.customerReturn.findUniqueOrThrow({
      where: { Id: ledger.ReferenceDoc.split(':')[1] },
    });
    deliveryId = returned.DeliveryId;
    const parent = await tx.inventoryLedger.findFirst({
      where: {
        ReferenceDoc:
          kind === 'RETURN'
            ? `DELIVERY-${deliveryId}`
            : { startsWith: `CUSTOMER_RETURN:${returned.Id}:` },
      },
    });
    const posting = parent
      ? await tx.sapTransaction.findUnique({ where: { LedgerId: parent.Id } })
      : null;
    dependencyId = posting?.Id ?? null;
  }
  await captureSapIntent(
    tx,
    {
      sourceKey: `ledger:${ledger.Id}`,
      ledgerId: ledger.Id,
      kind,
      itemCode: code,
      quantity: ledger.QtyIn || ledger.QtyOut,
      demandId,
      snapshot: {
        components,
        itemCategory: ledger.ItemCategory,
        deliveryId,
        dependencyId,
        orderEventId: frozenOrder?.Id ?? null,
        date: sapPostingDate(ledger.TransactionDate),
        reference: ledger.ReferenceDoc,
      },
      effects,
    },
    ledger.CreatedBy,
  );
  return ledger;
}
