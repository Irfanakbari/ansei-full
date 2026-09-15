import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Optional,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Stream } from 'node:stream';
import type { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  getUserDisplayName,
  getUserDisplayNameMap,
} from '../helpers/user-lookup.helper';
import type { ApiSuccessResponse } from './api-response.interface';
import { getDefaultSuccessMessage, getRequestPath } from './response.factory';

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<
  T,
  T | ApiSuccessResponse<unknown>
> {
  constructor(
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T | ApiSuccessResponse<unknown>> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      mergeMap(async (result) => {
        if (this.shouldBypass(response, result)) return result;
        if (this.isErrorEnvelope(result)) {
          return result;
        }

        if (this.isSuccessEnvelope(result)) {
          const envelope = result as T & { data?: unknown };
          if (envelope.data) {
            await this.enrichUserDisplayNames(envelope.data);
          }
          return result;
        }

        const apiResult = this.isApiResult(result) ? result : undefined;
        const payload = apiResult ? apiResult.data : (result ?? null);
        const enrichedPayload = await this.enrichUserDisplayNames(payload);

        return {
          success: true as const,
          statusCode: response.statusCode,
          message: getDefaultSuccessMessage(response.statusCode),
          data: enrichedPayload ?? null,
          ...(apiResult ? { meta: apiResult.meta } : {}),
          timestamp: new Date().toISOString(),
          path: getRequestPath(request),
        };
      }),
    );
  }

  private async enrichUserDisplayNames(payload: unknown): Promise<unknown> {
    if (!this.prisma) return payload;

    const auditFields = {
      CreateBy: 'CreateByName',
      ChangeBy: 'ChangeByName',
      CreatedBy: 'CreatedByName',
      UpdatedBy: 'UpdatedByName',
      UpdateBy: 'UpdateByName',
      createdBy: 'createdByName',
      updatedBy: 'updatedByName',
      ReceivedBy: 'ReceivedByName',
      receivedBy: 'receivedByName',
      ApprovedBy: 'ApprovedByName',
      approvedBy: 'approvedByName',
      CheckedBy: 'CheckedByName',
      checkedBy: 'checkedByName',
      ScannedBy: 'ScannedByName',
      scannedBy: 'scannedByName',
    } as const;
    const userIds = new Set<string>();

    this.visitRecords(payload, (record) => {
      for (const sourceField of Object.keys(auditFields) as Array<
        keyof typeof auditFields
      >) {
        const value = record[sourceField];
        if (typeof value === 'string' && value.trim()) userIds.add(value);
      }
    });

    if (userIds.size === 0) return payload;

    const displayNames = await getUserDisplayNameMap([...userIds], this.prisma);
    this.visitRecords(payload, (record) => {
      for (const [sourceField, displayField] of Object.entries(auditFields)) {
        const value = record[sourceField];
        if (
          typeof value === 'string' &&
          value.trim() &&
          typeof record[displayField] !== 'string'
        ) {
          record[displayField] = getUserDisplayName(value, displayNames);
        }
      }
    });

    return payload;
  }

  private visitRecords(
    value: unknown,
    visitor: (record: Record<string, unknown>) => void,
  ): void {
    if (Array.isArray(value)) {
      value.forEach((item) => this.visitRecords(item, visitor));
      return;
    }

    if (!this.isRecord(value)) return;

    visitor(value);
    Object.values(value).forEach((item) => this.visitRecords(item, visitor));
  }

  private shouldBypass(response: Response, result: T): boolean {
    const contentType = response.getHeader('content-type');
    return (
      response.statusCode === 204 ||
      (response.statusCode >= 300 && response.statusCode < 400) ||
      response.headersSent ||
      response.getHeader('content-disposition') !== undefined ||
      (typeof contentType === 'string' &&
        contentType.toLowerCase().startsWith('text/event-stream')) ||
      result instanceof StreamableFile ||
      result instanceof Stream ||
      Buffer.isBuffer(result)
    );
  }

  private isApiResult(value: unknown): value is {
    data: unknown;
    meta: Record<string, unknown>;
  } {
    return this.isRecord(value) && 'data' in value && this.isRecord(value.meta);
  }

  private isSuccessEnvelope(value: unknown): boolean {
    return this.isRecord(value) && value.success === true && 'data' in value;
  }

  private isErrorEnvelope(value: unknown): boolean {
    return this.isRecord(value) && value.success === false;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
