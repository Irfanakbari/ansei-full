import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { Request, Response } from 'express';
import { OriginalErrorFileLogService } from '../logging/original-error-file-log.service';
import {
  createErrorResponse,
  getRequestPath,
} from '../interceptors/response.factory';

type ErrorRequest = Request & { requestId?: string };

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly originalErrorFileLogService: OriginalErrorFileLogService,
  ) {}

  async catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<ErrorRequest>();
    switch (exception.code) {
      case 'P2000': // Input Value too long
        this.send(
          response,
          request,
          HttpStatus.BAD_REQUEST,
          `The value provided for '${this.extractField(exception)}' is too long.`,
        );
        break;
      case 'P2002': // Unique constraint failed
        this.send(
          response,
          request,
          HttpStatus.CONFLICT,
          `The value for '${this.extractField(exception)}' already exists. Please use a unique value.`,
        );
        break;
      case 'P2003': // Foreign key constraint failed
        this.send(
          response,
          request,
          HttpStatus.BAD_REQUEST,
          `Invalid reference. The referenced record for '${this.extractField(exception)}' does not exist.`,
        );
        break;
      case 'P2025': // Record not found
        this.send(
          response,
          request,
          HttpStatus.NOT_FOUND,
          'The requested record was not found.',
        );
        break;
      case 'P2028': // Transaction timeout
        this.catchTransactionTimeout(exception, response, request);
        break;
      default:
        await this.originalErrorFileLogService.write(exception, {
          requestId: request.requestId,
          method: request.method,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        });
        this.send(
          response,
          request,
          HttpStatus.INTERNAL_SERVER_ERROR,
          'Internal server error',
        );
        break;
    }
  }

  private catchTransactionTimeout(
    exception: Prisma.PrismaClientKnownRequestError,
    response: Response,
    request: ErrorRequest,
  ) {
    const status = HttpStatus.GATEWAY_TIMEOUT;
    const meta = exception.meta as
      { timeout?: unknown; timeTaken?: unknown } | undefined;
    const timeout = meta?.timeout ?? 5000;
    const timeTaken = meta?.timeTaken ?? 'unknown';

    response.status(status).json(
      createErrorResponse({
        statusCode: status,
        message:
          'Transaction timeout: The operation took too long to complete. Please try again with a smaller batch size or contact support if the problem persists.',
        path: getRequestPath(request),
        code: 'P2028',
        details: {
          prismaCode: 'P2028',
          timeoutMs: timeout,
          timeTakenMs: timeTaken,
          suggestion:
            'Consider increasing the interactive transaction timeout or doing less work in the transaction.',
        },
      }),
    );
  }

  private send(
    response: Response,
    request: ErrorRequest,
    statusCode: number,
    message: string,
  ): void {
    response.status(statusCode).json(
      createErrorResponse({
        statusCode,
        message,
        path: getRequestPath(request),
      }),
    );
  }

  private extractField(
    exception: Prisma.PrismaClientKnownRequestError,
  ): string {
    const meta = exception.meta;

    if (!meta) return 'unknown_field';

    // P2002: Unique constraint failed
    if (meta.target) {
      if (Array.isArray(meta.target)) {
        return meta.target.join(', ');
      }
      return String(meta.target);
    }

    // P2003: Foreign key constraint failed
    // meta.field_name might be like "MOvertimeApprovalFlow_CostCenterCode_fkey (index)"
    if (meta.field_name) {
      const fieldName = String(meta.field_name);
      // Try to extract the field name from the constraint name if it follows the pattern Table_Field_fkey
      // Example: MOvertimeApprovalFlow_CostCenterCode_fkey
      const match = fieldName.match(/_([A-Za-z0-9]+)_fkey/);
      if (match && match[1]) {
        return match[1];
      }
      return fieldName;
    }

    // P2000: Value too long
    if (meta.column_name) {
      return String(meta.column_name);
    }

    return Object.keys(meta).join(', ') || 'unknown_field';
  }
}
