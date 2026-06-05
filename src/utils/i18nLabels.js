import { normalizeShipmentStatus } from './shipmentStatus.js';

const STATUS_BY_CANON = {
  posted: 'status.posted',
  booked: 'status.booked',
  pickedup: 'status.pickedup',
  intransit: 'status.intransit',
  delivered: 'status.delivered',
  closed: 'status.closed'
};

/** @param {(k: string) => string} t */
export function translateShipmentOrLoadStatus(t, raw) {
  const canon = normalizeShipmentStatus(raw);
  if (canon && STATUS_BY_CANON[canon]) return t(STATUS_BY_CANON[canon]);
  const slug = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  const direct = `status.${slug}`;
  const tryDirect = t(direct);
  if (tryDirect !== direct) return tryDirect;
  const noUnderscore = slug.replace(/_/g, '');
  const altKey = `status.${noUnderscore}`;
  const tryAlt = t(altKey);
  if (tryAlt !== altKey) return tryAlt;
  return String(raw || '')
    .replace(/_/g, ' ')
    .trim() || t('status.unknown');
}

/** @param {(k: string) => string} t */
export function translateBidStatus(t, raw) {
  const s = String(raw || '')
    .toLowerCase()
    .trim();
  if (!s) return t('status.unknown');
  const key = `bidStatus.${s}`;
  const out = t(key);
  if (out !== key) return out;
  return t('status.unknown');
}

/** @param {(k: string) => string} t */
export function translateSpaceRequestStatus(t, raw) {
  const s = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  if (!s) return t('status.unknown');
  const key = `spaceStatus.${s}`;
  const out = t(key);
  if (out !== key) return out;
  return t('status.unknown');
}

/** @param {(k: string) => string} t */
export function translateRoleLabel(t, role) {
  if (role == null || String(role).trim() === '') return t('notifications.rolePlatform');
  const r = String(role).toLowerCase().trim();
  if (r === 'shipper') return t('auth.shipper');
  if (r === 'carrier') return t('auth.carrier');
  if (r === 'admin') return t('common.admin');
  return t('notifications.rolePlatform');
}

const INTERNAL_DISPATCH_RE = /^[A-Z][A-Z0-9_]{2,}$/;

/** True when text looks like an internal socket/API dispatch label — not for UI. */
export function isInternalDispatchLabel(text) {
  return INTERNAL_DISPATCH_RE.test(String(text || '').trim());
}

/** @param {(k: string) => string} t */
export function translateNotificationType(t, type) {
  if (!type) return '';
  const u = String(type).toUpperCase();
  const key = `notifications.type.${u}`;
  const out = t(key);
  if (out !== key) return out;
  return t('notifications.typeGeneric');
}

/**
 * User-safe notification copy — strips dispatch codes and technical titles.
 * @param {(k: string) => string} t
 */
export function notificationUILabels(t, notification = {}) {
  const dispatchType = String(
    notification.dispatchType || notification.type || ''
  ).toUpperCase();
  const typeLabel = dispatchType ? translateNotificationType(t, dispatchType) : '';
  const rawTitle = String(notification.title || '').trim();
  const rawMessage = String(notification.message || '').trim();

  let title = rawTitle;
  if (
    !title ||
    isInternalDispatchLabel(title) ||
    title.toUpperCase() === dispatchType
  ) {
    title = typeLabel || t('notifications.toastNew');
  }

  let message = rawMessage;
  if (
    !message ||
    isInternalDispatchLabel(message) ||
    message.toUpperCase() === dispatchType ||
    message === rawTitle
  ) {
    message = typeLabel && typeLabel !== title ? typeLabel : '';
  }

  return { title, message };
}
