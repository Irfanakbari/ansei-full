import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OriginalErrorFileLogService } from '../logging/original-error-file-log.service';
import {
  createErrorResponse,
  getRequestPath,
} from '../interceptors/response.factory';

type ErrorRequest = Request & { requestId?: string };

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly originalErrorFileLogService: OriginalErrorFileLogService,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<ErrorRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const responseBody = this.isRecord(exceptionResponse)
      ? exceptionResponse
      : undefined;
    const rawMessage = responseBody?.message ?? exceptionResponse;
    const message = Array.isArray(rawMessage)
      ? 'Request validation failed'
      : typeof rawMessage === 'string'
        ? rawMessage
        : 'Request failed';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      await this.originalErrorFileLogService.write(exception, {
        requestId: request.requestId,
        method: request.method,
        path: getRequestPath(request),
        statusCode: status,
      });
    }

    response.status(status).json(
      createErrorResponse({
        statusCode: status,
        message:
          status === HttpStatus.INTERNAL_SERVER_ERROR
            ? 'Internal server error'
            : message,
        path: getRequestPath(request),
        error:
          typeof responseBody?.error === 'string'
            ? responseBody.error
            : undefined,
        details: Array.isArray(rawMessage) ? rawMessage : undefined,
      }),
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
