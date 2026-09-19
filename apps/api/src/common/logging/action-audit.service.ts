/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { auditContext } from '../helpers/audit-context.helper';

@Injectable()
export class ActionAuditService {
  private readonly logger = new Logger(ActionAuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  async failure(
    request: Request & { requestId?: string; user?: { username?: string } },
    status: number,
  ) {
    if (request.method === 'GET' && status !== 401 && status !== 403) return;
    const context = auditContext.getStore();
    try {
      await this.prisma.actionAuditEvent.create({
        data: {
          SourceType: 'HTTP',
          // Route template, never URL query strings or raw request/exception payloads.
          SourceId:
            typeof request.route?.path === 'string'
              ? request.route.path
              : 'UNMATCHED_ROUTE',
          Action: status === 401 || status === 403 ? 'DENIED' : 'FAILED',
          Actor: request.user?.username ?? null,
          ActorSource: request.user?.username
            ? 'AUTHENTICATED_REQUEST'
            : 'UNAUTHENTICATED',
          RequestId: request.requestId,
          ProcessId: context?.processId,
          After: {
            method: request.method,
            statusCode: status,
            ...(context?.commandId ? { commandId: context.commandId } : {}),
          },
        },
      });
    } catch {
      // A database outage must not expose credentials or mask the original HTTP failure.
      this.logger.error(
        'Action audit persistence failed; investigate the audit storage connection.',
      );
    }
  }
}
