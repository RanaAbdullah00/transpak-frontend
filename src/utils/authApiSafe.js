import { unwrapErrorDetail, unwrapErrorCode } from './unwrapApi.js';
import { dashboardPathForRole } from './dashboardPath.js';

export const AUTH_UNEXPECTED_ERROR = 'Unexpected error occurred. Please try again.';
export const AUTH_NETWORK_ERROR = 'Network error. Try again.';

const TRANSIENT_LOGIN_CODES = new Set([
  'SERVICE_BOOTING',
  'DATABASE_UNAVAILABLE',
  'DATABASE_TIMEOUT',
  'TIMEOUT',
  'ERR_NETWORK',
  'ECONNABORTED'
]);

/** True when login failure may succeed on retry (503, network, boot). */
export function isTransientLoginError(err) {
  const code = String(unwrapErrorCode(err) || err?.code || '').toUpperCase();
  const status = err?.response?.status;
  if (status === 503) return true;
  if (TRANSIENT_LOGIN_CODES.has(code)) return true;
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') return true;
  return false;
}

const LOGIN_AUTO_RETRY_MS = 1500;
const LOGIN_MAX_AUTO_RETRIES = 2;

/**
 * Call login API with bounded auto-retry for transient failures only.
 * @param {(credentials: object) => Promise<unknown>} loginFn
 * @param {object} credentials
 */
export async function loginWithTransientRetry(loginFn, credentials) {
  let lastErr;
  for (let attempt = 0; attempt <= LOGIN_MAX_AUTO_RETRIES; attempt += 1) {
    try {
      return await loginFn(credentials);
    } catch (err) {
      lastErr = err;
      if (!isTransientLoginError(err) || attempt >= LOGIN_MAX_AUTO_RETRIES) {
        throw err;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, LOGIN_AUTO_RETRY_MS));
    }
  }
  throw lastErr;
}

export function safeUnwrapAuthResponse(res) {
  if (!res || res.data == null) return {};
  const raw = res.data;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }
  return {};
}

export function safeDashboardPath(role) {
  if (!role) return '/';
  try {
    return dashboardPathForRole(role) || '/';
  } catch {
    return '/';
  }
}

/**
 * @param {unknown} err
 * @param {(key: string) => string} [t]
 */
export function getAuthUiError(err, t) {
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
    return AUTH_NETWORK_ERROR;
  }
  const { displayMessage, message, code } = unwrapErrorDetail(err);
  const text = String(displayMessage || message || '').trim();
  if (text) return text;
  if (code && code !== 'ERR_NETWORK') return String(code);
  return t?.('errors.unexpectedAuth') || AUTH_UNEXPECTED_ERROR;
}

/** Prevent native form navigation (use on every auth form submit). */
export function blockNativeFormSubmit(e) {
  if (e?.preventDefault) e.preventDefault();
  if (e?.stopPropagation) e.stopPropagation();
}
