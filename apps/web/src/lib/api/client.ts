/**
 * NEIMAN API Client
 * Central HTTP client for all NEIMAN backend calls with:
 * - Automatic in-flight request deduplication for idempotent GET queries
 * - In-memory LRU-like TTL caching to eliminate burst redundant requests
 * - Reads token from auth store automatically
 */

import { getApiBaseUrl, NEIMAN_CONFIG } from '@neiman/config';
import { isDevelopmentAuthBypassEnabled } from '@/lib/authPreview';
import { getPreviewApiResponse } from './previewFixtures';

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Token getter — injected so we don't import the store server-side
let _getToken: (() => string | null) | null = null;

export function configureApiClient(getToken: () => string | null) {
  _getToken = getToken;
}

// In-flight GET request deduplication map
const inflightRequests = new Map<string, Promise<unknown>>();

// Short-lived memory cache for GET requests
interface CacheEntry {
  data: unknown;
  expiresAt: number;
}
const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = NEIMAN_CONFIG.TELEMETRY.API_CACHE_TTL_MS;

export function invalidateApiCache(pathPrefix?: string) {
  if (!pathPrefix) {
    queryCache.clear();
    return;
  }
  queryCache.forEach((_, key) => {
    if (key.includes(pathPrefix)) {
      queryCache.delete(key);
    }
  });
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();

  // In dev / local bypass mode, route synthetic preview company requests to preview fixtures
  if (isDevelopmentAuthBypassEnabled() && (path.includes('preview-company-NEIMAN') || path === '/api/v1/companies/me')) {
    if (method !== 'GET') {
      throw new ApiError(403, { preview: true, read_only: true }, 'Local UI preview is read-only. This action was not sent to the API.');
    }
    const fixture = getPreviewApiResponse(path);
    if (fixture === undefined) {
      throw new ApiError(501, { preview: true, fixture_available: false }, `No synthetic preview fixture is available for ${path}. No API request was sent.`);
    }
    return fixture as T;
  }

  const token = _getToken?.();

  // Deduplication & cache key for GET requests
  const cacheKey = `${token || 'anon'}:${method}:${path}`;

  if (method === 'GET') {
    const cached = queryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    if (inflightRequests.has(cacheKey)) {
      return inflightRequests.get(cacheKey) as Promise<T>;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchPromise = (async () => {
    try {
      const baseUrl = getApiBaseUrl().replace(/\/$/, '');
      const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
      });

      if (!res.ok) {
        let data: unknown = null;
        try {
          data = await res.json();
        } catch {
          data = { detail: res.statusText };
        }
        const errorBody = data as { detail?: string; message?: string } | null;
        const detail = errorBody?.detail ?? errorBody?.message ?? `API Error: ${res.status}`;
        throw new ApiError(res.status, data, detail);
      }

      if (res.status === 204) return undefined as T;
      const json = await res.json();

      if (method === 'GET') {
        queryCache.set(cacheKey, {
          data: json,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      } else {
        // Any mutation invalidates cache
        invalidateApiCache();
      }

      return json as T;
    } finally {
      if (method === 'GET') {
        inflightRequests.delete(cacheKey);
      }
    }
  })();

  if (method === 'GET') {
    inflightRequests.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
