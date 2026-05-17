import { unwrapErrorDetail } from './unwrapApi.js';
import { dashboardPathForRole } from './dashboardPath.js';

export const AUTH_UNEXPECTED_ERROR = 'Unexpected error occurred. Please try again.';
export const AUTH_NETWORK_ERROR = 'Network error. Try again.';

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
