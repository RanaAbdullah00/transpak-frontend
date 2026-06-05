import axios from 'axios';
import { getApiRoot, API_BASE, resolveViteApiOrigin } from '../config/apiConfig.js';
import { notifyApiError } from '../utils/notifySystem.js';
import { unwrapErrorDetail, formatStructuredApiError } from '../utils/unwrapApi.js';
import { logApiFailure } from '../utils/apiDevLog.js';
import { logApiRequest, logApiResponse, logApiError } from '../utils/apiRequestLog.js';
import { getAuthToken } from '../utils/authTokenStorage.js';
import { createTrackedSignal } from '../utils/inflightRequests.js';
import { dispatchAuthUnauthorized } from '../utils/authUnauthorized.js';
import { readWorkspaceContext } from '../utils/workspaceContext.js';
const BASE_URL = getApiRoot();

const ALLOWED_API_PREFIXES = [
  '/auth',
  '/profile',
  '/shipments',
  '/loads',
  '/bids',
  '/fare',
  '/maps',
  '/carrier-space',
  '/operations',
  '/admin',
  '/reviews',
  '/ratings',
  '/notifications',
  '/feedback',
  '/chat',
  '/trucks',
  '/demo-video',
  '/disputes',
  '/translations',
  '/upload',
  '/public',
  '/health'
];

const AUTH_DEBUG =
  import.meta.env.DEV || String(import.meta.env.VITE_AUTH_API_DEBUG || '').toLowerCase() === 'true';

function assertProductionApiTarget(config) {
  if (import.meta.env.DEV) return;
  const base = String(config.baseURL || BASE_URL || '');
  if (/localhost|127\.0\.0\.1/i.test(base)) {
    throw new Error('Production build cannot call localhost API — set VITE_API_URL to Render URL');
  }
}

function assertAllowedEndpoint(url) {
  const path = String(url || '').split('?')[0];
  if (!path || path === '/health') return;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const ok = ALLOWED_API_PREFIXES.some((p) => normalized === p || normalized.startsWith(`${p}/`));
  if (!ok && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn('[api] Unlisted endpoint (verify backend route exists):', normalized);
  }
}

function fullUrl(config) {
  const url = config.url || '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${String(config.baseURL || '').replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
}

function handleApiFailure(error, config) {
  if (isCanceledError(error)) return;
  logApiFailure(error, config);
  if (config?.skipGlobalErrorToast) return;
  notifyApiError(error);
}

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS || 45000),
  headers: {
    'Content-Type': 'application/json'
  },
});

function isCanceledError(error) {
  return (
    error?.code === 'ERR_CANCELED' ||
    error?.name === 'CanceledError' ||
    error?.message === 'canceled'
  );
}

api.interceptors.request.use((config) => {
  assertProductionApiTarget(config);
  assertAllowedEndpoint(config.url);

  const token = getAuthToken();
  const path = String(config.url || '');
  const isAuthEndpoint = /\/auth(\/|$)/i.test(path);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (!isAuthEndpoint && AUTH_DEBUG) {
    // eslint-disable-next-line no-console
    console.warn('[api] no auth token for protected request:', fullUrl(config));
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  if (!config.signal) {
    config.signal = createTrackedSignal();
  }

  const wsCtx = readWorkspaceContext();
  const owner = typeof window !== 'undefined' ? sessionStorage.getItem('transpak_session_owner') : null;
  if (wsCtx?.userId && owner && owner === wsCtx.userId) {
    config.headers['X-TransPak-User-Id'] = wsCtx.userId;
    if (wsCtx.workspace) {
      config.headers['X-TransPak-Workspace'] = wsCtx.workspace;
    }
    const method = String(config.method || 'get').toUpperCase();
    if (method === 'GET' || method === 'DELETE') {
      config.params = {
        user_id: wsCtx.userId,
        workspace: wsCtx.workspace,
        ...(wsCtx.workspace === 'shipper' || wsCtx.workspace === 'carrier'
          ? { viewAs: wsCtx.workspace }
          : {}),
        ...(config.params || {})
      };
    }
  }

  const method = String(config.method || 'get').toUpperCase();
  const resolved = fullUrl(config);
  const isAuth = /\/api\/auth(\/|$)/i.test(resolved) || /\/auth(\/|$)/i.test(config.url || '');

  if (isAuth && import.meta.env.DEV && !/^https?:\/\//i.test(config.url || '') && String(config.url || '').startsWith('/')) {
    // eslint-disable-next-line no-console
    console.error('[api] relative auth path bypasses authService — use authService.js only:', resolved);
  }

  if (isAuth && AUTH_DEBUG) {
    const payload =
      config.data && typeof config.data === 'object' && !(config.data instanceof FormData)
        ? { ...config.data }
        : config.data;
    if (payload && typeof payload === 'object') {
      for (const key of ['password', 'confirmPassword', 'code']) {
        if (payload[key] != null) payload[key] = '[redacted]';
      }
    }
    // eslint-disable-next-line no-console
    console.log('[api] auth request', { method, url: resolved, payload });
  }

  logApiRequest(config);

  return config;
});

api.interceptors.response.use(
  (response) => {
    logApiResponse(response.config, response);
    const body = response.data;
    if (body && typeof body.success === 'boolean') {
      if (body.success === false) {
        const err = new Error(body.message || 'Request failed');
        err.response = { status: response.status, data: body };
        err.config = response.config;
        handleApiFailure(err, response.config);
        return Promise.reject(err);
      }
      if ('data' in body) {
        return { ...response, data: body.data };
      }
    }
    return response;
  },
  (error) => {
    logApiError(error, error.config);
    if (!error.response && error.code === 'ERR_NETWORK') {
      const detail = unwrapErrorDetail(error);
      error.message = detail.displayMessage || error.message;
      // eslint-disable-next-line no-console
      console.error('[api] network failure', {
        url: detail.endpoint || fullUrl(error.config || {}),
        base: BASE_URL,
        viteApiUrl: import.meta.env.VITE_API_URL,
        errorType: detail.errorType || detail.code
      });
    }
    const body = error.response?.data;
    if (body && typeof body === 'object') {
      if (!body.code && typeof body.error === 'string') {
        body.code = body.error;
      }
      const msg =
        typeof body.message === 'string' && body.message.trim()
          ? body.message.trim()
          : typeof body.error === 'string'
            ? body.error.trim()
            : '';
      if (msg) {
        error.message =
          body.code && !msg.includes(body.code) ? `${msg} (${body.code})` : msg;
      }
    }
    if (
      error.response?.status === 401 &&
      !error.config?.skipAuthRefresh &&
      !isCanceledError(error)
    ) {
      const path = String(error.config?.url || '');
      const isAuthEndpoint = /\/auth(\/|$)/i.test(path);
      if (!isAuthEndpoint && getAuthToken()) {
        dispatchAuthUnauthorized();
      }
    }
    error.structured = formatStructuredApiError(error);
    if (!isCanceledError(error)) {
      handleApiFailure(error, error.config || {});
    }
    return Promise.reject(error);
  }
);

export { API_BASE, BASE_URL };
export default api;
