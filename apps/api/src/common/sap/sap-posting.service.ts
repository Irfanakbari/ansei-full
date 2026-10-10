/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  incomingLines,
  matchesIncomingDocument,
} from './sap-incoming-document';
import type {
  OutboxEvent,
  SapTransaction,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { auditedTransaction } from '../helpers/audited-transaction.helper';
import {
  OutboxStateService,
  SAFE_RETRY,
  SENDING,
  UNCERTAIN,
} from '../outbox/outbox-state.service';
import { SapItemSyncService, SapPostingError } from './sap-item-sync.service';
import { sapAudit } from './sap-transaction-capture';
import { sapRuntimeSettings } from './sap-runtime-settings';
import {
  countingKinds,
  countingSnapshot,
  prepareCounting,
  matchesCounting,
  CountingBlocked,
} from './sap-counting';

export class SapBlocked extends Error {}
export const sapEscape = (value: string) => value.replace(/'/g, "''");
export function sapResource(kind: string): string {
  if (countingKinds.includes(kind))
    return kind === 'INVENTORY_POSTING'
      ? 'InventoryPostings'
      : 'InventoryCountings';
  if (
    [
      'PRODUCTION_ORDER',
      'PRODUCTION_RELEASE',
      'PRODUCTION_CLOSE',
      'PRODUCTION_CANCEL',
    ].includes(kind)
  )
    return 'ProductionOrders';
  if (kind === 'GOODS_RECEIPT' || kind === 'PRODUCTION_RECEIPT')
    return 'InventoryGenEntries';
  if (kind === 'SALES_ORDER') return 'Orders';
  if (kind === 'GOODS_ISSUE') return 'InventoryGenExits';
  if (kind === 'DELIVERY') return 'DeliveryNotes';
  if (kind === 'RETURN') return 'Returns';
  throw new SapBlocked(
    'Unsupported movement requires reviewed integration mapping.',
  );
}
type Components = { itemCode: string; perUnit: number; unit?: string }[];
export function sapComponents(value: unknown): Components {
  if (!Array.isArray(value) || !value.length)
    throw new SapBlocked('Frozen BOM components are missing.');
  const components = value.map((line) => {
    const row = line as Record<string, unknown>;
    if (
      typeof row.itemCode !== 'string' ||
      typeof row.perUnit !== 'number' ||
      !Number.isInteger(row.perUnit) ||
      row.perUnit <= 0
    )
      throw new SapBlocked('Invalid frozen BOM quantity or item.');
    if (
      typeof row.unit === 'string' &&
      row.unit.trim() &&
      !['PCS', 'PC', 'EA'].includes(row.unit.trim().toUpperCase())
    )
      throw new SapBlocked('Frozen MES unit needs an explicit conversion.');
    return {
      itemCode: row.itemCode,
      perUnit: row.perUnit,
      unit: typeof row.unit === 'string' ? row.unit : '',
    };
  });
  const grouped = new Map<string, Components[number]>();
  for (const component of components) {
    const previous = grouped.get(component.itemCode);
    grouped.set(component.itemCode, {
      ...component,
      perUnit: component.perUnit + (previous?.perUnit ?? 0),
    });
  }
  return [...grouped.values()];
}
@Injectable()
export class SapPostingService {
  private lastHeartbeat = 0;
  async postingEnabled() {
    return (
      await sapRuntimeSettings(
        this.prisma,
        this.config.get<string>('SAP_COMPANY_DB') ?? '',
      )
    ).enabled;
  }
  constructor(
    private readonly prisma: PrismaService,
    private readonly sap: SapItemSyncService,
    private readonly state: OutboxStateService,
    private readonly config: ConfigService,
  ) {}
  async heartbeat() {
    if (Date.now() - this.lastHeartbeat < 60000) return;
    const company = this.config.get<string>('SAP_COMPANY_DB');
    if (!company) return;
    await auditedTransaction(this.prisma, async (tx) => {
      await tx.sapConnectionState.upsert({
        where: { Company: company },
        create: { Company: company, WorkerAt: new Date() },
        update: { WorkerAt: new Date() },
      });
      await sapAudit(tx, 'SYSTEM:OUTBOX', 'WORKER_HEARTBEAT', company);
    });
    this.lastHeartbeat = Date.now();
  }

  async validateItem(code: string, warehouse: string) {
    const item = await this.sap.readResource(
      `Items('${encodeURIComponent(sapEscape(code))}')`,
    );
    if (
      item.InventoryItem !== 'tYES' ||
      item.ManageBatchNumbers === 'tYES' ||
      item.ManageSerialNumbers === 'tYES'
    )
      throw new SapBlocked(
        'Item must be an inventory item without batch/serial management for this pilot.',
      );
    const unit = String(item.InventoryUOM ?? '')
      .trim()
      .toUpperCase();
    if (unit && !['PCS', 'PC', 'EA'].includes(unit))
      throw new SapBlocked(
        'Inventory unit needs an explicit conversion before posting.',
      );
    const warehouses = item.ItemWarehouseInfoCollection as
      { WarehouseCode: string }[] | undefined;
    if (!warehouses?.some((row) => row.WarehouseCode === warehouse))
      throw new SapBlocked('Item is not assigned to the configured warehouse.');
    return item;
  }
  async order(row: SapTransaction) {
    const order = row.DemandId
      ? await this.prisma.sapTransaction.findUnique({
          where: {
            Id: String(
              (row.Snapshot as Record<string, unknown>).orderEventId ?? '',
            ),
          },
          include: { Event: true },
        })
      : null;
    if (
      !order ||
      order.Event.Status !== 'SUCCEEDED' ||
      order.DocumentEntry === null ||
      !order.PostedAt
    )
      throw new SapBlocked('Waiting for a verified SAP production order.');
    return order;
  }
  async prepare(row: SapTransaction): Promise<{
    resource: string;
    body: Record<string, unknown>;
    method: 'POST' | 'PATCH';
  }> {
    if (
      row.Company !== this.config.get('SAP_COMPANY_DB') ||
      row.Warehouse !==
        (this.config.get('SAP_TRANSACTION_WAREHOUSE') ?? 'DMY-ANS')
    )
      throw new SapBlocked(
        'Captured SAP company or warehouse differs from runtime configuration.',
      );
    if (!Number.isSafeInteger(row.Quantity) || row.Quantity <= 0)
      throw new SapBlocked('Quantity must be a positive integer.');
    const resource = sapResource(row.Kind);
    const snapshot = row.Snapshot as Record<string, unknown>;
    const projectCode =
      typeof snapshot.projectCode === 'string'
        ? snapshot.projectCode
        : undefined;
    const costCenter =
      typeof snapshot.costCenter === 'string' ? snapshot.costCenter : undefined;
    const documentDimensions = {
      ...(projectCode ? { ProjectCode: projectCode } : {}),
      ...(costCenter ? { CostingCode: costCenter } : {}),
    };
    const productionDimensions = {
      ...(projectCode ? { Project: projectCode } : {}),
      ...(costCenter ? { DistributionRule: costCenter } : {}),
    };
    const reference = `ANSEI:${row.Id}`;
    if (row.Kind === 'GOODS_RECEIPT' && snapshot.lines !== undefined) {
      let lines: ReturnType<typeof incomingLines>;
      try {
        lines = incomingLines(row);
      } catch (error) {
        throw new SapBlocked(
          error instanceof Error ? error.message : 'Invalid incoming receipt.',
        );
      }
      if (!lines?.length)
        throw new SapBlocked('Incoming receipt lines are missing.');
      if (
        !Array.isArray(snapshot.disallowedItemCodes) ||
        snapshot.disallowedItemCodes.length
      ) {
        throw new SapBlocked(
          'All incoming materials must be included in the SAP trial allowlist. No partial receipt was sent.',
        );
      }
      const poNumber =
        typeof snapshot.reference === 'string' ? snapshot.reference.trim() : '';
      if (!poNumber) throw new SapBlocked('Incoming PO number is missing.');
      for (const code of new Set(lines.map((line) => line.itemCode))) {
        const receiptItem = await this.validateItem(code, row.Warehouse);
        if (Number(receiptItem.AvgStdPrice ?? 0) !== 0)
          throw new SapBlocked(
            'Customer-owned receipt requires reviewed zero-cost valuation.',
          );
      }
      return {
        resource,
        method: 'POST',
        body: {
          DocDate: snapshot.date,
          Comments: `PO: ${poNumber}`,
          JournalMemo: reference,
          DocumentLines: lines.map((line) => ({
            ItemCode: line.itemCode,
            Quantity: line.quantity,
            WarehouseCode: row.Warehouse,
            UseBaseUnits: 'tYES',
            UnitPrice: 0,
            ...documentDimensions,
          })),
        },
      };
    }
    if (countingKinds.includes(row.Kind)) {
      try {
        return await prepareCounting(this.prisma, this.sap, row);
      } catch (error) {
        if (error instanceof CountingBlocked)
          throw new SapBlocked(error.message);
        throw error;
      }
    }
    const item = await this.validateItem(row.ItemCode, row.Warehouse);
    if (row.Kind === 'SALES_ORDER') {
      if (this.config.get('SAP_AUTO_SALES_ORDER_ENABLED') !== 'true')
        throw new SapBlocked('Automatic Sales Orders are disabled.');
      const mapping = row.DemandId
        ? await this.prisma.sapDemandMapping.findUnique({
            where: { DemandId: row.DemandId },
          })
        : null;
      if (
        !mapping?.AutoCreate ||
        mapping.Company !== row.Company ||
        mapping.ItemCode !== row.ItemCode
      )
        throw new SapBlocked(
          'Map an active SAP customer for automatic Sales Order creation.',
        );
      if (mapping.SalesOrderEntry !== null)
        throw new SapBlocked(
          'A Sales Order is already linked; review before posting.',
        );
      const customer = await this.sap.readResource(
        "BusinessPartners('" +
          encodeURIComponent(sapEscape(mapping.CardCode)) +
          "')",
      );
      if (
        customer.CardType !== 'cCustomer' ||
        customer.Valid !== 'tYES' ||
        customer.Frozen === 'tYES' ||
        item.SalesItem !== 'tYES'
      )
        throw new SapBlocked('The SAP customer or sales item is inactive.');
      const prices = item.ItemPrices as
        { PriceList: number; Price: number }[] | undefined;
      if (
        !prices?.some(
          (price) =>
            price.PriceList === customer.PriceListNum &&
            Number(price.Price) > 0,
        )
      )
        throw new SapBlocked(
          'The customer price list has no positive item price. Review pricing in SAP before creating the Sales Order.',
        );
      return {
        resource,
        method: 'POST',
        body: {
          CardCode: mapping.CardCode,
          NumAtCard: snapshot.poNumber,
          DocDate: snapshot.date,
          DocDueDate: snapshot.dueDate,
          Comments: [
            snapshot.releaseNumber,
            snapshot.poNumber
              ? `PO: ${String(snapshot.poNumber)}`
              : `Demand: ${row.DemandId}`,
          ]
            .filter(Boolean)
            .join(' | '),
          JournalMemo: reference,
          DocumentLines: [
            {
              ItemCode: row.ItemCode,
              Quantity: row.Quantity,
              WarehouseCode: row.Warehouse,
              UseBaseUnits: 'tYES',
              ...documentDimensions,
            },
          ],
        },
      };
    }
    if (row.Kind === 'PRODUCTION_ORDER') {
      if (typeof snapshot.salesOrderEventId === 'string') {
        const sales = await this.prisma.sapTransaction.findUnique({
          where: { Id: snapshot.salesOrderEventId },
          include: { Event: true },
        });
        if (!sales?.PostedAt || sales.Event.Status !== 'SUCCEEDED')
          throw new SapBlocked('Waiting for a verified SAP Sales Order.');
      }
      if (typeof snapshot.previousCancellationId === 'string') {
        const cancellation = await this.prisma.sapTransaction.findUnique({
          where: { Id: snapshot.previousCancellationId },
          include: { Event: true },
        });
        if (
          !cancellation?.PostedAt ||
          cancellation.Event.Status !== 'SUCCEEDED'
        )
          throw new SapBlocked(
            'Waiting for the previous SAP production order cancellation.',
          );
      }
      const components = sapComponents(snapshot.components);
      const tree = await this.sap.getProductTree(row.ItemCode);
      const lines = tree?.ProductTreeLines as
        | {
            ItemCode: string;
            Quantity: number;
            IssueMethod: string;
            ItemType: string;
          }[]
        | undefined;
      if (!lines || !Number(tree?.Quantity))
        throw new SapBlocked('SAP BOM is missing.');
      const expected = new Map<string, number>();
      for (const line of components)
        expected.set(
          line.itemCode,
          (expected.get(line.itemCode) ?? 0) + line.perUnit,
        );
      const actual = new Map<string, number>();
      for (const line of lines) {
        if (line.ItemType !== 'pit_Item' || line.IssueMethod !== 'im_Backflush')
          throw new SapBlocked(
            'All pilot BOM lines must be backflush inventory components.',
          );
        actual.set(
          line.ItemCode,
          (actual.get(line.ItemCode) ?? 0) +
            line.Quantity / Number(tree!.Quantity),
        );
      }
      if (
        expected.size !== actual.size ||
        [...expected].some(([code, qty]) => actual.get(code) !== qty)
      )
        throw new SapBlocked('SAP BOM differs from the frozen MES BOM.');
      for (const code of expected.keys())
        await this.validateItem(code, row.Warehouse);
      return {
        resource,
        method: 'POST',
        body: {
          ItemNo: row.ItemCode,
          PlannedQuantity: row.Quantity,
          DueDate: snapshot.dueDate,
          Warehouse: row.Warehouse,
          Remarks:
            typeof snapshot.releaseNumber === 'string' &&
            snapshot.releaseNumber.trim()
              ? snapshot.releaseNumber.trim()
              : reference,
          JournalRemarks: reference,
          ProductionOrderStatus: 'boposPlanned',
          ...productionDimensions,
          ProductionOrderLines: [...expected].map(([ItemNo, BaseQuantity]) => ({
            ItemNo,
            BaseQuantity,
            PlannedQuantity: BaseQuantity * row.Quantity,
            ProductionOrderIssueType: 'im_Backflush',
            Warehouse: row.Warehouse,
            ...productionDimensions,
          })),
        },
      };
    }
    if (row.Kind === 'PRODUCTION_RELEASE') {
      const order = await this.order(row);
      if (typeof snapshot.salesOrderEventId === 'string') {
        const sales = await this.prisma.sapTransaction.findUnique({
          where: { Id: snapshot.salesOrderEventId },
          include: { Event: true },
        });
        if (!sales?.PostedAt || sales.Event.Status !== 'SUCCEEDED')
          throw new SapBlocked('Waiting for a verified SAP Sales Order.');
      }
      const live = await this.sap.readResource(
        `ProductionOrders(${order.DocumentEntry})`,
      );
      const expectedComponents = sapComponents(snapshot.components);
      const plannedComponents = sapComponents(
        (order.Snapshot as Record<string, unknown>).components,
      );
      if (
        JSON.stringify(
          [...expectedComponents].sort((a, b) =>
            a.itemCode.localeCompare(b.itemCode),
          ),
        ) !==
        JSON.stringify(
          [...plannedComponents].sort((a, b) =>
            a.itemCode.localeCompare(b.itemCode),
          ),
        )
      )
        throw new SapBlocked(
          'Planned SAP BOM differs from released MES BOM. Review planning changes.',
        );
      if (
        live.ItemNo !== row.ItemCode ||
        live.PlannedQuantity !== row.Quantity ||
        live.Warehouse !== row.Warehouse
      )
        throw new SapBlocked(
          'Planned SAP order differs from the released MES demand. Review planning changes.',
        );
      if (
        !['boposPlanned', 'boposReleased'].includes(
          String(live.ProductionOrderStatus),
        )
      )
        throw new SapBlocked('SAP production order cannot be released.');
      return {
        resource: `ProductionOrders(${order.DocumentEntry})`,
        method: 'PATCH',
        body: { ProductionOrderStatus: 'boposReleased' },
      };
    }
    if (['PRODUCTION_CLOSE', 'PRODUCTION_CANCEL'].includes(row.Kind)) {
      const order = await this.order(row);
      const pending = await this.prisma.sapTransaction.count({
        where: {
          DemandId: row.DemandId,
          Id: { not: row.Id },
          Kind: { not: 'PRODUCTION_ORDER' },
          Snapshot: { path: ['orderEventId'], equals: order.Id },
          Event: { Status: { not: 'SUCCEEDED' } },
          NOT: { Event: { LastErrorCode: 'SAP_CANCELLED_BEFORE_RELEASE' } },
        },
      });
      if (pending)
        throw new SapBlocked(
          'Other production transactions are not yet verified.',
        );
      if (row.Kind === 'PRODUCTION_CLOSE') {
        const [picks, receipts] = await Promise.all([
          this.prisma.sapBackflushPick.findMany({
            where: {
              DemandId: row.DemandId!,
              Company: row.Company,
              Warehouse: row.Warehouse,
            },
          }),
          this.prisma.sapTransaction.findMany({
            where: { DemandId: row.DemandId, Kind: 'PRODUCTION_RECEIPT' },
          }),
        ]);
        const balance = new Map<string, number>();
        for (const pick of picks)
          balance.set(
            pick.ItemCode,
            (balance.get(pick.ItemCode) ?? 0) + pick.Quantity,
          );
        for (const receipt of receipts)
          for (const effect of receipt.Effects as {
            itemCode: string;
            quantity: number;
          }[])
            if (effect.quantity < 0)
              balance.set(
                effect.itemCode,
                (balance.get(effect.itemCode) ?? 0) + effect.quantity,
              );
        if ([...balance.values()].some((quantity) => quantity !== 0))
          throw new SapBlocked(
            'Backflush quantities do not reconcile. Review production consumption before closing.',
          );
        const live = await this.sap.readResource(
          'ProductionOrders(' + order.DocumentEntry + ')',
        );
        if (
          Number(live.CompletedQuantity) !==
          receipts.reduce((total, receipt) => total + receipt.Quantity, 0)
        )
          throw new SapBlocked(
            'SAP completed quantity differs from verified MES receipts.',
          );
      }
      return {
        resource: `${resource}(${order.DocumentEntry})`,
        method: 'PATCH',
        body: {
          ProductionOrderStatus:
            row.Kind === 'PRODUCTION_CANCEL' ? 'boposCancelled' : 'boposClosed',
        },
      };
    }
    const line: Record<string, unknown> = {
      ItemCode: row.ItemCode,
      Quantity: row.Quantity,
      WarehouseCode: row.Warehouse,
      UseBaseUnits: 'tYES',
      ...documentDimensions,
    };
    const body: Record<string, unknown> = {
      DocDate: snapshot.date,
      Comments: reference,
      DocumentLines: [line],
    };
    if (
      row.Kind === 'RETURN' ||
      String(snapshot.reference).startsWith('RETURN_SCRAP:')
    ) {
      const parent =
        typeof snapshot.dependencyId === 'string'
          ? await this.prisma.sapTransaction.findUnique({
              where: { Id: snapshot.dependencyId },
              include: { Event: true },
            })
          : null;
      if (
        !parent ||
        parent.Event.Status !== 'SUCCEEDED' ||
        parent.DocumentEntry === null
      )
        throw new SapBlocked(
          'Waiting for a verified original SAP delivery or return.',
        );
      if (row.Kind === 'RETURN') {
        const delivery = await this.sap.readResource(
          `DeliveryNotes(${parent.DocumentEntry})`,
        );
        if (typeof delivery.CardCode !== 'string')
          throw new SapBlocked(
            'Original SAP delivery customer is unavailable.',
          );
        body.CardCode = delivery.CardCode;
        line.BaseType = 15;
        line.BaseEntry = parent.DocumentEntry;
        line.BaseLine = 0;
      }
    }
    if (
      row.Kind === 'GOODS_ISSUE' &&
      snapshot.itemCategory === 'FINISH_GOOD' &&
      !String(snapshot.reference).startsWith('RETURN_SCRAP:')
    ) {
      const receipts = await this.prisma.sapTransaction.findMany({
        where: { DemandId: row.DemandId, Kind: 'PRODUCTION_RECEIPT' },
        include: { Event: true },
      });
      if (
        !receipts.length ||
        receipts.some(
          (receipt) =>
            !receipt.PostedAt || receipt.Event.Status !== 'SUCCEEDED',
        )
      )
        throw new SapBlocked('Waiting for verified FG receipts before scrap.');
    }
    if (row.Kind === 'GOODS_RECEIPT') {
      const poNumber =
        typeof snapshot.reference === 'string' ? snapshot.reference.trim() : '';
      if (!poNumber) throw new SapBlocked('Incoming PO number is missing.');
      body.Comments = `PO: ${poNumber}`;
      body.JournalMemo = reference;
      if (Number(item.AvgStdPrice ?? 0) !== 0)
        throw new SapBlocked(
          'Customer-owned receipt requires reviewed zero-cost valuation.',
        );
      line.UnitPrice = 0;
    }
    if (row.Kind === 'PRODUCTION_RECEIPT') {
      const order = await this.order(row);
      const live = await this.sap.readResource(
        `ProductionOrders(${order.DocumentEntry})`,
      );
      if (live.ProductionOrderStatus !== 'boposReleased')
        throw new SapBlocked(
          'Waiting for the SAP production order to be released.',
        );
      const components = sapComponents(snapshot.components);
      const lines = live.ProductionOrderLines as {
        ItemNo: string;
        BaseQuantity: number;
        ProductionOrderIssueType: string;
        Warehouse: string;
        AdditionalQuantity?: number;
      }[];
      if (
        live.ItemNo !== row.ItemCode ||
        live.Warehouse !== row.Warehouse ||
        !Array.isArray(lines) ||
        lines.length !== components.length ||
        components.some(
          (c) =>
            !lines.some(
              (l) =>
                l.ItemNo === c.itemCode &&
                l.BaseQuantity === c.perUnit &&
                l.ProductionOrderIssueType === 'im_Backflush' &&
                l.Warehouse === row.Warehouse &&
                !l.AdditionalQuantity,
            ),
        )
      )
        throw new SapBlocked(
          'SAP production order was changed outside the captured BOM.',
        );
      line.BaseType = 202;
      line.BaseEntry = order.DocumentEntry;
      // SAP derives the FG item from the production order; an explicit ItemCode is rejected.
      delete line.ItemCode;
    }
    if (row.Kind === 'DELIVERY') {
      const receipts = await this.prisma.sapTransaction.findMany({
        where: { DemandId: row.DemandId, Kind: 'PRODUCTION_RECEIPT' },
        include: { Event: true },
      });
      if (
        !receipts.length ||
        receipts.some((r) => r.Event.Status !== 'SUCCEEDED' || !r.PostedAt)
      )
        throw new SapBlocked('Waiting for verified production receipts.');
      const mapping = row.DemandId
        ? await this.prisma.sapDemandMapping.findUnique({
            where: { DemandId: row.DemandId },
          })
        : null;
      if (
        !mapping ||
        mapping.SalesOrderEntry === null ||
        mapping.SalesOrderLine === null ||
        mapping.Company !== row.Company ||
        mapping.ItemCode !== row.ItemCode
      )
        throw new SapBlocked('An exact Sales Order line mapping is required.');
      const so = await this.sap.readResource(
        `Orders(${mapping.SalesOrderEntry})`,
      );
      const soLine = (
        so.DocumentLines as {
          LineNum: number;
          ItemCode: string;
          RemainingOpenQuantity: number;
          LineStatus: string;
        }[]
      ).find((l) => l.LineNum === mapping.SalesOrderLine);
      if (
        so.CardCode !== mapping.CardCode ||
        !soLine ||
        soLine.ItemCode !== row.ItemCode ||
        soLine.LineStatus !== 'bost_Open' ||
        soLine.RemainingOpenQuantity < row.Quantity
      )
        throw new SapBlocked(
          'Sales Order item, customer, status, or open quantity no longer matches.',
        );
      body.CardCode = mapping.CardCode;
      line.BaseType = 17;
      line.BaseEntry = mapping.SalesOrderEntry;
      line.BaseLine = mapping.SalesOrderLine;
      // Do not send price, tax or discounts: SAP inherits the commercial base line.
    }
    return { resource, method: 'POST', body };
  }

  async process(initial: OutboxEvent) {
    let event = initial;
    let sent = false;
    try {
      if (!(await this.postingEnabled())) {
        await this.state.change(
          event,
          {
            Status: 'PENDING',
            MaxAttempts: { increment: 1 },
            LastErrorCode: 'SAP_PAUSED',
            LastError:
              'SAP sync is paused. This transaction will resume when enabled.',
            NextAttemptAt: new Date(Date.now() + 5000),
          },
          'SAP_PAUSED',
        );
        return;
      }
      const row = await this.prisma.sapTransaction.findUniqueOrThrow({
        where: { Id: event.Id },
      });
      if (row.Kind === 'COUNTING_CLOSE') {
        const snapshot = countingSnapshot(row);
        const dependency = await this.prisma.sapTransaction.findUnique({
          where: { Id: snapshot.dependencyId },
          include: { Event: true },
        });
        const root = await this.prisma.sapTransaction.findUniqueOrThrow({
          where: { Id: snapshot.rootId! },
        });
        if (
          dependency?.PostedAt &&
          dependency.Event.Status === 'SUCCEEDED' &&
          root.DocumentEntry !== null
        ) {
          const proof = await this.sap.readResource(
            `InventoryCountings(${root.DocumentEntry})`,
          );
          if (matchesCounting(row, proof)) {
            await this.confirm(event, root.DocumentEntry, root.DocumentNumber!);
            return;
          }
        }
      }
      const prepared = await this.prepare(row);
      const request = row.SubmittedRequest
        ? (row.SubmittedRequest as unknown as typeof prepared)
        : prepared;
      const result = await this.sap.postTransaction(
        request.resource,
        request.body,
        async () => {
          const changed = await auditedTransaction(this.prisma, async (tx) => {
            if (row.DemandId)
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('SAP_MAPPING'), hashtext(${row.DemandId}))`;
            if (row.Kind === 'SALES_ORDER') {
              const binding = await tx.sapDemandMapping.findUnique({
                where: { DemandId: row.DemandId! },
              });
              if (
                !binding?.AutoCreate ||
                binding.CardCode !== request.body.CardCode ||
                binding.SalesOrderEntry !== null
              )
                throw new SapBlocked(
                  'Customer mapping changed during Sales Order preparation.',
                );
            }
            if (row.Kind === 'DELIVERY') {
              const binding = row.DemandId
                ? await tx.sapDemandMapping.findUnique({
                    where: { DemandId: row.DemandId },
                  })
                : null;
              const line = (
                request.body.DocumentLines as {
                  BaseEntry: number;
                  BaseLine: number;
                }[]
              )[0];
              if (
                !binding ||
                binding.SalesOrderEntry !== line.BaseEntry ||
                binding.SalesOrderLine !== line.BaseLine ||
                binding.CardCode !== request.body.CardCode
              )
                throw new SapBlocked(
                  'Sales Order mapping changed during preparation.',
                );
            }
            const claimed = await this.state.changeInTransaction(
              tx,
              event,
              { LastErrorCode: SENDING },
              'SAP_SENDING',
              'SYSTEM:OUTBOX',
            );
            if (!claimed) return null;
            await tx.sapTransaction.update({
              where: { Id: row.Id },
              data: {
                SubmittedRequest: request as unknown as Prisma.InputJsonValue,
              },
            });
            return claimed;
          });
          if (!changed)
            throw new SapBlocked('Worker ownership changed before posting.');
          event = changed;
          sent = true;
        },
        request.method,
      );
      let entry = Number(
        result.DocEntry ?? result.AbsoluteEntry ?? result.DocumentEntry,
      );
      let number = Number(result.DocNum ?? result.DocumentNumber);
      if (countingKinds.includes(row.Kind)) {
        const snapshot = countingSnapshot(row);
        const root = snapshot.rootId
          ? await this.prisma.sapTransaction.findUniqueOrThrow({
              where: { Id: snapshot.rootId },
            })
          : null;
        if (row.Kind === 'COUNTING_UPDATE' || row.Kind === 'COUNTING_CLOSE') {
          entry = root!.DocumentEntry!;
          number = root!.DocumentNumber!;
        }
        const proof = await this.sap.readResource(
          `${sapResource(row.Kind)}(${entry})`,
        );
        if (!matchesCounting(row, proof, root?.DocumentEntry ?? undefined))
          throw new SapPostingError(true);
      }
      if (
        [
          'PRODUCTION_RELEASE',
          'PRODUCTION_CLOSE',
          'PRODUCTION_CANCEL',
        ].includes(row.Kind)
      ) {
        const order = await this.order(row);
        entry = order.DocumentEntry!;
        number = order.DocumentNumber ?? entry;
      }
      if (
        !Number.isSafeInteger(entry) ||
        entry < 0 ||
        !Number.isSafeInteger(number)
      )
        throw new SapPostingError(true);
      if (
        row.Kind === 'GOODS_RECEIPT' &&
        (row.Snapshot as Record<string, unknown> | null)?.lines !== undefined
      ) {
        const proof = await this.sap.readResource(
          `InventoryGenEntries(${entry})`,
        );
        if (
          (proof.JournalMemo !== `ANSEI:${row.Id}` &&
            proof.Comments !== `ANSEI:${row.Id}`) ||
          !matchesIncomingDocument(row, proof)
        )
          throw new SapPostingError(true);
      }
      if (row.Kind === 'SALES_ORDER') {
        const proof = await this.sap.readResource(`Orders(${entry})`);
        const lines = proof.DocumentLines as
          { ItemCode: string; Quantity: number }[] | undefined;
        if (
          (proof.Comments !== `ANSEI:${row.Id}` &&
            proof.JournalMemo !== `ANSEI:${row.Id}`) ||
          proof.CardCode !== request.body.CardCode ||
          lines?.length !== 1 ||
          lines[0].ItemCode !== row.ItemCode ||
          lines[0].Quantity !== row.Quantity
        )
          throw new SapPostingError(true);
      }
      if (
        row.Kind === 'PRODUCTION_ORDER' &&
        (row.Snapshot as Record<string, unknown>).autoRelease !== false
      )
        await this.releaseProductionOrder(row, entry);
      if (row.Kind === 'PRODUCTION_RELEASE') {
        const proof = await this.sap.readResource(`ProductionOrders(${entry})`);
        if (proof.ProductionOrderStatus !== 'boposReleased')
          throw new SapPostingError(true);
      }
      await this.confirm(event, entry, number);
    } catch (error) {
      const uncertain =
        error instanceof SapPostingError ? error.uncertain : sent;
      const blocked =
        error instanceof SapBlocked ||
        (error instanceof SapPostingError &&
          !error.uncertain &&
          error.httpStatus !== 401 &&
          error.httpStatus !== 429);
      if (
        !sent &&
        error instanceof SapBlocked &&
        (error.message.startsWith('Waiting for') ||
          error.message ===
            'Other production transactions are not yet verified.')
      ) {
        await this.state.change(
          event,
          {
            Status: 'PENDING',
            MaxAttempts: { increment: 1 },
            LastErrorCode: 'SAP_DEPENDENCY',
            LastError: error.message,
            NextAttemptAt: new Date(Date.now() + 60000),
          },
          'SAP_WAIT_DEPENDENCY',
        );
        return;
      }
      await this.state.change(
        event,
        {
          Status: 'FAILED',
          FailedAt: new Date(),
          LastErrorCode: uncertain
            ? UNCERTAIN
            : blocked
              ? 'SAP_BLOCKED'
              : SAFE_RETRY,
          LastError: uncertain
            ? 'SAP outcome unknown. Reconcile before retry.'
            : blocked && error instanceof Error
              ? error.message
              : 'SAP unavailable before confirmed delivery; retry scheduled.',
          NextAttemptAt: new Date(
            Date.now() +
              Math.min(300000, 5000 * 2 ** Math.min(event.Attempts, 6)),
          ),
        },
        'SAP_FAILED',
      );
    }
  }
  async releaseProductionOrder(row: SapTransaction, entry: number) {
    // Once creation succeeds, failures must be reconciled, never retried as POST.
    try {
      const resource = `ProductionOrders(${entry})`;
      const current = await this.sap.readResource(resource);
      if (
        (current.Remarks !== `ANSEI:${row.Id}` &&
          current.JournalRemarks !== `ANSEI:${row.Id}`) ||
        current.ItemNo !== row.ItemCode ||
        current.PlannedQuantity !== row.Quantity ||
        current.Warehouse !== row.Warehouse
      )
        throw new Error('Production order evidence mismatch');
      if (current.ProductionOrderStatus === 'boposPlanned') {
        await this.sap.postTransaction(
          resource,
          { ProductionOrderStatus: 'boposReleased' },
          async () => {},
          'PATCH',
        );
      } else if (current.ProductionOrderStatus !== 'boposReleased') {
        throw new Error('Production order cannot be released');
      }
      const proof = await this.sap.readResource(resource);
      if (proof.ProductionOrderStatus !== 'boposReleased')
        throw new Error('Production release not verified');
    } catch {
      throw new SapPostingError(true);
    }
  }

  async confirm(
    event: OutboxEvent,
    entry: number,
    number: number,
    actor = 'SYSTEM:OUTBOX',
  ) {
    return auditedTransaction(this.prisma, async (tx) => {
      const changed = await this.state.changeInTransaction(
        tx,
        event,
        {
          Status: 'SUCCEEDED',
          SucceededAt: new Date(),
          LastErrorCode: 'SAP_TRANSACTION_SYNCED',
          LastError: null,
        },
        'SAP_CONFIRMED',
        actor,
      );
      if (!changed)
        throw new SapBlocked(
          'Transaction state changed; refresh before reconciling.',
        );
      const transaction = await tx.sapTransaction.findUnique({
        where: { Id: event.Id },
      });
      if (transaction?.Kind === 'SALES_ORDER' && transaction.DemandId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('SAP_MAPPING'), hashtext(${transaction.DemandId}))`;
        const submitted = transaction.SubmittedRequest as {
          body: { CardCode: string };
        };
        await tx.sapDemandMapping.update({
          where: { DemandId: transaction.DemandId },
          data: {
            SalesOrderEntry: entry,
            SalesOrderLine: 0,
            CardCode: submitted.body.CardCode,
            UpdatedBy: actor,
          },
        });
      }
      await tx.sapTransaction.update({
        where: { Id: event.Id },
        data: {
          DocumentEntry: entry,
          DocumentNumber: number,
          PostedAt: new Date(),
        },
      });
      if (transaction?.Kind === 'COUNTING_CLOSE') {
        const snapshot = countingSnapshot(transaction);
        await tx.outboxEvent.update({
          where: { Id: snapshot.rootId! },
          data: { ReferenceType: 'STOCK_OPNAME' },
        });
        await sapAudit(tx, actor, 'STO_UNFROZEN', snapshot.countingId);
      }
      await sapAudit(tx, actor, 'DOCUMENT_LINKED', event.Id);
    });
  }
}
