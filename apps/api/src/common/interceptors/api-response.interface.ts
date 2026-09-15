export type ApiResponseMeta = Record<string, unknown>;

export interface PaginationMeta extends ApiResponseMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiResult<T, TMeta extends ApiResponseMeta = ApiResponseMeta> {
  data: T;
  meta: TMeta;
}

export interface ApiSuccessResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T | null;
  meta?: ApiResponseMeta;
  timestamp: string;
  path: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  error: string;
  code?: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path: string;
}
