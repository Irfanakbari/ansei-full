/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import type { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { auditContext, bindAuditContext } from './audit-context.helper';

/** Correlation only: never retries callbacks containing external side effects. */
export function auditedTransaction<T>(
  prisma: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  },
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await bindAuditContext(tx);
    return work(tx);
  }, options);
}

/** Standalone writes get the same attribution as writes inside business transactions. */
export function auditedWrite<T>(
  prisma: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return auditContext.getStore()
    ? auditedTransaction(prisma, work)
    : work(prisma);
}
