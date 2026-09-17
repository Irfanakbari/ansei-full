import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  LogProcessModel,
  LogProcessDetailModel,
} from '../../generated/prisma/models';
import type { Prisma } from '../../generated/prisma/client';

type LogProcessClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class LogProcessService {
  private readonly messageCounters = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  private generateProcessId(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timePart = now.toISOString().slice(11, 19).replace(/:/g, '');
    const msPart = now.getMilliseconds().toString().padStart(3, '0');
    const randPart = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    const uniquePart = (parseInt(msPart + randPart) % 1000000)
      .toString()
      .padStart(6, '0');
    return `PR${datePart}${timePart}${uniquePart}`;
  }

  private generateMessageId(processId: string): string {
    const next = (this.messageCounters.get(processId) ?? 0) + 1;
    this.messageCounters.set(processId, next > 999 ? 1 : next);
    return `COMM-${this.messageCounters.get(processId)!.toString().padStart(3, '0')}`;
  }

  resetCounter(): void {
    this.messageCounters.clear();
  }

  async startProcess(params: {
    functionId: string;
    functionName: string;
    createdBy?: string;
    client?: LogProcessClient;
  }): Promise<LogProcessModel> {
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
    this.messageCounters.set(process.ProcessId, 0);
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

    return client.logProcessDetail.create({
      data: {
        ProcessId: params.processId,
        MessageId: this.generateMessageId(params.processId),
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

    await client.logProcess.update({
      where: { ProcessId: processId },
      data: {
        ProcessStatus: status,
        ProcessEnd: now,
      },
    });
    this.messageCounters.delete(processId);
  }
}
