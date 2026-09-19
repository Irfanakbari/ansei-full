/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '../../generated/prisma/client';

export interface AuditContext {
  requestId: string;
  idempotencyKey?: string;
  commandId?: string;
  processId?: string;
  actor?: string;
}
export const auditContext = new AsyncLocalStorage<AuditContext>();

export async function bindAuditContext(tx: Prisma.TransactionClient) {
  const context = auditContext.getStore();
  if (!context) return;
  await tx.$executeRaw`SELECT set_config('ansei.request_id', ${context.requestId}, true), set_config('ansei.process_id', ${context.processId ?? ''}, true), set_config('ansei.actor', ${context.actor ?? ''}, true)`;
}
