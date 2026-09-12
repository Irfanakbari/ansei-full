import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OriginalErrorFileLogService } from '../logging/original-error-file-log.service';

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

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      await this.originalErrorFileLogService.write(exception, {
        requestId: request.requestId,
        method: request.method,
        statusCode: status,
      });
    }

    // Log the exception for debugging
    // console.error('Exception caught by AllExceptionsFilter:', exception);
    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message:
        typeof message === 'object' && message !== null
          ? (message as any).message || message
          : message,
    };

    // In production, don't leak detailed error messages for 500 errors
    if (process.env.PRODUCTION && status === HttpStatus.INTERNAL_SERVER_ERROR) {
      errorResponse.message = 'Internal server error';
    }

    response.status(status).json(errorResponse);
  }
}
