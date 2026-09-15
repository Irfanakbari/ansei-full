import { STATUS_CODES } from 'node:http';
import type { ApiErrorResponse } from './api-response.interface';

export function getRequestPath(request: {
  originalUrl?: string;
  url?: string;
}): string {
  return request.originalUrl ?? request.url ?? '';
}

export function getDefaultSuccessMessage(statusCode: number): string {
  if (statusCode === 201) return 'Resource created successfully';
  if (statusCode === 202) return 'Request accepted';
  return 'Request successful';
}

export function createErrorResponse(options: {
  statusCode: number;
  message: string;
  path: string;
  error?: string;
  code?: string;
  details?: unknown;
}): ApiErrorResponse {
  return {
    success: false,
    statusCode: options.statusCode,
    error: options.error ?? STATUS_CODES[options.statusCode] ?? 'Error',
    ...(options.code ? { code: options.code } : {}),
    message: options.message,
    ...(options.details === undefined ? {} : { details: options.details }),
    timestamp: new Date().toISOString(),
    path: options.path,
  };
}
