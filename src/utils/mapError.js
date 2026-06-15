/**
 * Unified API/runtime error → UI-safe structured error.
 * Priority: code → HTTP status → network type → fallback.
 */
import { formatUserError } from './userErrors.js';
import {
  formatStructuredApiError,
  unwrapErrorCode,
  resolveRequestUrl
} from './unwrapApi.js';

const DEBUG =
  import.meta.env.DEV || String(import.meta.env.VITE_DEBUG || '').toLowerCase() === 'true';

function resolveCategory(err, structured, code, status) {
  const c = String(code || '').toUpperCase();
  if (status === 401 || c === 'AUTH_INVALID' || c === 'UNAUTHORIZED') return 'AUTH';
  if (
    status === 403 ||
    c === 'FORBIDDEN_ROLE' ||
    c === 'FORBIDDEN' ||
    c === 'FORBIDDEN_RESOURCE' ||
    c.startsWith('FORBIDDEN')
  ) {
    return 'ROLE';
  }
  if (status === 422 || c === 'VALIDATION_ERROR') return 'VALIDATION';
  if (status === 503 || c === 'SERVICE_BOOTING' || c === 'DATABASE_UNAVAILABLE' || c === 'DATABASE_TIMEOUT') {
    return 'SERVER';
  }
  if (status >= 500 || c === 'SERVER_ERROR') return 'SERVER';
  if (
    c === 'ERR_NETWORK' ||
    c === 'TIMEOUT' ||
    c === 'NETWORK' ||
    err?.code === 'ERR_NETWORK' ||
    structured?.type === 'NETWORK' ||
    structured?.type === 'TIMEOUT'
  ) {
    return 'NETWORK';
  }
  return 'UNKNOWN';
}

/**
 * @param {unknown} err
 * @param {(key: string) => string} [t]
 * @param {{ fallback?: string }} [options]
 * @returns {{ message: string, code: string|null, status: number|null, category: string, debug?: object }}
 */
export function mapError(err, t, options = {}) {
  const structured = formatStructuredApiError(err);
  const code = unwrapErrorCode(err) || structured.type || null;
  const status = structured.status ?? err?.response?.status ?? null;
  const category = resolveCategory(err, structured, code, status);
  const message = formatUserError(err, t, options);

  const out = {
    message: message || (t ? t('errors.unknown') : 'We could not complete this action. Please try again.'),
    code: code || null,
    status: Number.isFinite(status) ? status : null,
    category
  };

  if (DEBUG) {
    out.debug = {
      endpoint: structured.endpoint || resolveRequestUrl(err?.config) || null,
      status: out.status,
      code: out.code,
      category: out.category,
      rawMessage: String(err?.message || '').slice(0, 500),
      response: err?.response?.data ?? null
    };
  }

  return out;
}

export function isDebugErrorsEnabled() {
  return DEBUG;
}
