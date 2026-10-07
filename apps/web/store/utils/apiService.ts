/*By Irfan Akbari Vuteq Indonesia - 2026-09-09*/
/**
 * Centralized API Service
 *
 * Handles all authenticated API calls with:
 * - Automatic token retrieval from httpOnly cookie via /api/proxy
 * - Proxy route passing to backend URL constructed using getApiUrl()
 * - Authorization header injection
 * - Automatic 401 handling with logout
 * - Support for JSON and FormData bodies
 * - Blob download support for Excel exports
 * - Query parameter handling
 * - Timeout handling
 *
 * @example
 * import { get, post, put, del, patch, postFormData } from '@/store/utils/apiService';
 *
 * // GET request (calls /api/proxy/v1/master/material)
 * const data = await get<Material[]>('/master/material');
 */

import type { ApiVersion } from "@/lib/config";
import { withBasePath, withoutBasePath } from "@/lib/base-path";
import { commandIdentity } from "./commandIdentity";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueryParamValue = string | number | boolean | undefined | null;
export type QueryParams = Record<string, QueryParamValue | QueryParamValue[]>;
export type { ApiVersion } from "@/lib/config";

export interface RequestOptions {
  /** API version to use for this request. Defaults to v1. */
  apiVersion?: ApiVersion;
  /** Query parameters to append to URL */
  params?: QueryParams;
  /** Custom headers (Authorization is auto-added) */
  headers?: Record<string, string>;
  /** Response type: 'json' (default) or 'blob' for file downloads */
  responseType?: "json" | "blob";
  /** Request timeout in milliseconds (default: 50000) */
  timeout?: number;
  /** Custom abort signal */
  signal?: AbortSignal;
}

/** Standard success envelope returned by API if applicable. */
export interface ApiSuccessEnvelope<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
  path: string;
}

export interface PaginationMeta extends Record<string, unknown> {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedApiSuccessEnvelope<T> extends ApiSuccessEnvelope<
  T[]
> {
  meta: PaginationMeta;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Unexpected error",
): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * API Error class for structured error handling
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
    public isAuthError: boolean = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Private Helpers ───────────────────────────────────────────────────────────

let isLoggingOut = false;
const AUTH_CHANNEL = "ansei-auth";

function broadcastAuth(event: "refresh-success" | "logout"): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(AUTH_CHANNEL);
  channel.postMessage(event);
  channel.close();
}

if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
  const channel = new BroadcastChannel(AUTH_CHANNEL);
  channel.onmessage = ({ data }: MessageEvent<unknown>) => {
    if (data === "logout" && !isLoggingOut) void handleUnauthorized(false);
  };
}

async function handleUnauthorized(notify = true): Promise<void> {
  if (typeof window === "undefined") return;

  if (isLoggingOut) return;
  isLoggingOut = true;

  try {
    const [{ store }, { clearAuth }] = await Promise.all([
      import("@/store"),
      import("@/store/features/auth/authSlice"),
    ]);
    store.dispatch(clearAuth());

    await fetch(withBasePath("/auth/logout"), {
      method: "POST",
      credentials: "include",
      keepalive: true,
    });
  } catch {}

  if (notify) broadcastAuth("logout");

  window.location.href = withBasePath("/?sessionExpired=true");
}

/**
 * Build full URL with query parameters routed through /api/proxy
 */
function buildUrl(
  path: string,
  params?: QueryParams,
  apiVersion: ApiVersion = "v1",
): string {
  const appendParams = (url: URL) => {
    if (!params) return;
    Object.entries(params).forEach(([key, value]) => {
      const values = Array.isArray(value) ? value : [value];
      values.forEach((item) => {
        if (item !== undefined && item !== null && item !== "") {
          url.searchParams.append(key, String(item));
        }
      });
    });
  };

  if (path.startsWith("http://") || path.startsWith("https://")) {
    throw new ApiError("Absolute API URLs are not allowed", 400);
  }

  // Route browser requests through the same-origin authenticated proxy
  const cleanPath = withoutBasePath(path.startsWith("/") ? path : `/${path}`);
  const fullUrl = withBasePath(`/api/proxy/${apiVersion}${cleanPath}`);

  if (!params || Object.keys(params).length === 0) {
    return fullUrl;
  }

  const url = new URL(fullUrl, window.location.origin);
  appendParams(url);

  return `${url.pathname}${url.search}`;
}

