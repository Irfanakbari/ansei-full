/*By Irfan Akbari Vuteq Indonesia - 2026-09-09*/
/**
 * Type definitions for API responses and common data structures
 */

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  message?: string;
  total?: number;
  page?: number;
  limit?: number;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  message: string;
  code?: string;
  details?: Record<string, string[]>;
  errors?: Record<string, string[]>;
}

/**
 * Import result from Excel upload
 */
export interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  rows: ImportResultRow[];
}

/**
 * Single row in import result
 */
export interface ImportResultRow {
  row: number;
  status: 'SUCCESS' | 'ERROR';
  message: string;
  data?: Record<string, unknown>;
  errors?: string[];
}

/**
 * Export type for file downloads
 */
export type ExportFormat = 'xlsx' | 'csv' | 'pdf';

/**
 * Query options for list endpoints
 */
export interface ListQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | boolean | undefined | null;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: BulkOperationError[];
}

export interface BulkOperationError {
  id: string | number;
  message: string;
}

/**
 * Export options
 */
export interface ExportOptions {
  format?: ExportFormat;
  filename?: string;
  params?: Record<string, string | number | boolean | undefined | null>;
}

/**
 * Re-export RequestOptions from apiService for convenience
 */
export type { ApiVersion, RequestOptions } from './apiService';
