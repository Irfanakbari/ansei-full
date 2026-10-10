import { cancelRejectedCounting } from './sap-counting-recovery';
import { withInventoryTransaction } from '../helpers/inventory-transaction.helper';
/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { auditedTransaction } from '../helpers/audited-transaction.helper';
import {
  claimCommand,
  finishCommand,
} from '../helpers/business-command.helper';
import {
  OutboxStateService,
  SAFE_RETRY,
  UNCERTAIN,
} from '../outbox/outbox-state.service';
import { SapCacheService } from './sap-cache.service';
import { SapExternalMonitorService } from './sap-external-monitor.service';
import { SapItemSyncService } from './sap-item-sync.service';
import {
  SapPostingService,
  sapEscape,
  sapResource,
} from './sap-posting.service';
import { sapAudit, type SapEffect } from './sap-transaction-capture';
import {
  SapActionDto,
  SapMappingDto,
  SapQueryDto,
  SapAutoSalesDto,
  SapSettingsDto,
} from './sap-connection.dto';
import { sapRuntimeSettings } from './sap-runtime-settings';
import {
  matchesIncomingDocument,
  receiptItemLabel,
} from './sap-incoming-document';

export function sapStatus(event: {
  Status: string;
  LastErrorCode: string | null;
}) {
  if (event.LastErrorCode === 'SAP_COUNTING_CANCELLED') return 'CANCELLED';
  if (event.LastErrorCode === UNCERTAIN) return 'RECONCILE';
  if (
    ['SAP_BLOCKED', 'SAP_CANCELLED_BEFORE_RELEASE'].includes(
      event.LastErrorCode ?? '',
    )
  )
    return 'BLOCKED';
  if (event.Status === 'SUCCEEDED')
    return event.LastErrorCode === 'SAP_TRANSACTION_SYNCED' ||
      event.LastErrorCode === 'SAP_MATERIAL_SYNCED'
      ? 'SYNCED'
      : 'BLOCKED';
  return event.Status === 'QUEUED' ? 'PENDING' : event.Status;
}
export function reconcileStock(
  mes: number,
  backflush: number,
  pendingEffect: number,
  sap: number | null,
) {
  const expectedSap = mes + backflush - pendingEffect;
  return { expectedSap, unexplained: sap === null ? null : sap - expectedSap };
}
@Injectable()
export class SapConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sap: SapItemSyncService,
    private readonly cache: SapCacheService,
    private readonly posting: SapPostingService,
    private readonly state: OutboxStateService,
    private readonly config: ConfigService,
    private readonly external: SapExternalMonitorService,
  ) {}
  private company() {
    return this.config.get<string>('SAP_COMPANY_DB') ?? '';
  }
  private warehouse() {
    return this.config.get<string>('SAP_TRANSACTION_WAREHOUSE') ?? 'DMY-ANS';
  }
  async overview() {
    const settings = await sapRuntimeSettings(this.prisma, this.company());
    const [connection, groups, oldest, last, redis] = await Promise.all([
      this.prisma.sapConnectionState.findUnique({
        where: { Company: this.company() },
      }),
      this.prisma.outboxEvent.groupBy({
        by: ['Status', 'LastErrorCode'],
        where: { Type: { in: ['SAP_TRANSACTION', 'SAP_MATERIAL_UPDATE'] } },
        _count: true,
      }),
      this.prisma.outboxEvent.findFirst({
        where: {
          Type: { in: ['SAP_TRANSACTION', 'SAP_MATERIAL_UPDATE'] },
          Status: { not: 'SUCCEEDED' },
          OR: [
            { LastErrorCode: null },
            { LastErrorCode: { not: 'SAP_COUNTING_CANCELLED' } },
          ],
        },
        orderBy: { CreatedAt: 'asc' },
        select: { CreatedAt: true },
      }),
      this.prisma.sapTransaction.findFirst({
        where: { Company: this.company(), PostedAt: { not: null } },
        orderBy: { PostedAt: 'desc' },
        select: { PostedAt: true },
      }),
      this.cache.health(),
    ]);
    const counts: Record<string, number> = {};
    for (const group of groups) {
      const status = sapStatus(group);
      counts[status] = (counts[status] ?? 0) + group._count;
    }
    return {
      company: this.company(),
      warehouse: this.warehouse(),
      captureEnabled:
        this.config.get('SAP_TRANSACTION_CAPTURE_ENABLED') === 'true',
      postingEnabled: settings.enabled,
      settings,
      allowedFinishGoods: (
        this.config.get<string>('SAP_TRANSACTION_ITEM_ALLOWLIST') ??
        '5715B132-KD'
      )
        .split(',')
        .filter(Boolean),
      allowedMaterials: (
        this.config.get<string>('SAP_TRANSACTION_MATERIAL_ALLOWLIST') ?? ''
      )
        .split(',')
        .filter(Boolean),
      tlsValidation: this.config.get('SAP_TLS_REJECT_UNAUTHORIZED') !== 'false',
      session: this.sap.sessionHealth(),
      redis,
      workerHealthy:
        !!connection?.WorkerAt &&
        Date.now() - connection.WorkerAt.getTime() < 120000,
      connection,
      counts,
      oldestPendingAt: oldest?.CreatedAt ?? null,
      lastPostedAt: last?.PostedAt ?? null,
    };
  }
  async saveSettings(dto: SapSettingsDto, actor: string) {
    return auditedTransaction(this.prisma, async (tx) => {
      const { command, duplicate } = await claimCommand(
        tx,
        'SAP_SETTINGS',
        dto.requestId,
        actor,
        dto,
      );
      if (duplicate) return command.Result;
      const settings = {
        enabled: dto.enabled,
        projectCode: dto.projectCode.trim(),
        costCenter: dto.costCenter.trim(),
      };
      await tx.sapConnectionState.upsert({
        where: { Company: this.company() },
        create: { Company: this.company(), IntegrationSettings: settings },
        update: { IntegrationSettings: settings },
      });
      await sapAudit(
        tx,
        actor,
        `SETTINGS_${settings.enabled ? 'ENABLED' : 'PAUSED'}: project=${settings.projectCode}; costCenter=${settings.costCenter}; reason=${dto.reason}`,
        this.company(),
      );
      await finishCommand(tx, command.Id, settings);
      return settings;
    });
  }
  async transactions(query: SapQueryDto) {
    const status: Prisma.OutboxEventWhereInput =
      query.status === 'CANCELLED'
        ? { LastErrorCode: 'SAP_COUNTING_CANCELLED' }
        : query.status === 'SYNCED'
          ? {
              Status: 'SUCCEEDED',
              LastErrorCode: {
                in: ['SAP_TRANSACTION_SYNCED', 'SAP_MATERIAL_SYNCED'],
              },
            }
          : query.status === 'BLOCKED'
            ? {
                LastErrorCode: {
                  in: ['SAP_BLOCKED', 'SAP_CANCELLED_BEFORE_RELEASE'],
                },
              }
            : query.status === 'RECONCILE'
              ? { LastErrorCode: UNCERTAIN }
              : query.status === 'PENDING'
                ? { Status: { in: ['PENDING', 'QUEUED'] } }
                : query.status === 'FAILED'
                  ? {
                      Status: 'FAILED',
                      LastErrorCode: {
                        notIn: [
                          'SAP_BLOCKED',
                          UNCERTAIN,
                          'SAP_COUNTING_CANCELLED',
                        ],
                      },
                    }
                  : query.status === 'PROCESSING'
                    ? { Status: 'PROCESSING' }
                    : {};
    const where: Prisma.OutboxEventWhereInput = {
      Type: { in: ['SAP_TRANSACTION', 'SAP_MATERIAL_UPDATE'] },
      ...status,
      ...(query.referenceId
        ? {
            OR: [
              { ReferenceId: query.referenceId },
              { SapTransaction: { DemandId: query.referenceId } },
            ],
          }
        : {}),
      ...(query.search
        ? {
            AND: [
              {
                OR: [
                  {
                    ReferenceId: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    SapTransaction: {
                      ItemCode: { contains: query.search, mode: 'insensitive' },
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };
    const [rows, totalItems] = await Promise.all([
      this.prisma.outboxEvent.findMany({
        where,
        include: { SapTransaction: true },
        orderBy: [{ CreatedAt: 'desc' }, { Id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.outboxEvent.count({ where }),
    ]);
    return {
      data: rows.map((row) => ({
        id: row.Id,
        type: row.SapTransaction?.Kind ?? row.Type,
        status: sapStatus(row),
        itemCode: row.SapTransaction
          ? receiptItemLabel(row.SapTransaction)
          : null,
        quantity: row.SapTransaction?.Quantity ?? null,
        referenceId:
          row.SapTransaction && countingKinds.includes(row.SapTransaction.Kind)
            ? countingSnapshot(row.SapTransaction).reference
            : row.ReferenceId,
        demandId: row.SapTransaction?.DemandId ?? null,
        attempts: row.Attempts,
        errorCode: row.LastErrorCode,
        error: row.LastError,
        documentEntry: row.SapTransaction?.DocumentEntry ?? null,
        documentNumber: row.SapTransaction?.DocumentNumber ?? null,
        createdAt: row.CreatedAt,
        postedAt: row.SucceededAt,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }
  async detail(id: string) {
    const row = await this.prisma.outboxEvent.findUnique({
      where: { Id: id },
      include: { SapTransaction: true },
    });
    if (!row || !['SAP_TRANSACTION', 'SAP_MATERIAL_UPDATE'].includes(row.Type))
      throw new NotFoundException('SAP event not found.');
    const audit = await this.prisma.actionAuditEvent.findMany({
      where: { SourceId: id },
      orderBy: { CreatedAt: 'desc' },
      take: 100,
      select: { Id: true, Action: true, CreatedAt: true },
    });
    return {
      id,
      status: sapStatus(row),
      source:
        row.SapTransaction && countingKinds.includes(row.SapTransaction.Kind)
          ? countingSnapshot(row.SapTransaction).reference
          : row.ReferenceId,
      demandId: row.SapTransaction?.DemandId,
      effects: row.SapTransaction?.Effects,
      documentEntry: row.SapTransaction?.DocumentEntry,
      documentNumber: row.SapTransaction?.DocumentNumber,
      error: row.LastError,
      audit,
    };
  }
  async check(actor: string) {
    const result = await this.cache.load(
      'connection-check',
      30000,
      30000,
      async () => {
        try {
          await this.sap.readResource('Warehouses', {
            $filter: `WarehouseCode eq '${sapEscape(this.warehouse())}'`,
            $select: 'WarehouseCode',
            $top: '1',
          });
          return { connected: true, checkedAt: new Date().toISOString() };
        } catch {
          return { connected: false, checkedAt: new Date().toISOString() };
        }
      },
    );
    await auditedTransaction(this.prisma, async (tx) => {
      await tx.sapConnectionState.upsert({
        where: { Company: this.company() },
        create: {
          Company: this.company(),
          Connected: result.value.connected,
          CheckedAt: new Date(result.value.checkedAt),
        },
        update: {
          Connected: result.value.connected,
          CheckedAt: new Date(result.value.checkedAt),
        },
      });
      await sapAudit(tx, actor, 'CHECK_CONNECTION', this.company());
    });
    return result.value;
  }
  async refresh(actor: string) {
    const snapshot = await this.cache.load(
      'stock-snapshot',
      60000,
      60000,
      async () => {
        const startedAt = new Date().toISOString();
        const items: { code: string; quantity: number }[] = [];
        const [materials, finishGoods] = await Promise.all([
          this.prisma.material.findMany({
            select: { PartNumber: true, PartNumberSAP: true },
          }),
          this.prisma.finishGood.findMany({
            select: { PartNumber: true, PartNumberSAP: true },
          }),
        ]);
        const codes = [
          ...new Set(
            [...materials, ...finishGoods].map(
              (item) => item.PartNumberSAP?.trim() || item.PartNumber,
            ),
          ),
        ].sort();
        for (let offset = 0; offset < codes.length; offset += 40) {
          const batch = codes.slice(offset, offset + 40);
          let skip = 0;
          for (;;) {
            const page = await this.sap.readResource('Items', {
              $select: 'ItemCode,ItemWarehouseInfoCollection',
              $filter:
                "InventoryItem eq 'tYES' and (" +
                batch
                  .map((code) => "ItemCode eq '" + sapEscape(code) + "'")
                  .join(' or ') +
                ')',
              $orderby: 'ItemCode',
              $top: '40',
              $skip: String(skip),
            });
            if (!Array.isArray(page.value))
              throw new Error('Invalid SAP stock response');
            for (const value of page.value as {
              ItemCode: string;
              ItemWarehouseInfoCollection: {
                WarehouseCode: string;
                InStock: number;
              }[];
            }[]) {
              const stock = value.ItemWarehouseInfoCollection.find(
                (w) => w.WarehouseCode === this.warehouse(),
              );
              if (stock && Number.isFinite(stock.InStock))
                items.push({ code: value.ItemCode, quantity: stock.InStock });
            }
            if (!page['@odata.nextLink'] && !page['odata.nextLink']) break;
            skip += page.value.length;
            if (!page.value.length || skip >= batch.length)
              throw new Error('Invalid SAP stock pagination');
          }
        }
        return { startedAt, observedAt: new Date().toISOString(), items };
      },
    );
    await auditedTransaction(
      this.prisma,
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('SAP_STOCK_SNAPSHOT'))`;
        const previous = await tx.sapConnectionState.findUnique({
          where: { Company: this.company() },
        });
        const at = new Date(snapshot.value.observedAt);
        const started = new Date(snapshot.value.startedAt);
        if (previous?.RefreshedAt && previous.RefreshedAt >= at) return;
        await tx.sapStockSnapshot.deleteMany({
          where: { Company: this.company(), Warehouse: this.warehouse() },
        });
        await tx.sapStockSnapshot.createMany({
          data: snapshot.value.items.map((i) => ({
            Company: this.company(),
            Warehouse: this.warehouse(),
            ItemCode: i.code,
            Quantity: i.quantity,
            ObservedAt: at,
            StartedAt: started,
          })),
        });
        await tx.sapConnectionState.upsert({
          where: { Company: this.company() },
          create: {
            Company: this.company(),
            RefreshedAt: at,
            RefreshStartedAt: started,
          },
          update: {
            RefreshedAt: at,
            RefreshStartedAt: started,
            RefreshError: null,
          },
        });
        await sapAudit(tx, actor, 'REFRESH_STOCK', this.company());
      },
      { timeout: 15000 },
    );
    const external = await this.external.scan(actor);
    return {
      external,
      observedAt: snapshot.value.observedAt,
      items: snapshot.value.items.length,
    };
  }
  async externalDocuments(query: SapQueryDto) {
    const where = { Company: this.company(), Warehouse: this.warehouse() };
    const [data, totalItems] = await Promise.all([
      this.prisma.sapExternalDocument.findMany({
        where,
        orderBy: { ObservedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.sapExternalDocument.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }
  async stock(query: SapQueryDto) {
    const connection = await this.prisma.sapConnectionState.findUnique({
      where: { Company: this.company() },
    });
    const cutoff = connection?.RefreshStartedAt ?? new Date();
    return auditedTransaction(
      this.prisma,
      async (tx) => {
        const [materials, balances, picks, transactions, snapshots] =
          await Promise.all([
            tx.material.findMany({
              select: { PartNumber: true, PartNumberSAP: true, PartName: true },
            }),
            tx.inventoryLedger.groupBy({
              by: ['MaterialId', 'Location'],
              where: {
                ItemCategory: 'MATERIAL',
                TransactionDate: { lte: cutoff },
                Location: { in: ['WAREHOUSE', 'RACK'] },
              },
              _sum: { QtyIn: true, QtyOut: true },
            }),
            tx.sapBackflushPick.findMany({
              where: {
                Company: this.company(),
                Warehouse: this.warehouse(),
              },
            }),
            tx.sapTransaction.findMany({
              where: {
                Company: this.company(),
                Warehouse: this.warehouse(),
                Event: {
                  OR: [
                    { LastErrorCode: null },
                    { LastErrorCode: { not: 'SAP_COUNTING_CANCELLED' } },
                  ],
                },
              },
            }),
            tx.sapStockSnapshot.findMany({
              where: { Company: this.company(), Warehouse: this.warehouse() },
            }),
          ]);
        const groups = new Map<
          string,
          {
            itemCode: string;
            names: string[];
            partNumbers: string[];
            warehouse: number;
            rack: number;
          }
        >();
        for (const material of materials) {
          const code = material.PartNumberSAP?.trim() || material.PartNumber;
          const row = groups.get(code) ?? {
            itemCode: code,
            names: [],
            partNumbers: [],
            warehouse: 0,
            rack: 0,
          };
          row.names.push(material.PartName);
          row.partNumbers.push(material.PartNumber);
          for (const balance of balances.filter(
            (b) => b.MaterialId === material.PartNumber,
          )) {
            const qty = (balance._sum.QtyIn ?? 0) - (balance._sum.QtyOut ?? 0);
            if (balance.Location === 'WAREHOUSE') row.warehouse += qty;
            else row.rack += qty;
          }
          groups.set(code, row);
        }
        const data = [...groups.values()]
          .map((row) => {
            let backflush = picks
              .filter(
                (p) => p.ItemCode === row.itemCode && p.CreatedAt <= cutoff,
              )
              .reduce((sum, p) => sum + p.Quantity, 0);
            let pending = 0;
            let changing = picks.some(
              (p) => p.ItemCode === row.itemCode && p.CreatedAt > cutoff,
            );
            for (const transaction of transactions) {
              const effects = transaction.Effects as SapEffect[];
              if (transaction.CreatedAt > cutoff) {
                if (effects.some((e) => e.itemCode === row.itemCode))
                  changing = true;
                continue;
              }
              for (const effect of effects.filter(
                (e) => e.itemCode === row.itemCode,
              )) {
                if (
                  transaction.Kind === 'PRODUCTION_RECEIPT' &&
                  effect.quantity < 0
                )
                  backflush += effect.quantity;
                if (!transaction.PostedAt || transaction.PostedAt > cutoff)
                  pending += effect.quantity;
                if (transaction.PostedAt && transaction.PostedAt > cutoff)
                  changing = true;
              }
            }
            const snapshot = snapshots.find((s) => s.ItemCode === row.itemCode);
            const mes = row.warehouse + row.rack;
            const result = reconcileStock(
              mes,
              backflush,
              pending,
              snapshot?.Quantity ?? null,
            );
            const stale =
              !snapshot || Date.now() - snapshot.ObservedAt.getTime() > 300000;
            return {
              ...row,
              mes,
              sap: snapshot?.Quantity ?? null,
              awaitingBackflush: backflush,
              pendingEffect: pending,
              ...result,
              status: !snapshot
                ? 'NOT_CHECKED'
                : stale
                  ? 'STALE'
                  : changing
                    ? 'IN_FLIGHT'
                    : backflush < 0
                      ? 'BRIDGE_INVALID'
                      : result.unexplained !== 0
                        ? 'UNEXPLAINED'
                        : backflush || pending
                          ? 'EXPLAINED'
                          : 'MATCHED',
              observedAt: snapshot?.ObservedAt ?? null,
              cutoff,
            };
          })
          .filter(
            (row) =>
              !query.search ||
              [row.itemCode, ...row.partNumbers, ...row.names].some((v) =>
                v.toLowerCase().includes(query.search!.toLowerCase()),
              ),
          )
          .sort((a, b) => a.itemCode.localeCompare(b.itemCode));
        return {
          data: data.slice(
            (query.page - 1) * query.limit,
            query.page * query.limit,
          ),
          meta: {
            page: query.page,
            limit: query.limit,
            totalItems: data.length,
            totalPages: Math.ceil(data.length / query.limit),
          },
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 15000 },
    );
  }
  async mappings(query: SapQueryDto) {
    const where: Prisma.ProductionOrderWhereInput = query.search
      ? {
          OR: [
            { PoId: { contains: query.search, mode: 'insensitive' } },
            { FinishGoodId: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [orders, totalItems] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where,
        include: {
          PartData: { select: { PartNumberSAP: true, PartName: true } },
        },
        orderBy: [{ Date: 'desc' }, { PoId: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.productionOrder.count({ where }),
    ]);
    const bindings = await this.prisma.sapDemandMapping.findMany({
      where: { DemandId: { in: orders.map((o) => o.PoId) } },
    });
    const captured = await this.prisma.sapTransaction.findMany({
      where: {
        DemandId: { in: orders.map((o) => o.PoId) },
        Kind: 'PRODUCTION_ORDER',
      },
      select: { DemandId: true, ItemCode: true, Snapshot: true },
    });
    return {
      data: orders.map((o) => ({
        demandId: o.PoId,
        partNumber: o.FinishGoodId,
        itemCode: o.PartData.PartNumberSAP?.trim() || o.FinishGoodId,
        name: o.PartData.PartName,
        warehouse: this.warehouse(),
        captured: captured.some((c) => c.DemandId === o.PoId),
        mapping: bindings.find((b) => b.DemandId === o.PoId) ?? null,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }
  async automaticSales(dto: SapAutoSalesDto, actor: string) {
    const order = await this.prisma.productionOrder.findUniqueOrThrow({
      where: { PoId: dto.demandId },
      include: { PartData: true },
    });
    const customer = await this.sap.readResource(
      "BusinessPartners('" + encodeURIComponent(sapEscape(dto.cardCode)) + "')",
    );
    if (
      customer.CardType !== 'cCustomer' ||
      customer.Valid !== 'tYES' ||
      customer.Frozen === 'tYES'
    )
      throw new ConflictException('An active SAP customer is required.');
    return auditedTransaction(this.prisma, async (tx) => {
      const command = await claimCommand(
        tx,
        'SAP_AUTO_SALES_MAPPING',
        dto.requestId,
        actor,
        dto,
      );
      if (command.duplicate) return command.command.Result;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('SAP_MAPPING'), hashtext(${dto.demandId}))`;
      const current = await tx.sapDemandMapping.findUnique({
        where: { DemandId: dto.demandId },
      });
      const submitted = await tx.sapTransaction.count({
        where: {
          DemandId: dto.demandId,
          Kind: { in: ['SALES_ORDER', 'DELIVERY'] },
          OR: [
            { SubmittedRequest: { not: Prisma.DbNull } },
            { Event: { Status: { in: ['PROCESSING', 'SUCCEEDED'] } } },
          ],
        },
      });
      if (current?.SalesOrderEntry || submitted)
        throw new ConflictException(
          'Customer mapping is locked after Sales Order linkage or submission.',
        );
      const data = {
        Company: this.company(),
        ItemCode: order.PartData.PartNumberSAP?.trim() || order.FinishGoodId,
        CardCode: dto.cardCode,
        AutoCreate: true,
        UpdatedBy: actor,
      };
      await tx.sapDemandMapping.upsert({
        where: { DemandId: dto.demandId },
        create: { DemandId: dto.demandId, ...data },
        update: data,
      });
      await sapAudit(tx, actor, 'MAP_AUTO_SALES_CUSTOMER', dto.demandId);
      await finishCommand(tx, command.command.Id, { demandId: dto.demandId });
      return { demandId: dto.demandId };
    });
  }
  async map(dto: SapMappingDto, actor: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { PoId: dto.demandId },
      include: { PartData: true },
    });
    if (!order) throw new NotFoundException('Production demand not found.');
    const code = order.PartData.PartNumberSAP?.trim() || order.FinishGoodId;
    const so = await this.sap.readResource(`Orders(${dto.salesOrderEntry})`);
    const line = (
      so.DocumentLines as {
        LineNum: number;
        ItemCode: string;
        LineStatus: string;
        RemainingOpenQuantity: number;
      }[]
    ).find((l) => l.LineNum === dto.salesOrderLine);
    if (
      !line ||
      line.ItemCode !== code ||
      line.LineStatus !== 'bost_Open' ||
      typeof so.CardCode !== 'string' ||
      line.RemainingOpenQuantity < order.Qty
    )
      throw new ConflictException(
        'Sales Order line must match the item and have enough open quantity.',
      );
    return auditedTransaction(this.prisma, async (tx) => {
      const command = await claimCommand(
        tx,
        'SAP_MAPPING',
        dto.requestId,
        actor,
        dto,
      );
      if (command.duplicate) return command.command.Result;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('SAP_MAPPING'), hashtext(${dto.demandId}))`;
      if (
        await tx.sapTransaction.count({
          where: { DemandId: dto.demandId, Kind: 'SALES_ORDER' },
        })
      )
        throw new ConflictException(
          'Automatic Sales Order already captured. Resolve its existing job instead of replacing the document mapping.',
        );
      if (
        await tx.sapTransaction.count({
          where: {
            DemandId: dto.demandId,
            Kind: { in: ['DELIVERY', 'SALES_ORDER'] },
            OR: [
              { SubmittedRequest: { not: Prisma.DbNull } },
              {
                Event: {
                  OR: [
                    { Status: 'PROCESSING' },
                    { Status: 'SUCCEEDED' },
                    { LastErrorCode: UNCERTAIN },
                  ],
                },
              },
            ],
          },
        })
      )
        throw new ConflictException(
          'Sales mapping is locked after delivery submission.',
        );
      const saved = await tx.sapDemandMapping.upsert({
        where: { DemandId: dto.demandId },
        create: {
          DemandId: dto.demandId,
          Company: this.company(),
          ItemCode: code,
          AutoCreate: false,
          SalesOrderEntry: dto.salesOrderEntry,
          SalesOrderLine: dto.salesOrderLine,
          CardCode: so.CardCode as string,
          UpdatedBy: actor,
        },
        update: {
          Company: this.company(),
          ItemCode: code,
          SalesOrderEntry: dto.salesOrderEntry,
          SalesOrderLine: dto.salesOrderLine,
          CardCode: so.CardCode as string,
          UpdatedBy: actor,
        },
      });
      await sapAudit(tx, actor, 'MAP_SALES_ORDER', dto.demandId);
      await finishCommand(tx, command.command.Id, { demandId: saved.DemandId });
      return { demandId: saved.DemandId };
    });
  }
  async cancelCounting(id: string, dto: SapActionDto, actor: string) {
    const row = await this.prisma.sapTransaction.findUniqueOrThrow({
      where: { Id: id },
    });
    if (row.Company !== this.company() || row.Warehouse !== this.warehouse())
      throw new ConflictException(
        'SAP company or warehouse differs from runtime configuration.',
      );
    const category = countingSnapshot(row).category;
    if (category !== 'MATERIAL' && category !== 'FINISH_GOOD')
      throw new ConflictException('Invalid STO category.');
    return withInventoryTransaction(this.prisma, category, async (tx) => {
      const command = await claimCommand(
        tx,
        'SAP_CANCEL_COUNTING',
        dto.requestId,
        actor,
        { id, ...dto },
      );
      if (command.duplicate) return command.command.Result;
      const result = await cancelRejectedCounting(tx, id, actor, dto.reason);
      await finishCommand(tx, command.command.Id, result);
      return result;
    });
  }
  async retry(id: string, dto: SapActionDto, actor: string) {
    return auditedTransaction(this.prisma, async (tx) => {
      const command = await claimCommand(
        tx,
        'SAP_RETRY',
        dto.requestId,
        actor,
        { id, ...dto },
      );
      if (command.duplicate) return command.command.Result;
      const event = await tx.outboxEvent.findUnique({ where: { Id: id } });
      if (
        !event ||
        event.Type !== 'SAP_TRANSACTION' ||
        event.Status !== 'FAILED' ||
        ![SAFE_RETRY, 'SAP_BLOCKED'].includes(event.LastErrorCode ?? '')
      )
        throw new ConflictException(
          'Only a known unsent or rejected transaction can be retried. Unknown outcomes require reconciliation.',
        );
      const changed = await this.state.changeInTransaction(
        tx,
        event,
        {
          Status: 'PENDING',
          NextAttemptAt: new Date(),
          MaxAttempts: event.Attempts + 5,
          LastErrorCode: null,
          LastError: null,
          FailedAt: null,
        },
        'SAP_RETRY',
        actor,
        dto.reason,
      );
      if (!changed)
        throw new ConflictException('State changed. Refresh before retrying.');
      await finishCommand(tx, command.command.Id, { id });
      return { id };
    });
  }
  async reconcile(id: string, actor: string) {
    const row = await this.prisma.sapTransaction.findUnique({
      where: { Id: id },
      include: { Event: true },
    });
    if (
      !row ||
      row.Event.Status !== 'FAILED' ||
      row.Event.LastErrorCode !== UNCERTAIN
    )
      throw new ConflictException('Only unknown outcomes can be reconciled.');
    if (row.Company !== this.company())
      throw new ConflictException('Company mismatch.');
    const resource = sapResource(row.Kind);
    if (countingKinds.includes(row.Kind)) {
      const snapshot = countingSnapshot(row);
      const root = snapshot.rootId
        ? await this.prisma.sapTransaction.findUniqueOrThrow({
            where: { Id: snapshot.rootId },
          })
        : null;
      let proof: Record<string, unknown>;
      if (row.Kind === 'COUNTING_UPDATE' || row.Kind === 'COUNTING_CLOSE') {
        if (root?.DocumentEntry == null)
          throw new ConflictException('Original SAP counting is not verified.');
        proof = await this.sap.readResource(
          `InventoryCountings(${root.DocumentEntry})`,
        );
      } else {
        const found = await this.sap.readResource(resource, {
          $filter: `Reference2 eq '${countingReference(snapshot.reference)}'`,
          $top: '2',
        });
        if (!Array.isArray(found.value) || found.value.length !== 1)
          throw new ConflictException(
            'No unique SAP document found. No repost was attempted.',
          );
        const foundEntry = Number(
          (found.value[0] as Record<string, unknown>).DocumentEntry,
        );
        if (!Number.isSafeInteger(foundEntry))
          throw new ConflictException('SAP document identity is missing.');
        proof = await this.sap.readResource(`${resource}(${foundEntry})`);
      }
      if (
        !row.SubmittedRequest ||
        !matchesCounting(row, proof, root?.DocumentEntry ?? undefined)
      )
        throw new ConflictException(
          'SAP counting/posting differs from the frozen transaction.',
        );
      const entry = Number(proof.DocumentEntry),
        number = Number(proof.DocumentNumber);
      if (!Number.isSafeInteger(entry) || !Number.isSafeInteger(number))
        throw new ConflictException('SAP document identity is missing.');
      await this.posting.confirm(row.Event, entry, number, actor);
      return { id, documentEntry: entry };
    }
    if (
      ['PRODUCTION_RELEASE', 'PRODUCTION_CLOSE', 'PRODUCTION_CANCEL'].includes(
        row.Kind,
      )
    ) {
      const order = await this.posting.order(row);
      if (order?.DocumentEntry === null || !order)
        throw new ConflictException(
          'Original production order is not verified.',
        );
      const live = await this.sap.readResource(
        `ProductionOrders(${order.DocumentEntry})`,
      );
      if (
        live.ProductionOrderStatus !==
          (row.Kind === 'PRODUCTION_CANCEL'
            ? 'boposCancelled'
            : row.Kind === 'PRODUCTION_RELEASE'
              ? 'boposReleased'
              : 'boposClosed') ||
        live.ItemNo !== row.ItemCode
      )
        throw new ConflictException('Production order is not verified closed.');
      await this.posting.confirm(
        row.Event,
        order.DocumentEntry,
        order.DocumentNumber ?? order.DocumentEntry,
        actor,
      );
      return { id, documentEntry: order.DocumentEntry };
    }
    const result = await this.sap.readResource(resource, {
      $filter: sapCorrelationFilter(row.Kind, id),
      $top: '2',
    });
    const rows = result.value as Record<string, unknown>[];
    if (!Array.isArray(rows) || rows.length !== 1)
      throw new ConflictException(
        'No unique SAP document found. Event remains held; no repost was attempted.',
      );
    const found = rows[0];
    if (
      found.Cancelled === 'tYES' ||
      found.ProductionOrderStatus === 'boposCancelled'
    )
      throw new ConflictException('The correlated SAP document was cancelled.');
    const lines = found.DocumentLines as
      | { ItemCode: string; Quantity: number; WarehouseCode: string }[]
      | undefined;
    const matches =
      row.Kind === 'PRODUCTION_ORDER'
        ? found.ItemNo === row.ItemCode &&
          found.PlannedQuantity === row.Quantity &&
          found.Warehouse === row.Warehouse
        : row.Kind === 'GOODS_RECEIPT' &&
            (row.Snapshot as Record<string, unknown>).lines !== undefined
          ? matchesIncomingDocument(row, found)
          : lines?.length === 1 &&
            lines[0].ItemCode === row.ItemCode &&
            lines[0].Quantity === row.Quantity &&
            lines[0].WarehouseCode === row.Warehouse;
    const submitted = row.SubmittedRequest as {
      body?: Record<string, unknown>;
    } | null;
    const requested = submitted?.body;
    if (!requested)
      throw new ConflictException('Submitted request evidence is missing.');
    const expectedLines = requested.DocumentLines as
      Record<string, unknown>[] | undefined;
    const actualLines = found.DocumentLines as
      Record<string, unknown>[] | undefined;
    const lineFields = [
      'ItemCode',
      'Quantity',
      'WarehouseCode',
      'BaseType',
      'BaseEntry',
      'BaseLine',
    ];
    const documentMatches = expectedLines
      ? actualLines?.length === expectedLines.length &&
        expectedLines.every((line, index) =>
          lineFields.every(
            (key) =>
              line[key] === undefined || actualLines[index][key] === line[key],
          ),
        ) &&
        (requested.CardCode === undefined ||
          requested.CardCode === found.CardCode)
      : (() => {
          const expected = requested.ProductionOrderLines as
            Record<string, unknown>[] | undefined;
          const actual = found.ProductionOrderLines as
            Record<string, unknown>[] | undefined;
          return (
            expected &&
            actual?.length === expected.length &&
            expected.every((line, index) =>
              [
                'ItemNo',
                'BaseQuantity',
                'Warehouse',
                'ProductionOrderIssueType',
              ].every((key) => actual[index][key] === line[key]),
            )
          );
        })();
    const entry = Number(found.DocEntry ?? found.AbsoluteEntry);
    const number = Number(found.DocNum ?? found.DocumentNumber);
    if (
      !matches ||
      !documentMatches ||
      !Number.isSafeInteger(entry) ||
      !Number.isSafeInteger(number)
    )
      throw new ConflictException(
        'SAP document content differs from the captured transaction.',
      );
    if (
      row.Kind === 'PRODUCTION_ORDER' &&
      (row.Snapshot as Record<string, unknown>).autoRelease !== false
    )
      await this.posting.releaseProductionOrder(row, entry);
    await this.posting.confirm(row.Event, entry, number, actor);
    return { id, documentEntry: entry };
  }
}
import { sapCorrelationFilter } from './sap-document-reference';
import {
  countingKinds,
  countingSnapshot,
  countingReference,
  matchesCounting,
} from './sap-counting';
