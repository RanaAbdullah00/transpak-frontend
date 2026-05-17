import { unwrapErrorDetail } from './unwrapApi.js';

function redactPayload(data) {
  if (!data || typeof data !== 'object' || data instanceof FormData) return data;
  const copy = { ...data };
  for (const key of ['password', 'confirmPassword', 'code', 'token']) {
    if (copy[key] != null) copy[key] = '[redacted]';
  }
  return copy;
}

/** Dev-only structured API failure log (never logs tokens). */
export function logApiFailure(error, config) {
  if (!import.meta.env.DEV) return;
  const method = String(config?.method || 'get').toUpperCase();
  const url = config?.url || '';
  const base = config?.baseURL || '';
  const full = /^https?:\/\//i.test(url) ? url : `${base}${url}`;
  const detail = unwrapErrorDetail(error);
  // eslint-disable-next-line no-console
  console.error('[api] request failed', {
    method,
    endpoint: full,
    status: error?.response?.status,
    payload: redactPayload(config?.data),
    response: error?.response?.data,
    message: detail.displayMessage,
    code: detail.code
  });
}
