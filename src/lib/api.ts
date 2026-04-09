const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 45000);
const REFRESH_TIMEOUT_MS = Number(import.meta.env.VITE_API_REFRESH_TIMEOUT_MS || 15000);
const LONG_TIMEOUT_MS = Number(import.meta.env.VITE_API_LONG_TIMEOUT_MS || 120000);
const DEFAULT_RATE_LIMIT_BACKOFF_MS = Number(import.meta.env.VITE_API_RATE_LIMIT_BACKOFF_MS || 15000);
const MAX_RATE_LIMIT_BACKOFF_MS = Number(import.meta.env.VITE_API_RATE_LIMIT_BACKOFF_MAX_MS || 180000);

let interceptorInstalled = false;
let refreshInFlight: Promise<boolean> | null = null;
const rateLimitedUntilByKey = new Map<string, number>();
const rateLimitStrikeCountByKey = new Map<string, number>();

const nativeFetch = window.fetch.bind(window);

const AUTH_REFRESH_ENDPOINT = '/api/auth/refresh';

function normalizeUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function normalizeApiPath(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname
      .replace(/\/\d+(?=\/|$)/g, '/:id')
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:id');
  } catch {
    const withoutOrigin = API_URL && url.startsWith(API_URL) ? url.slice(API_URL.length) : url;
    return withoutOrigin
      .split('?')[0]
      .replace(/\/\d+(?=\/|$)/g, '/:id')
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:id');
  }
}

function isApiRequest(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/api/')) return true;
  return !!API_URL && url.startsWith(API_URL);
}

function isAuthEndpoint(url: string): boolean {
  return /\/api\/auth\/(login|register|refresh|logout|verify-email|forgot-password|reset-password)/.test(url);
}

function resolveTimeoutMs(url: string): number {
  // Endpoints with heavier SQL/external calls.
  if (
    /\/api\/search_grants_marketplace$/.test(url) ||
    /\/api\/get_best_matches$/.test(url) ||
    /\/api\/get_entity_awarded_grants/.test(url) ||
    /\/api\/get_entity_minimis_grants/.test(url) ||
    /\/api\/grants\/.+\/concessions$/.test(url) ||
    /\/api\/upload_entity_document$/.test(url) ||
    /\/api\/crm\/corporate-documents\/upload$/.test(url)
  ) {
    return LONG_TIMEOUT_MS;
  }
  return DEFAULT_TIMEOUT_MS;
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof TypeError) return true;
  return false;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return String(init.method).toUpperCase();
  if (input instanceof Request && input.method) return String(input.method).toUpperCase();
  return 'GET';
}

function getRateLimitKey(url: string, method: string): string {
  return `${method}:${normalizeApiPath(url)}`;
}

function isClientCooldownExempt(url: string): boolean {
  const path = normalizeApiPath(url);
  return path === '/api/reco/events' || path === '/api/frontend_log';
}

function canRetryTransportError(url: string, method: string): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
  // Read-only endpoints using POST in this app.
  if (method === 'POST' && /\/api\/search_grants_marketplace$/.test(url)) return true;
  return false;
}

