/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { auditContext } from './audit-context.helper';

export function commandFingerprint(payload: unknown): string {
  const canonical = JSON.stringify(payload, (_key, value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return value;
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export async function claimCommand(
  tx: Prisma.TransactionClient,
  scope: string,
  requestId: string,
  actor: string,
  payload: unknown,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scope}), hashtext(${requestId}))`;
  const fingerprint = commandFingerprint(payload);
  const previous = await tx.businessCommand.findUnique({
    where: { Scope_RequestId: { Scope: scope, RequestId: requestId } },
  });
  if (previous) {
    const context = auditContext.getStore();
    if (context) context.commandId = previous.Id;
    if (previous.Fingerprint !== fingerprint || previous.Actor !== actor)
      throw new ConflictException({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Request identity was already used for another operation.',
      });
    if (previous.Result === null)
      throw new ConflictException({
        code: 'COMMAND_RESULT_UNAVAILABLE',
        message:
          'Transaction result is not available. Reconcile the original transaction before retrying.',
      });
    await recordCommandReplay(tx, previous.Id, actor);
    return { command: previous, duplicate: true };
  }
  const command = await tx.businessCommand.create({
    data: {
      Scope: scope,
      RequestId: requestId,
      Fingerprint: fingerprint,
      Actor: actor,
    },
  });
  const context = auditContext.getStore();
  if (context) context.commandId = command.Id;
  return { command, duplicate: false };
}

export async function recordCommandReplay(
  tx: Prisma.TransactionClient,
  id: string,
  actor: string,
) {
  const context = auditContext.getStore();
  await tx.actionAuditEvent.create({
    data: {
      SourceType: 'BusinessCommand',
      SourceId: id,
      Action: 'REPLAY',
      Actor: actor,
      ActorSource: 'AUTHENTICATED_COMMAND',
      RequestId: context?.requestId,
      ProcessId: context?.processId,
    },
  });
}

/** HTTP commands require a caller-retained key; background service calls are explicit. */
export function requestCommandKey(): string | undefined {
  const context = auditContext.getStore();
  if (!context) return undefined;
  const key = context.idempotencyKey;
  if (
    !key ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      key,
    )
  ) {
    throw new BadRequestException(
      'A valid UUID Idempotency-Key header is required. Reuse it when retrying the same action.',
    );
  }
  return key;
}

export async function finishCommand(
  tx: Prisma.TransactionClient,
  id: string,
  result: unknown,
) {
  await tx.businessCommand.update({
    where: { Id: id },
    data: {
      Result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
    },
  });
}
