/*By Irfan Akbari Vuteq Indonesia - 2026-09-09*/
/**
 * Centralized API utilities
 *
 * @example
 * import { get, post, put, del, patch, postFormData, ApiError } from '@/store/utils';
 */

// Re-export apiService methods
export {
  get,
  post,
  put,
  del,
  patch,
  postFormData,
  putFormData,
  patchFormData,
  postBlob,
  postBff,
  downloadBlob,
  downloadFile,
  downloadWithAutoFilename,
  ApiError,
  getApiErrorMessage,
} from './apiService';

export type {
  ApiVersion,
  RequestOptions,
  QueryParams,
  ApiSuccessEnvelope,
} from './apiService';

// Re-export types
export {
  type ApiResponse,
  type PaginatedResponse,
  type ApiErrorResponse,
  type ImportResult,
  type ImportResultRow,
  type ExportFormat,
  type ListQueryOptions,
  type PaginationMeta,
  type BulkOperationResult,
  type BulkOperationError,
  type ExportOptions,
} from './types';
