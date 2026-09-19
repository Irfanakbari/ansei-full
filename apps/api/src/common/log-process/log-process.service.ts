import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  LogProcessModel,
  LogProcessDetailModel,
} from '../../generated/prisma/models';
import type { Prisma } from '../../generated/prisma/client';
import { randomUUID } from 'node:crypto';
import {
  auditContext,
  bindAuditContext,
} from '../helpers/audit-context.helper';
import { auditedTransaction } from '../helpers/audited-transaction.helper';

type LogProcessClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class LogProcessService {
  constructor(private readonly prisma: PrismaService) {}

  private generateProcessId(): string {
    return `PR${randomUUID().replaceAll('-', '')}`;
  }

  private generateMessageId(): string {
    return `COMM-${randomUUID()}`;
  }

  resetCounter(): void {
    // Compatibility method: message identities no longer depend on process-local counters.
  }

  async startProcess(params: {
    functionId: string;
    functionName: string;
    createdBy?: string;
    client?: LogProcessClient;
  }): Promise<LogProcessModel> {
    const currentContext = auditContext.getStore();
    if (currentContext) currentContext.actor = params.createdBy;
    if (!params.client && currentContext) {
      return auditedTransaction(this.prisma, (tx) =>
        this.startProcess({ ...params, client: tx }),
      );
    }
    const now = new Date();

    const client = params.client ?? this.prisma;
    const process = await client.logProcess.create({
      data: {
        ProcessId: this.generateProcessId(),
        FunctionId: params.functionId,
        FunctionName: params.functionName,
        ProcessStatus: 'STARTED',
        ProcessStart: now,
        ProcessDate: now,
        CreatedAt: now,
        CreatedBy: params.createdBy,
      },
    });
    const context = auditContext.getStore();
    if (context) {
      context.processId = process.ProcessId;
      context.actor = params.createdBy;
    }
    return process;
  }

  async addLog(params: {
    processId: string;
    message: string;
    type: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    location: string;
    client?: LogProcessClient;
  }): Promise<LogProcessDetailModel> {
    const now = new Date();
    const client = params.client ?? this.prisma;

    if (params.client) await bindAuditContext(params.client);

    return client.logProcessDetail.create({
      data: {
        ProcessId: params.processId,
        MessageId: this.generateMessageId(),
        Message: params.message,
        Type: params.type,
        Location: params.location,
        ProcessDate: now,
        CreatedAt: now,
      },
    });
  }

  async completeProcess(
    processId: string,
    status: 'SUCCESS' | 'FAILED',
    endMessage?: string,
    client: LogProcessClient = this.prisma,
  ): Promise<void> {
    if (client === this.prisma && auditContext.getStore()) {
      return auditedTransaction(this.prisma, (tx) =>
        this.completeProcess(processId, status, endMessage, tx),
      );
    }
    await bindAuditContext(client);
    const now = new Date();

    if (endMessage) {
      await this.addLog({
        processId,
        message: endMessage,
        type: status === 'SUCCESS' ? 'INFO' : 'ERROR',
        location: 'LogProcessService',
        client,
      });
    }

    await client.logProcess.updateMany({
      where: { ProcessId: processId, ProcessEnd: null },
      data: {
        ProcessStatus: status,
        ProcessEnd: now,
      },
    });
  }
}
