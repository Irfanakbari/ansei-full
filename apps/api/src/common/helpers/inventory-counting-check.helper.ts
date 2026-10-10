/* By Irfan Akbari Vuteq Indonesia - 2026-09-16 */
import { BadRequestException } from '@nestjs/common';
import { ItemCategory, OpnameStatus } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';

export interface ActiveInventoryCountingPrismaTarget {
  sapTransaction?: {
    findFirst(args: Prisma.SapTransactionFindFirstArgs): Promise<unknown>;
  };
  stockOpname: {
    findFirst(args: {
      where: {
        Status: OpnameStatus;
        Category?: ItemCategory;
      };
      select?: {
        Id: true;
        RecordNumber: true;
        Category: true;
        Status: true;
      };
    }): Promise<{
      Id: string;
      RecordNumber: string;
      Category: ItemCategory;
      Status: OpnameStatus;
    } | null>;
  };
}

/**
 * Ensures there is no active Inventory Counting (Stock Opname) session in progress (IN_PROGRESS).
 * If an active session is found, throws BadRequestException to deny the transaction.
 *
 * @param prisma PrismaService or database client
 * @param category Optional item category (MATERIAL / FINISH_GOOD). If not provided, checks all categories.
 * @param transactionName Transaction name for descriptive error message.
 */
export async function assertNoActiveInventoryCounting(
  prisma: ActiveInventoryCountingPrismaTarget,
  category?: ItemCategory,
  transactionName?: string,
): Promise<void> {
  // Durable barrier survives MES close/cancel and Redis loss until SAP unfreeze is verified.
  if (
    prisma.sapTransaction &&
    (await prisma.sapTransaction.findFirst({
      where: {
        Kind: 'INVENTORY_COUNTING',
        Event: { ReferenceType: 'STO_HOLD' },
        ...(category
          ? { Snapshot: { path: ['category'], equals: category } }
          : {}),
      },
      select: { Id: true },
    }))
  )
    throw new BadRequestException(
      'SAP inventory counting is still active or awaiting recovery. Finish posting and unfreeze before moving stock.',
    );
  if (!prisma?.stockOpname?.findFirst) {
    return;
  }

  const whereClause: {
    Status: OpnameStatus;
    Category?: ItemCategory;
  } = {
    Status: OpnameStatus.IN_PROGRESS,
  };

  if (category) {
    whereClause.Category = category;
  }

  const activeOpname = await prisma.stockOpname.findFirst({
    where: whereClause,
    select: {
      Id: true,
      RecordNumber: true,
      Category: true,
      Status: true,
    },
  });

  if (activeOpname) {
    const actionDesc = transactionName ? ` for ${transactionName}` : '';
    throw new BadRequestException(
      `Transaction denied: Inventory Counting session ${activeOpname.RecordNumber} (${activeOpname.Category}) is currently active (IN_PROGRESS). All inventory transactions and mutations${actionDesc} are temporarily frozen until counting is completed and approved.`,
    );
  }
}