/**
 * Core request handler
 */
async function request<T>(
  method: string,
  path: string,
  options: RequestOptions & { body?: unknown; isFormData?: boolean } = {},
): Promise<T> {
  const {
    apiVersion = "v1",
    params,
    headers = {},
    responseType = "json",
    timeout = 50000,
    signal,
    body,
  } = options;

  const url = buildUrl(path, params, apiVersion);
  const bodyCommand =
    method === "POST" &&
    path === "/production/shopping" &&
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body);
  const commandPayload = bodyCommand
    ? { ...(body as Record<string, unknown>), requestId: undefined }
    : body;
  const protectedCommand =
    method !== "GET" &&
    (bodyCommand ||
      /^\/production\/forecast(?:-non-po)?\/[^/]+\/print-tag$/.test(path) ||
      path.startsWith("/master/bom-revisions") ||
      path === "/production/production-report" ||
      /^\/warehouse\/incoming\/[^/]+\/receive$/.test(path));
  const command = protectedCommand
    ? await commandIdentity(method, url, commandPayload)
    : undefined;
  const outgoingBody =
    bodyCommand && command
      ? {
          ...(commandPayload as Record<string, unknown>),
          requestId: command.id,
        }
      : body;

  const requestHeaders: Record<string, string> = {
    ...headers,
    ...(command ? { "Idempotency-Key": command.id } : {}),
  };
  delete requestHeaders.Authorization;
  delete requestHeaders.authorization;

  // Don't set Content-Type for FormData - browser will set it with boundary
  if (options.isFormData) {
    delete requestHeaders["Content-Type"];
  } else if (body && !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const finalSignal = signal || controller.signal;

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      credentials: "include",
      body: outgoingBody
        ? options.isFormData
          ? (outgoingBody as FormData)
          : JSON.stringify(outgoingBody)
        : undefined,
      signal: finalSignal,
    });

    clearTimeout(timeoutId);

    // Handle 401 Unauthorized
    if (response.status === 401) {
      await handleUnauthorized();
      throw new ApiError(
        "Session expired. Please login again.",
        401,
        undefined,
        true,
      );
    }

    // Handle 403 Forbidden
    if (response.status === 403) {
      throw new ApiError(
        "Access denied. Your account does not have permission to perform this action.",
        403,
        undefined,
      );
    }

    // Handle no content (204)
    if (response.status === 204) {
      return undefined as T;
    }

    // Handle blob responses (file downloads)
    if (responseType === "blob") {
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new ApiError(
          `Download failed: ${response.status} - ${errorText}`,
          response.status,
          { message: errorText },
        );
      }
      return response.blob() as Promise<T>;
    }

    // Handle JSON responses
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data?.message || `Request failed with status ${response.status}`,
        response.status,
        data,
      );
    }

    command?.complete();
    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Request timeout", 408);
    }

    throw error;
  }
}

// ─── Public API Methods ────────────────────────────────────────────────────────

/**
 * GET request
 */
export async function get<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>("GET", path, options);
}

/**
 * POST request with JSON body
 */
export async function post<T, B = unknown>(
  path: string,
  body: B,
  options: Omit<RequestOptions, "body"> = {},
): Promise<T> {
  return request<T>("POST", path, { ...options, body, isFormData: false });
}

