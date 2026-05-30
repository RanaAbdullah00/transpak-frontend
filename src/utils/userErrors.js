import { unwrapErrorCode, unwrapErrorDetail, formatStructuredApiError } from './unwrapApi.js';
import { translations } from '../i18n/translations.js';

const TECH =
  /insertBefore|removeChild|NotFoundError|HierarchyRequestError|NotSupportedError|Minified React|Invariant Violation/i;

function walkLocale(key, locale) {
  const parts = String(key).split('.').filter(Boolean);
  let cur = translations?.[locale];
  for (const p of parts) {
    cur = cur?.[p];
    if (cur == null) return null;
  }
  return typeof cur === 'string' ? cur : null;
}

/** English fallback when `t` is not available (e.g. useApi). */
export function defaultErrorMessage(key = 'errors.generic') {
  return walkLocale(key, 'en') || 'Something went wrong';
}

function genericMessage(t) {
  return t ? t('errors.generic') : defaultErrorMessage('errors.generic');
}

function networkMessage(t) {
  return t ? t('errors.networkUnreachable') : walkLocale('errors.networkUnreachable', 'en') || genericMessage(t);
}

function serverUnavailableMessage(t) {
  return t ? t('errors.serverUnavailable') : walkLocale('errors.serverUnavailable', 'en') || genericMessage(t);
}

/**
 * Normalize API/network errors for UI: no stacks, no DOM/React internals, bounded length.
 * @param {unknown} err
 * @param {(key: string) => string} [t]
 * @param {{ fallback?: string }} [options] — used when message is empty or redacted
 */
export function formatUserError(err, t, options = {}) {
  const { fallback } = options;

  if (
    err?.code === 'ERR_CANCELED' ||
    err?.name === 'CanceledError' ||
    String(err?.message || '').toLowerCase() === 'canceled'
  ) {
    return fallback ?? '';
  }

  const structured = formatStructuredApiError(err);
  if (structured.message) {
    const { endpoint, status, type } = structured;
    if (endpoint || status != null || type) {
      const statusPart = status != null ? ` (HTTP ${status})` : '';
      const prefix = endpoint ? `${type}: ${endpoint}${statusPart}` : `${type}:`;
      if (structured.message.includes(endpoint) || structured.message.includes(String(status))) {
        return structured.message;
      }
      return `${prefix} — ${structured.message}`;
    }
    return structured.message;
  }

  const apiCode = unwrapErrorCode(err);
  if (apiCode === 'COUNTER_LIMIT_REACHED' && t) {
    return t('errors.counterLimitReached');
  }
  if (apiCode === 'PROFILE_INCOMPLETE' && t) {
    return t('pages.loads.profileRequiredBody');
  }
  if (apiCode === 'SCHEMA_OUTDATED' && t) {
    return t('errors.databaseUnavailable');
  }
  if (apiCode === 'ADMIN_SESSION_REQUIRED' && t) {
    return t('errors.adminSessionRequired');
  }
  if (apiCode === 'ADMIN_COMMERCIAL_FORBIDDEN' && t) {
    return t('errors.adminCommercialForbidden');
  }

  const { displayMessage, message } = unwrapErrorDetail(err);
  const rawUnwrap = displayMessage || message;
  const status = err?.response?.status;
  if ((status === 502 || status === 504) && !message) {
    return serverUnavailableMessage(t);
  }

  const raw = String(rawUnwrap || err?.message || '').trim();
  if (!raw) return fallback ?? genericMessage(t);

  if (TECH.test(raw) || raw.length > 240) return fallback ?? message ?? genericMessage(t);

  return raw;
}
