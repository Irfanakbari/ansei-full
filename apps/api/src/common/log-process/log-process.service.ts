import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  LogProcessModel,
  LogProcessDetailModel,
} from '../../generated/prisma/models';

@Injectable()
export class LogProcessService {
  private messageCounter = 0;

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

  private generateMessageId(): string {
    this.messageCounter++;
    if (this.messageCounter > 999) this.messageCounter = 1;
    return `COMM-${this.messageCounter.toString().padStart(3, '0')}`;
  }

  resetCounter(): void {
    this.messageCounter = 0;
  }

  async startProcess(params: {
    functionId: string;
    functionName: string;
    createdBy?: string;
  }): Promise<LogProcessModel> {
    this.resetCounter();
    const now = new Date();

    return this.prisma.logProcess.create({
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
  }

  async addLog(params: {
    processId: string;
    message: string;
    type: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    location: string;
  }): Promise<LogProcessDetailModel> {
    const now = new Date();

    return this.prisma.logProcessDetail.create({
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
  ): Promise<void> {
    const now = new Date();

    if (endMessage) {
      await this.addLog({
        processId,
        message: endMessage,
        type: status === 'SUCCESS' ? 'INFO' : 'ERROR',
        location: 'LogProcessService',
      });
    }

    await this.prisma.logProcess.update({
      where: { ProcessId: processId },
      data: {
        ProcessStatus: status,
        ProcessEnd: now,
      },
    });
  }
}
