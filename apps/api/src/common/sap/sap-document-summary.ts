/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { sapStatus } from './sap-connection.service';

export class SapDocumentReference {
  @ApiProperty()
  partNumber: string;
  @ApiProperty({ nullable: true, type: String })
  demandId: string | null;
}
export class SapDocumentSummary {
  @ApiProperty()
  key: string;
  @ApiProperty({
    enum: [
      'GOODS_RECEIPT',
      'PRODUCTION_ORDER',
      'SALES_ORDER',
      'INVENTORY_COUNTING',
      'INVENTORY_POSTING',
    ],
  })
  kind: string;
  @ApiProperty({ nullable: true, type: Number })
  documentNumber: number | null;
  @ApiProperty({ type: [SapDocumentReference] })
  references: SapDocumentReference[];
  @ApiProperty({
    type: [String],
    description:
      'Local posting/lifecycle statuses; UNVERIFIED means no confirmed document evidence.',
  })
  statuses: string[];
}

const selection = {
  Id: true,
  Kind: true,
  Company: true,
  LedgerId: true,
  DemandId: true,
  ItemCode: true,
  Snapshot: true,
  DocumentEntry: true,
  DocumentNumber: true,
  PostedAt: true,
  Event: { select: { Status: true, LastErrorCode: true } },
} satisfies Prisma.SapTransactionSelect;

export async function decorateSapCountingDocuments<T extends { Id: string }>(
  prisma: PrismaService,
  rows: T[],
) {
  if (!rows.length) return [];
  const postings = await prisma.sapTransaction.findMany({
    where: {
      Kind: {
        in: [
          'INVENTORY_COUNTING',
          'COUNTING_UPDATE',
          'INVENTORY_POSTING',
          'COUNTING_CLOSE',
        ],
      },
      OR: rows.map((r) => ({
        Snapshot: { path: ['countingId'], equals: r.Id },
      })),
    },
    select: {
      ...selection,
      Event: {
        select: { Status: true, LastErrorCode: true, ReferenceType: true },
      },
    },
    orderBy: { CreatedAt: 'asc' },
  });
  return rows.map((row) => {
    const related = postings.filter(
      (p) => snapshotText(p, 'countingId') === row.Id,
    );
    const root = related.find((p) => p.Kind === 'INVENTORY_COUNTING');
    const documents = summarizeSapDocuments(
      related.filter((p) =>
        ['INVENTORY_COUNTING', 'INVENTORY_POSTING'].includes(p.Kind),
      ),
      related
        .filter((p) => ['COUNTING_UPDATE', 'COUNTING_CLOSE'].includes(p.Kind))
        .map((p) => ({
          ...p,
          Snapshot: {
            ...(p.Snapshot as Prisma.JsonObject),
            orderEventId: snapshotText(p, 'rootId'),
          },
        })),
    );
    if (root?.Event.LastErrorCode === 'SAP_COUNTING_CANCELLED')
      documents.forEach((d) => (d.statuses = ['CANCELLED']));
    return {
      ...row,
      SAPDocuments: documents,
      SAPCounting: {
        held: root?.Event.ReferenceType === 'STO_HOLD',
        ready: !!root && verified(root),
        integrated: !!root,
      },
    };
  });
}
type Posting = Prisma.SapTransactionGetPayload<{ select: typeof selection }>;

function snapshotText(row: Posting, field: string) {
  const snapshot = row.Snapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
    return null;
  const value = snapshot[field];
  return typeof value === 'string' && value.trim() ? value : null;
}
function verified(row: Posting) {
  return (
    row.PostedAt !== null &&
    row.DocumentEntry !== null &&
    row.DocumentNumber !== null &&
    sapStatus(row.Event) === 'SYNCED'
  );
}

/** Keep document identity separate from later lifecycle failures. No SAP calls. */
export function summarizeSapDocuments(
  roots: Posting[],
  children: Posting[] = [],
  uncertain = false,
): SapDocumentSummary[] {
  const groups = new Map<string, SapDocumentSummary>();
  for (const root of roots) {
    const related = [
      root,
      ...children.filter(
        (child) =>
          snapshotText(child, 'orderEventId') === root.Id &&
          child.Company === root.Company,
      ),
    ];
    const proof = uncertain ? undefined : related.find(verified);
    const key = proof
      ? `${root.Company}:${root.Kind}:${proof.DocumentEntry}`
      : root.Id;
    const group = groups.get(key) ?? {
      key,
      kind: root.Kind,
      documentNumber: proof?.DocumentNumber ?? null,
      references: [],
      statuses: [],
    };
    const snapshot = root.Snapshot as Record<string, unknown> | null;
    const partNumbers =
      root.Kind === 'GOODS_RECEIPT' && Array.isArray(snapshot?.lines)
        ? snapshot.lines.flatMap((line: unknown) => {
            if (
              !line ||
              typeof line !== 'object' ||
              !('partNumber' in line) ||
              typeof line.partNumber !== 'string'
            )
              return [];
            return [line.partNumber];
          })
        : ['INVENTORY_COUNTING', 'INVENTORY_POSTING'].includes(root.Kind) &&
            Array.isArray(snapshot?.lines)
          ? snapshot.lines.flatMap((line: unknown) =>
              line &&
              typeof line === 'object' &&
              'parts' in line &&
              Array.isArray(line.parts)
                ? line.parts.filter(
                    (part): part is string => typeof part === 'string',
                  )
                : [],
            )
          : [root.ItemCode];
    for (const partNumber of partNumbers) {
      if (
        !group.references.some(
          (ref) =>
            ref.partNumber === partNumber && ref.demandId === root.DemandId,
        )
      ) {
        group.references.push({ partNumber, demandId: root.DemandId });
      }
    }
    const statuses = uncertain
      ? ['UNVERIFIED']
      : related.map((row) => {
          const status = sapStatus(row.Event);
          return status === 'SYNCED' && !verified(row) ? 'UNVERIFIED' : status;
        });
    group.statuses = [...new Set([...group.statuses, ...statuses])];
    groups.set(key, group);
  }
  return [...groups.values()];
}

