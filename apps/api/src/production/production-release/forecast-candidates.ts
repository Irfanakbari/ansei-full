/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
import type { Prisma } from '../../generated/prisma/client';

export interface CandidateFilters {
  sourceType?: 'PO' | 'NON_PO';
  search?: string;
  poNumber?: string;
  partNumber?: string;
  deliveryDate?: string;
}

/** Shared by paginated candidates and the unpaginated selection snapshot. */
export function forecastCandidateWhere(
  query: CandidateFilters,
  releaseId: string | null,
): Prisma.ProductionOrderWhereInput {
  return {
    ProductionReleaseId: releaseId,
    SourceType: query.sourceType ?? 'PO',
    Shopping: { none: {} },
    ShoppingCompletion: { is: null },
    ProductionReport: { none: {} },
    DeliveryHistory: { none: {} },
    ProductionFindings: { none: {} },
    LabelData: {
      none: {
        OR: [
          { Scanned: true },
          { PokayokeHistory: { some: {} } },
          { AssemblySessions: { some: {} } },
          { DeliveryHistory: { isNot: null } },
        ],
      },
    },
    ...(query.search
      ? {
          OR: [
            { PoId: { contains: query.search, mode: 'insensitive' as const } },
            {
              FinishGoodId: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
            {
              VendorName: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {}),
    ...(query.poNumber
      ? { PoId: { contains: query.poNumber, mode: 'insensitive' as const } }
      : {}),
    ...(query.partNumber
      ? {
          FinishGoodId: {
            contains: query.partNumber,
            mode: 'insensitive' as const,
          },
        }
      : {}),
    ...(query.deliveryDate
      ? {
          DeliveryDate: {
            gte: new Date(`${query.deliveryDate}T00:00:00.000Z`),
            lte: new Date(`${query.deliveryDate}T23:59:59.999Z`),
          },
        }
      : {}),
  };
}
