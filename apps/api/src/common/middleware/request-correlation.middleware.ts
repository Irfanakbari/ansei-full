import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';
export const REQUEST_ID_MAX_LENGTH = 128;

export interface CorrelatedRequest extends Request {
  requestId: string;
}

export function isValidRequestId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= REQUEST_ID_MAX_LENGTH &&
    /^[A-Za-z0-9._:-]+$/.test(value)
  );
}

@Injectable()
export class RequestCorrelationMiddleware implements NestMiddleware {
  use(
    request: CorrelatedRequest,
    response: Response,
    next: NextFunction,
  ): void {
    const suppliedRequestId = request.get(REQUEST_ID_HEADER);
    const requestId = isValidRequestId(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