function hasInvalidBearerHeader(headers: Headers): boolean {
  const auth = headers.get('Authorization');
  if (!auth) return false;
  const normalized = auth.trim().toLowerCase();
  return (
    normalized === 'bearer null' ||
    normalized === 'bearer undefined' ||
    normalized === 'bearer' ||
    normalized === 'null' ||
    normalized === 'undefined' ||
    normalized === ''
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function parseRetryAfterMs(response: Response): number | null {
  const retryAfter = response.headers.get('Retry-After');
  if (!retryAfter) return null;

  const asSeconds = Number(retryAfter);
  if (Number.isFinite(asSeconds) && asSeconds > 0) {
    return Math.min(asSeconds * 1000, MAX_RATE_LIMIT_BACKOFF_MS);
  }

  const asDate = new Date(retryAfter);
  if (Number.isNaN(asDate.getTime())) return null;
  const delta = asDate.getTime() - Date.now();
  if (delta <= 0) return null;
  return Math.min(delta, MAX_RATE_LIMIT_BACKOFF_MS);
}

function computeBackoffWithoutRetryAfterMs(key: string): number {
  const strikes = rateLimitStrikeCountByKey.get(key) ?? 0;
  const multiplier = 2 ** Math.min(strikes, 4);
  return Math.min(DEFAULT_RATE_LIMIT_BACKOFF_MS * multiplier, MAX_RATE_LIMIT_BACKOFF_MS);
}

function setEndpointRateLimit(key: string, waitMs: number, fromRetryAfter: boolean): void {
  if (fromRetryAfter) {
    rateLimitStrikeCountByKey.set(key, Math.max(0, (rateLimitStrikeCountByKey.get(key) ?? 0) - 1));
  } else {
    rateLimitStrikeCountByKey.set(key, Math.min((rateLimitStrikeCountByKey.get(key) ?? 0) + 1, 6));
  }

  const bounded = Math.min(Math.max(waitMs, 250), MAX_RATE_LIMIT_BACKOFF_MS);
  const nextWindow = Date.now() + bounded;
  const currentWindow = rateLimitedUntilByKey.get(key) ?? 0;
  if (nextWindow > currentWindow) {
    rateLimitedUntilByKey.set(key, nextWindow);
  }
}

function createLocalRateLimitedResponse(waitMs: number): Response {
  const retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));
  return new Response(
    JSON.stringify({
      error: 'rate_limited',
      message: 'Too many requests. Please retry shortly.',
      retry_after: retryAfterSeconds,
    }),
    {
      status: 429,
      statusText: 'Too Many Requests',
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Source': 'client-cooldown',
      },
    },
  );
}

function withTimeout(init: RequestInit = {}, timeout = DEFAULT_TIMEOUT_MS): { init: RequestInit; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(`timeout:${timeout}`), timeout);

  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort(init.signal.reason);
    } else {
      init.signal.addEventListener('abort', () => controller.abort(init.signal?.reason), { once: true });
    }
  }

  return {
    init: { ...init, signal: controller.signal },
    cleanup: () => window.clearTimeout(timeoutId),
  };
}

function collectHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  const headers = new Headers();

  if (input instanceof Request) {
    input.headers.forEach((value, key) => headers.set(key, value));
  }

  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }

  return headers;
}

function invalidateClientSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userData');
  window.dispatchEvent(new Event('auth:session-invalidated'));
}

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const currentRefreshToken = localStorage.getItem('refreshToken');
    if (!currentRefreshToken) {
      invalidateClientSession();
      return false;
    }

    const refreshUrl = API_URL ? `${API_URL}${AUTH_REFRESH_ENDPOINT}` : AUTH_REFRESH_ENDPOINT;
    const { init: timeoutInit, cleanup } = withTimeout({
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentRefreshToken}`,
        'Content-Type': 'application/json',
      },
    }, REFRESH_TIMEOUT_MS);

    try {
      const response = await nativeFetch(refreshUrl, timeoutInit);
      if (!response.ok) {
        // If another tab rotated the token, keep the current session state.
        const latestRefreshToken = localStorage.getItem('refreshToken');
        if (response.status === 401 && latestRefreshToken && latestRefreshToken !== currentRefreshToken) {
          return true;
        }

        if (response.status === 401 || response.status === 403) {
          invalidateClientSession();
        }
        return false;
      }

      const data = await response.json();
      if (!data?.access_token || !data?.refresh_token) {
        return false;
      }

      localStorage.setItem('accessToken', data.access_token);
      localStorage.setItem('refreshToken', data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      cleanup();
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function fetchApiWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = normalizeUrl(input);
  const timeoutMs = resolveTimeoutMs(url);
  const method = requestMethod(input, init);
  const rateLimitKey = getRateLimitKey(url, method);
  const allowTransportRetry = canRetryTransportError(url, method);
  const remainingCooldownMs = (rateLimitedUntilByKey.get(rateLimitKey) ?? 0) - Date.now();
  if (remainingCooldownMs > 0 && !isAuthEndpoint(url) && !isClientCooldownExempt(url)) {
    return createLocalRateLimitedResponse(remainingCooldownMs);
  }

  const headers = collectHeaders(input, init);

  if (hasInvalidBearerHeader(headers)) {
    headers.delete('Authorization');
  }

  if (!headers.has('Authorization') && !isAuthEndpoint(url)) {
    let accessToken = localStorage.getItem('accessToken');
    if (!accessToken && localStorage.getItem('refreshToken')) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        accessToken = localStorage.getItem('accessToken');
      }
    }

    if (accessToken && accessToken !== 'null' && accessToken !== 'undefined') {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  const firstAttemptInit: RequestInit = {
    ...init,
    headers,
  };

  const { init: timedFirstAttemptInit, cleanup: cleanupFirstAttempt } = withTimeout(firstAttemptInit, timeoutMs);
  let response: Response;
  try {
    response = await nativeFetch(input, timedFirstAttemptInit);
  } catch (error) {
    if (!allowTransportRetry || !isRetryableNetworkError(error)) {
      throw error;
    }

    const retryHeaders = collectHeaders(input, init);
    const tokenForRetry = localStorage.getItem('accessToken');
    if (tokenForRetry && !isAuthEndpoint(url)) {
      retryHeaders.set('Authorization', `Bearer ${tokenForRetry}`);
    }
    const transportRetryInit: RequestInit = {
      ...init,
      headers: retryHeaders,
    };
    const { init: timedTransportRetryInit, cleanup: cleanupTransportRetry } = withTimeout(transportRetryInit, timeoutMs);
    try {
      response = await nativeFetch(input, timedTransportRetryInit);
    } finally {
      cleanupTransportRetry();
    }
  } finally {
    cleanupFirstAttempt();
  }

  if (response.status !== 401 || isAuthEndpoint(url)) {
    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(response);
      const waitMs = retryAfterMs ?? computeBackoffWithoutRetryAfterMs(rateLimitKey);
      if (!isClientCooldownExempt(url)) {
        setEndpointRateLimit(rateLimitKey, waitMs, retryAfterMs !== null);
      }
      return response;
    }

    if (response.ok || response.status < 400) {
      rateLimitStrikeCountByKey.delete(rateLimitKey);
      rateLimitedUntilByKey.delete(rateLimitKey);
    }

    if (response.status >= 500 && allowTransportRetry) {
      await sleep(350);
      const retryHeaders = collectHeaders(input, init);
      if (hasInvalidBearerHeader(retryHeaders)) {
        retryHeaders.delete('Authorization');
      }
      const retryToken = localStorage.getItem('accessToken');
      if (retryToken && retryToken !== 'null' && retryToken !== 'undefined' && !isAuthEndpoint(url)) {
        retryHeaders.set('Authorization', `Bearer ${retryToken}`);
      }
      const retryOn5xxInit: RequestInit = {
        ...init,
        headers: retryHeaders,
      };
      const { init: timedRetryOn5xxInit, cleanup: cleanupRetryOn5xx } = withTimeout(retryOn5xxInit, timeoutMs);
      try {
        return await nativeFetch(input, timedRetryOn5xxInit);
      } finally {
        cleanupRetryOn5xx();
      }
    }
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    return response;
  }

  const retryHeaders = collectHeaders(input, init);
  const newAccessToken = localStorage.getItem('accessToken');
  if (newAccessToken && !isAuthEndpoint(url)) {
    retryHeaders.set('Authorization', `Bearer ${newAccessToken}`);
  }

  const retryInit: RequestInit = {
    ...init,
    headers: retryHeaders,
  };

  const { init: timedRetryInit, cleanup: cleanupRetry } = withTimeout(retryInit, timeoutMs);
  try {
    return await nativeFetch(input, timedRetryInit);
  } finally {
    cleanupRetry();
  }
}

export function installApiFetchInterceptor() {
  if (interceptorInstalled) return;
  interceptorInstalled = true;

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = normalizeUrl(input);
    if (!isApiRequest(url)) {
      return nativeFetch(input, init);
    }
    return fetchApiWithRetry(input, init);
  };
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 10000
): Promise<Response> {
  const { init: timeoutInit, cleanup } = withTimeout(options, timeout);
  try {
    return await nativeFetch(url, timeoutInit);
  } finally {
    cleanup();
  }
}
