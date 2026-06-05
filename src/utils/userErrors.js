import { unwrapErrorCode, unwrapErrorDetail, formatStructuredApiError } from './unwrapApi.js';
import { translations } from '../i18n/translations.js';
import { isInternalDispatchLabel } from './i18nLabels.js';

const TECH =
  /insertBefore|removeChild|NotFoundError|HierarchyRequestError|NotSupportedError|Minified React|Invariant Violation/i;

const UI_BLOCKED_RE =
  /https?:\/\/|\/api\/|\/v1\/|VITE_|CORS|socket\.io|migration|Render|Cloudflare|npm run|HTTP\s*\d{3}|Timeout contacting|Network\/CORS|endpoint|AUTH:|SERVER:|TIMEOUT:|FORBIDDEN:|unwrap|schema outdated|Request failed \(/i;

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
 * Strip system/technical text before any UI render.
 */
export function sanitizeProductText(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (TECH.test(raw) || raw.length > 240) return '';
  if (isInternalDispatchLabel(raw)) return '';
  if (UI_BLOCKED_RE.test(raw)) return '';
  const withoutCode = raw.replace(/\s*\([A-Z][A-Z0-9_]{2,}\)\s*$/, '').trim();
  if (withoutCode && withoutCode !== raw) {
    if (!UI_BLOCKED_RE.test(withoutCode) && !isInternalDispatchLabel(withoutCode)) return withoutCode;
    return '';
  }
  return raw;
}

function resolveUserMessage(text, t, fallback) {
  const sanitized = sanitizeProductText(text);
  return sanitized || fallback || genericMessage(t);
}

function messageFromStructured(structured, t, fallback) {
  const sanitized = sanitizeProductText(structured?.message);
  if (sanitized) return sanitized;
  const status = structured?.status;
  if (status === 502 || status === 504) return serverUnavailableMessage(t);
  const type = String(structured?.type || '').toUpperCase();
  if (type === 'NETWORK' || type === 'TIMEOUT' || type === 'CORS') return networkMessage(t);
  return fallback ?? genericMessage(t);
}

/**
 * Normalize API/network errors for UI: no stacks, endpoints, HTTP codes, or infra text.
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
    return messageFromStructured(structured, t, fallback);
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
  const status = err?.response?.status;
  if ((status === 502 || status === 504) && !message) {
    return serverUnavailableMessage(t);
  }

  return resolveUserMessage(displayMessage || message || err?.message, t, fallback);
}
