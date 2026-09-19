import { auditContext, bindAuditContext } from './audit-context.helper';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { ItemCategory } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_TRANSACTION_ATTEMPTS = 3;
const INVENTORY_LOCK_NAMESPACE = 4_163_821;

export type InventoryTransactionClient = Prisma.TransactionClient;

export async function lockInventoryCategory(
  tx: InventoryTransactionClient,
  category: ItemCategory,
): Promise<void> {
  if (typeof tx.$executeRaw !== 'function') {
    return;
  }
  const categoryKey = category === ItemCategory.MATERIAL ? 1 : 2;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${INVENTORY_LOCK_NAMESPACE}, ${categoryKey})`;
}

export async function withInventoryTransaction<T>(
  prisma: PrismaService,
  category: ItemCategory,
  operation: (tx: InventoryTransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await bindAuditContext(tx);
          await lockInventoryCategory(tx, category);
          return operation(tx);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const isRetryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';
      const context = auditContext.getStore();
      if (isRetryable && context) {
        await prisma.actionAuditEvent.create({
          data: {
            SourceType: 'InventoryTransaction',
            SourceId: category,
            Action: 'RETRY',
            Actor: context.actor,
            ActorSource: context.actor ? 'REQUEST_CONTEXT' : 'UNATTRIBUTED',
            ProcessId: context.processId,
            RequestId: context.requestId,
            After: {
              failedAttempt: attempt,
              maximumAttempts: MAX_TRANSACTION_ATTEMPTS,
              willRetry: attempt < MAX_TRANSACTION_ATTEMPTS,
            },
          },
        });
      }
      if (!isRetryable || attempt === MAX_TRANSACTION_ATTEMPTS) {
        if (isRetryable) {
          throw new ConflictException(
            'Inventory changed concurrently. Please retry the transaction.',
          );
        }
        throw error;
      }
    }
  }

  throw new ConflictException(
    'Inventory changed concurrently. Please retry the transaction.',
  );
}