export async function decorateSapIncomingDocuments<T extends { PoId: string }>(
  prisma: PrismaService,
  rows: T[],
) {
  if (!rows.length) return [];
  const ledgers = await prisma.inventoryLedger.findMany({
    where: {
      ReferenceDoc: { in: rows.map((row) => row.PoId) },
      TransactionType: 'INCOMING_SUPPLIER',
    },
    select: { Id: true, ReferenceDoc: true },
  });
  const postings = ledgers.length
    ? await prisma.sapTransaction.findMany({
        where: {
          Kind: 'GOODS_RECEIPT',
          LedgerId: { in: ledgers.map((row) => row.Id) },
        },
        select: selection,
        orderBy: [{ CreatedAt: 'asc' }, { Id: 'asc' }],
      })
    : [];
  const byReference = new Map<string, Posting[]>();
  const refs = new Map(ledgers.map((row) => [row.Id, row.ReferenceDoc]));
  for (const posting of postings) {
    const ref = posting.LedgerId ? refs.get(posting.LedgerId) : undefined;
    if (ref) byReference.set(ref, [...(byReference.get(ref) ?? []), posting]);
  }
  return rows.map((row) => ({
    ...row,
    SAPDocuments: summarizeSapDocuments(byReference.get(row.PoId) ?? []),
  }));
}

export async function decorateSapForecastDocuments<T extends { PoId: string }>(
  prisma: PrismaService,
  rows: T[],
) {
  if (!rows.length) return [];
  const demandIds = rows.map((row) => row.PoId);
  const [postings, mappings] = await Promise.all([
    prisma.sapTransaction.findMany({
      where: { Kind: 'SALES_ORDER', DemandId: { in: demandIds } },
      select: selection,
      orderBy: [{ CreatedAt: 'asc' }, { Id: 'asc' }],
    }),
    prisma.sapDemandMapping.findMany({
      where: { DemandId: { in: demandIds }, SalesOrderEntry: { not: null } },
      select: {
        DemandId: true,
        Company: true,
        ItemCode: true,
        SalesOrderEntry: true,
      },
    }),
  ]);
  return rows.map((row) => {
    const own = postings.filter((posting) => posting.DemandId === row.PoId);
    const documents = summarizeSapDocuments(own);
    const mapping = mappings.find((value) => value.DemandId === row.PoId);
    if (
      mapping &&
      !own.some(
        (posting) =>
          posting.Company === mapping.Company &&
          posting.DocumentEntry === mapping.SalesOrderEntry &&
          verified(posting),
      )
    ) {
      documents.push({
        key: `mapping:${row.PoId}`,
        kind: 'SALES_ORDER',
        documentNumber: null,
        references: [{ partNumber: mapping.ItemCode, demandId: row.PoId }],
        statuses: ['UNVERIFIED'],
      });
    }
    return { ...row, SAPDocuments: documents };
  });
}

export async function decorateSapReleaseDocuments<
  T extends { ReleaseNumber: string; Forecasts: { PoId: string }[] },
>(prisma: PrismaService, rows: T[]) {
  if (!rows.length) return [];
  const demandIds = rows.flatMap((row) =>
    row.Forecasts.map((forecast) => forecast.PoId),
  );
  const roots = await prisma.sapTransaction.findMany({
    where: {
      Kind: 'PRODUCTION_ORDER',
      OR: [
        { DemandId: { in: demandIds } },
        ...rows.map((row) => ({
          Snapshot: { path: ['releaseNumber'], equals: row.ReleaseNumber },
        })),
      ],
    },
    select: selection,
    orderBy: [{ CreatedAt: 'asc' }, { Id: 'asc' }],
  });
  const children = roots.length
    ? await prisma.sapTransaction.findMany({
        where: {
          Kind: {
            in: ['PRODUCTION_RELEASE', 'PRODUCTION_CLOSE', 'PRODUCTION_CANCEL'],
          },
          OR: roots.map((row) => ({
            Snapshot: { path: ['orderEventId'], equals: row.Id },
          })),
        },
        select: selection,
        orderBy: [{ CreatedAt: 'asc' }, { Id: 'asc' }],
      })
    : [];
  return rows.map((row) => {
    const own = roots.filter(
      (root) => snapshotText(root, 'releaseNumber') === row.ReleaseNumber,
    );
    const unknown = roots.filter(
      (root) =>
        !snapshotText(root, 'releaseNumber') &&
        row.Forecasts.some((forecast) => forecast.PoId === root.DemandId),
    );
    return {
      ...row,
      SAPDocuments: [
        ...summarizeSapDocuments(own, children),
        ...summarizeSapDocuments(unknown, [], true),
      ],
    };
  });
}
