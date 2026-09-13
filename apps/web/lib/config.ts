/**
 * Utility to determine backend and SSO URLs dynamically based on the current host.
 * This allows the app to work seamlessly whether accessed via localhost or an IP address.
 */

/**
 * Utility to determine backend and SSO URLs dynamically based on the current host.
 * This allows the app to work seamlessly whether accessed via localhost or an IP address.
 */

export type ApiVersion = `v${number}`;

const normalizeBackendBaseUrl = (url: string): string => {
  return url.trim().replace(/\/+$/, '').replace(/\/v\d+$/i, '');
};

const validateBackendBaseUrl = (value: string): string => {
  const normalized = normalizeBackendBaseUrl(value);
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error('API_URL must be a valid absolute URL');
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error('API_URL must not contain credentials, query parameters, or fragments');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('API_URL must use HTTP or HTTPS');
  }
  return normalized;
};

export const getBackendBaseUrl = (request?: Request): string => {
  if (process.env.API_URL) {
    return validateBackendBaseUrl(process.env.API_URL);
  }

  // On the client (browser), use window.location
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:7500`;
  }

  // On the server (Next.js API routes), use the Host header from the request
  if (request) {
    const host = request.headers.get('host') || '';
    const hostname = host.split(':')[0] || 'localhost';
    return `http://${hostname}:7500`;
  }

  // Fallback if environment variable is somehow missed
  return 'http://localhost:7500';
};

/**
 * Returns the dynamic versioned API base URL.
 * Defaults to v1 so existing API service calls remain backward compatible.
 */
export const getApiUrl = (
  apiVersionOrRequest?: ApiVersion | Request,
  request?: Request
): string => {
  if (typeof apiVersionOrRequest === 'string') {
    return `${getBackendBaseUrl(request)}/${apiVersionOrRequest}`;
  }
  return `${getBackendBaseUrl(apiVersionOrRequest)}/v1`;
};
