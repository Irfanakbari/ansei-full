import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const message = exception.message.replace(/\n/g, '');

    console.error('Prisma Error Code:', exception.code);
    console.error('Prisma Error Message:', message);

    switch (exception.code) {
      case 'P2000': // Input Value too long
        this.catchValueTooLong(exception, response);
        break;
      case 'P2002': // Unique constraint failed
        this.catchUniqueConstraint(exception, response);
        break;
      case 'P2003': // Foreign key constraint failed
        this.catchForeignKeyConstraint(exception, response);
        break;
      case 'P2025': // Record not found
        this.catchNotFound(exception, response);
        break;
      case 'P2028': // Transaction timeout
        this.catchTransactionTimeout(exception, response);
        break;
      default:
        super.catch(exception, host);
        break;
    }
  }

  private catchValueTooLong(
    exception: Prisma.PrismaClientKnownRequestError,
    response: Response,
  ) {
    const status = HttpStatus.BAD_REQUEST;
    const field = this.extractField(exception);
    response.status(status).json({
      success: false,
      statusCode: status,
      message: `The value provided for '${field}' is too long.`,
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
    });
  }

  private catchUniqueConstraint(
    exception: Prisma.PrismaClientKnownRequestError,
    response: Response,
  ) {
    const status = HttpStatus.CONFLICT;
    const field = this.extractField(exception);
    response.status(status).json({
      success: false,
      statusCode: status,
      message: `The value for '${field}' already exists. Please use a unique value.`,
      error: 'Conflict',
      timestamp: new Date().toISOString(),
    });
  }

  private catchForeignKeyConstraint(
    exception: Prisma.PrismaClientKnownRequestError,
    response: Response,
  ) {
    const status = HttpStatus.BAD_REQUEST;
    const field = this.extractField(exception);
    response.status(status).json({
      success: false,
      statusCode: status,
      message: `Invalid reference. The referenced record for '${field}' does not exist.`,
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
    });
  }

  private catchNotFound(
    exception: Prisma.PrismaClientKnownRequestError,
    response: Response,
  ) {
    const status = HttpStatus.NOT_FOUND;
    response.status(status).json({
      success: false,
      statusCode: status,
      message: `The requested record was not found.`,
      error: 'Not Found',
      timestamp: new Date().toISOString(),
    });
  }

  private catchTransactionTimeout(
    exception: Prisma.PrismaClientKnownRequestError,
    response: Response,
  ) {
    const status = HttpStatus.GATEWAY_TIMEOUT;
    const meta = exception.meta as any;
    const timeout = meta?.timeout ?? 5000;
    const timeTaken = meta?.timeTaken ?? 'unknown';

    response.status(status).json({
      success: false,
      statusCode: status,
      message: `Transaction timeout: The operation took too long to complete. Please try again with a smaller batch size or contact support if the problem persists.`,
      error: 'Gateway Timeout',
      details: {
        prismaCode: 'P2028',
        timeoutMs: timeout,
        timeTakenMs: timeTaken,
        suggestion:
          'Consider increasing the interactive transaction timeout or doing less work in the transaction.',
      },
      timestamp: new Date().toISOString(),
    });
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
