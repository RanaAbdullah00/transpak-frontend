import { getApiRoot } from '../config/apiConfig.js';
import { unwrapErrorDetail } from './unwrapApi.js';

const ENABLED =
  import.meta.env.DEV || String(import.meta.env.VITE_API_DEBUG || '').toLowerCase() === 'true';

function redact(data) {
  if (!data || typeof data !== 'object' || data instanceof FormData) {
    return data instanceof FormData ? '[FormData]' : data;
  }
  const copy = { ...data };
  for (const key of ['password', 'confirmPassword', 'code', 'token']) {
    if (copy[key] != null) copy[key] = '[redacted]';
  }
  return copy;
}

function resolveUrl(config) {
  const url = String(config?.url || '');
  if (/^https?:\/\//i.test(url)) return url;
  const base = String(config?.baseURL || getApiRoot()).replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

export function logApiRequest(config) {
  if (!ENABLED) return;
  const method = String(config?.method || 'get').toUpperCase();
  // eslint-disable-next-line no-console
  console.info('[api] →', method, resolveUrl(config), {
    base: getApiRoot(),
    payload: redact(config?.data)
  });
}

export function logApiResponse(config, response) {
  if (!ENABLED) return;
  const method = String(config?.method || 'get').toUpperCase();
  const status = response?.status;
  const preview =
    response?.data && typeof response.data === 'object'
      ? Array.isArray(response.data)
        ? `[array:${response.data.length}]`
        : '[object]'
      : response?.data;
  // eslint-disable-next-line no-console
  console.info('[api] ←', status, method, resolveUrl(config), preview);
}

export function logApiError(error, config) {
  const method = String(config?.method || error?.config?.method || 'get').toUpperCase();
  const url = resolveUrl(config || error?.config || {});
  const detail = unwrapErrorDetail(error);
  const respHeaders = error?.response?.headers;
  let responseHeaders = null;
  if (respHeaders) {
    responseHeaders =
      typeof respHeaders.toJSON === 'function'
        ? respHeaders.toJSON()
        : { ...respHeaders };
  }
  const entry = {
    method,
    url,
    status: error?.response?.status ?? null,
    networkCode: error?.code ?? null,
    code: detail.code,
    message: detail.displayMessage,
    response: error?.response?.data,
    responseHeaders
  };
  // Always log failed API calls in production for CORS / connectivity debugging.
  // eslint-disable-next-line no-console
  console.error('[api] ✕', entry);
}
