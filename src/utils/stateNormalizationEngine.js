/**
 * Global shipment state normalization — UI MUST NOT hardcode shipment actions.
 * Use getNextAllowedActions() as the sole source for carrier advance buttons.
 */
import {
  normalizeShipmentStatus as normalizeBackendStatus,
  nextShipmentStatus
} from './shipmentStatus.js';

export const CANONICAL_STATES = Object.freeze([
  'POSTED',
  'ACCEPTED',
  'IN_TRANSIT',
  'DELIVERED',
  'CLOSED'
]);

const BACKEND_TO_CANONICAL = Object.freeze({
  posted: 'POSTED',
  booked: 'ACCEPTED',
  pickedup: 'ACCEPTED',
  intransit: 'IN_TRANSIT',
  delivered: 'DELIVERED',
  closed: 'CLOSED'
});

const CANONICAL_TO_BACKEND = Object.freeze({
  POSTED: 'posted',
  ACCEPTED: 'booked',
  IN_TRANSIT: 'intransit',
  DELIVERED: 'delivered',
  CLOSED: 'closed'
});

const CANONICAL_BADGE_VARIANT = Object.freeze({
  POSTED: 'secondary',
  ACCEPTED: 'primary',
  IN_TRANSIT: 'primary',
  DELIVERED: 'success',
  CLOSED: 'secondary'
});

/** Next backend status → single carrier action (one Close only, at delivered→closed). */
const ACTION_BY_NEXT_BACKEND = Object.freeze({
  pickedup: {
    id: 'confirm_pickup',
    labelKey: 'pages.tracking.advanceBooked',
    variant: 'primary'
  },
  intransit: {
    id: 'start_transit',
    labelKey: 'pages.tracking.advanceInTransit',
    variant: 'primary'
  },
  delivered: {
    id: 'mark_delivered',
    labelKey: 'pages.tracking.advanceIntransit',
    variant: 'success'
  },
  closed: {
    id: 'close',
    labelKey: 'pages.tracking.advanceClosed',
    variant: 'secondary'
  }
});

/** Returns uppercase canonical state for UI display. */
export function normalizeShipmentStatus(raw) {
  const backend = normalizeBackendStatus(raw);
  if (!backend) return 'POSTED';
  return BACKEND_TO_CANONICAL[backend] || 'POSTED';
}

/** Reverse map canonical uppercase → default backend lowercase. */
export function toBackendStatus(canonical) {
  const key = String(canonical || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return CANONICAL_TO_BACKEND[key] || 'posted';
}

export function getCanonicalBadgeVariant(canonical) {
  const key = String(canonical || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return CANONICAL_BADGE_VARIANT[key] || 'secondary';
}

/** Badge variant from raw backend/canonical status string. */
export function getBackendBadgeVariant(rawStatus) {
  const canonical = normalizeShipmentStatus(rawStatus);
  return getCanonicalBadgeVariant(canonical);
}

/**
 * @param {string} rawStatus
 * @param {{ role?: string }} [opts]
 * @returns {Array<{ id: string, labelKey: string, nextBackendStatus: string, variant: string, canonical: string }>}
 */
export function getNextAllowedActions(rawStatus, opts = {}) {
  const role = String(opts.role || '').trim().toLowerCase();
  if (role !== 'carrier') return [];

  const backend = normalizeBackendStatus(rawStatus) || 'posted';
  if (backend === 'posted' || backend === 'closed') return [];

  const nextBackend = nextShipmentStatus(backend);
  if (!nextBackend) return [];

  const def = ACTION_BY_NEXT_BACKEND[nextBackend];
  if (!def) return [];

  return [
    {
      id: def.id,
      labelKey: def.labelKey,
      nextBackendStatus: nextBackend,
      variant: def.variant,
      canonical: BACKEND_TO_CANONICAL[backend] || 'POSTED'
    }
  ];
}

/** i18n label key for a target backend status (backward compat for advanceStatusLabelKey). */
export function getActionLabelKey(nextBackendStatus) {
  const backend = normalizeBackendStatus(nextBackendStatus);
  if (!backend) return 'pages.tracking.advanceStatus';
  return ACTION_BY_NEXT_BACKEND[backend]?.labelKey || 'pages.tracking.advanceStatus';
}