export async function postBff<T, B = unknown>(
  path: string,
  body: B,
): Promise<T> {
  const cleanPath = withoutBasePath(path);
  if (!cleanPath.startsWith("/api/") || cleanPath.startsWith("/api/proxy/")) {
    throw new ApiError("Invalid BFF path", 400);
  }
  const bffPath = withBasePath(cleanPath);
  const response = await fetch(bffPath, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      data?.message || "Request failed",
      response.status,
      data,
    );
  return data as T;
}

/**
 * POST request with FormData (multipart/form-data) for file uploads
 */
export async function postFormData<T>(
  path: string,
  formData: FormData,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>("POST", path, {
    ...options,
    body: formData,
    isFormData: true,
  });
}

/**
 * POST request with blob response
 */
export async function postBlob(
  path: string,
  body: unknown,
  options: Omit<RequestOptions, "body"> = {},
): Promise<Blob> {
  return request<Blob>("POST", path, {
    ...options,
    body,
    responseType: "blob",
    isFormData: false,
  });
}

/**
 * PUT request with JSON body
 */
export async function put<T, B = unknown>(
  path: string,
  body: B,
  options: Omit<RequestOptions, "body"> = {},
): Promise<T> {
  return request<T>("PUT", path, { ...options, body, isFormData: false });
}

/**
 * PUT request with FormData
 */
export async function putFormData<T>(
  path: string,
  formData: FormData,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>("PUT", path, {
    ...options,
    body: formData,
    isFormData: true,
  });
}

/**
 * PATCH request with JSON body
 */
export async function patch<T, B = unknown>(
  path: string,
  body: B,
  options: Omit<RequestOptions, "body"> = {},
): Promise<T> {
  return request<T>("PATCH", path, { ...options, body, isFormData: false });
}

/**
 * PATCH request with FormData
 */
export async function patchFormData<T>(
  path: string,
  formData: FormData,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>("PATCH", path, {
    ...options,
    body: formData,
    isFormData: true,
  });
}

/**
 * DELETE request
 */
export async function del<T>(
  path: string,
  options: RequestOptions & { body?: unknown } = {},
): Promise<T> {
  return request<T>("DELETE", path, options);
}

// ─── File Download Utilities ───────────────────────────────────────────────────

/**
 * Download file as blob (for Excel exports, PDFs, etc.)
 */
export async function downloadBlob(
  path: string,
  options: RequestOptions = {},
): Promise<Blob> {
  return get<Blob>(path, { ...options, responseType: "blob" });
}

/**
 * Download file and save with custom filename
 */
export async function downloadFile(
  path: string,
  filename: string,
  options: RequestOptions = {},
): Promise<void> {
  const blob = await downloadBlob(path, options);

  if (!blob || blob.size === 0) {
    throw new Error("Download failed: Empty file received");
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = sanitizeDownloadFilename(filename);
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.URL.revokeObjectURL(url);
  }
}

function sanitizeDownloadFilename(value: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();
  const basename = decoded.split(/[\\/]/).pop() ?? "";
  const sanitized = basename
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 180);
  return sanitized || "download";
}

/**
 * Download file with filename from Content-Disposition header if available
 */
export async function downloadWithAutoFilename(
  path: string,
  options: RequestOptions = {},
): Promise<string | null> {
  const url = buildUrl(path, options.params, options.apiVersion);

  const headers: Record<string, string> = {
    ...options.headers,
  };
  delete headers.Authorization;
  delete headers.authorization;

  const response = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    await handleUnauthorized();
    throw new ApiError("Session expired", 401, undefined, true);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData?.message || "Download failed",
      response.status,
      errorData,
    );
  }

  const blob = await response.blob();

  let filename = "download";
  const contentDisposition = response.headers.get("Content-Disposition");
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(
      /filename[^;=\n]*=(?:(\\?['"])(.*?)\1|([^;\n]*))/i,
    );
    if (filenameMatch?.[2]) {
      filename = filenameMatch[2];
    } else if (filenameMatch?.[3]) {
      filename = filenameMatch[3];
    }
  }

  filename = sanitizeDownloadFilename(filename);
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  try {
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  return filename;
}
