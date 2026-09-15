import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Stream } from 'node:stream';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiSuccessResponse } from './api-response.interface';
import { getDefaultSuccessMessage, getRequestPath } from './response.factory';

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<
  T,
  T | ApiSuccessResponse<unknown>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T | ApiSuccessResponse<unknown>> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((result) => {
        if (this.shouldBypass(response, result)) return result;
        if (this.isSuccessEnvelope(result) || this.isErrorEnvelope(result)) {
          return result;
        }

        const apiResult = this.isApiResult(result) ? result : undefined;
        return {
          success: true,
          statusCode: response.statusCode,
          message: getDefaultSuccessMessage(response.statusCode),
          data: apiResult ? apiResult.data : (result ?? null),
          ...(apiResult ? { meta: apiResult.meta } : {}),
          timestamp: new Date().toISOString(),
          path: getRequestPath(request),
        };
      }),
    );
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
