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
  return s.replace(/_/g, ' ');
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

/** @param {(k: string) => string} t */
export function translateNotificationType(t, type) {
  if (!type) return '';
  const u = String(type).toUpperCase();
  const key = `notifications.type.${u}`;
  const out = t(key);
  if (out !== key) return out;
  return t('notifications.typeGeneric', { type: u });
}
