/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import type { PrismaService } from '../../prisma/prisma.service';
import { sapStatus } from './sap-connection.service';
export interface SapOperationStatus {
  status: string;
  events: { id: string; status: string; documentNumber: number | null }[];
}
/** Batch local reads only; safe to use in Web and PDA operational responses. */
export async function decorateSapOperations<T>(
  prisma: PrismaService,
  rows: T[],
  reference: (row: T) => string,
  includeBackflush = false,
): Promise<(T & { SAPIntegration: SapOperationStatus })[]> {
  if (!rows.length) return [];
  const references = rows.map(reference);
  const ledgers = await prisma.inventoryLedger.findMany({
    where: { ReferenceDoc: { in: references } },
    select: { Id: true, ReferenceDoc: true },
  });
  const ownPicks =
    includeBackflush && ledgers.length
      ? await prisma.sapBackflushPick.findMany({
          where: { LedgerId: { in: ledgers.map((l) => l.Id) } },
        })
      : [];
  const demands = [...new Set(ownPicks.map((p) => p.DemandId))];
  const allPicks = demands.length
    ? await prisma.sapBackflushPick.findMany({
        where: { DemandId: { in: demands } },
      })
    : [];
  const postings = await prisma.sapTransaction.findMany({
    where: {
      OR: [
        { LedgerId: { in: ledgers.map((l) => l.Id) } },
        { DemandId: { in: [...references, ...demands] } },
      ],
    },
    include: { Event: true },
  });
  return rows.map((row) => {
    const ref = reference(row);
    const ids = new Set(
      ledgers.filter((l) => l.ReferenceDoc === ref).map((l) => l.Id),
    );
    const events = postings
      .filter(
        (p) =>
          (p.LedgerId && ids.has(p.LedgerId)) ||
          p.DemandId === ref ||
          ownPicks.some(
            (pick) => ids.has(pick.LedgerId) && pick.DemandId === p.DemandId,
          ),
      )
      .map((p) => ({
        id: p.Id,
        status: sapStatus(p.Event),
        documentNumber: p.DocumentNumber,
      }));
    const awaitingBackflush = ownPicks
      .filter((pick) => ids.has(pick.LedgerId))
      .some((pick) => {
        const picked = allPicks
          .filter(
            (p) => p.DemandId === pick.DemandId && p.ItemCode === pick.ItemCode,
          )
          .reduce((total, p) => total + p.Quantity, 0);
        const consumed = postings
          .filter(
            (p) =>
              p.DemandId === pick.DemandId &&
              p.Kind === 'PRODUCTION_RECEIPT' &&
              p.PostedAt &&
              sapStatus(p.Event) === 'SYNCED',
          )
          .reduce(
            (total, p) =>
              total +
              (p.Effects as { itemCode: string; quantity: number }[])
                .filter((e) => e.itemCode === pick.ItemCode && e.quantity < 0)
                .reduce((sum, e) => sum - e.quantity, 0),
            0,
          );
        return picked > consumed;
      });
    const priority = [
      'RECONCILE',
      'FAILED',
      'BLOCKED',
      'PROCESSING',
      'PENDING',
      'SYNCED',
    ];
    return {
      ...row,
      SAPIntegration: {
        status:
          priority.find(
            (s) =>
              (s === 'PENDING' && awaitingBackflush) ||
              events.some((e) => e.status === s),
          ) ?? 'NOT_CAPTURED',
        events,
      },
    };
  });
}
