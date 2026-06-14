import { normalizeShipmentStatus as normalizeBackendStatus } from './shipmentStatus.js';

export const STATUS_SEMANTIC = Object.freeze({
  POSTED: 'posted',
  ACTIVE: 'active',
  ACCEPTED: 'accepted',
  IN_TRANSIT: 'in_transit',
  COMPLETED: 'completed',
  DELIVERED: 'delivered',
  REQUEST_SENT: 'request_sent',
  CANCELLED: 'cancelled',
  CLOSED: 'closed',
  REJECTED: 'rejected',
  EXPIRED: 'expired'
});

const CANONICAL_TO_SEMANTIC = Object.freeze({
  POSTED: STATUS_SEMANTIC.POSTED,
  ACCEPTED: STATUS_SEMANTIC.ACCEPTED,
  IN_TRANSIT: STATUS_SEMANTIC.IN_TRANSIT,
  DELIVERED: STATUS_SEMANTIC.COMPLETED,
  CLOSED: STATUS_SEMANTIC.CLOSED
});

const BACKEND_TO_SEMANTIC = Object.freeze({
  posted: STATUS_SEMANTIC.POSTED,
  open: STATUS_SEMANTIC.ACTIVE,
  booked: STATUS_SEMANTIC.ACCEPTED,
  pickedup: STATUS_SEMANTIC.ACCEPTED,
  intransit: STATUS_SEMANTIC.IN_TRANSIT,
  delivered: STATUS_SEMANTIC.COMPLETED,
  closed: STATUS_SEMANTIC.CLOSED,
  cancelled: STATUS_SEMANTIC.CANCELLED,
  rejected: STATUS_SEMANTIC.REJECTED,
  expired: STATUS_SEMANTIC.EXPIRED,
  request_sent: STATUS_SEMANTIC.REQUEST_SENT,
  active: STATUS_SEMANTIC.ACTIVE,
  completed: STATUS_SEMANTIC.COMPLETED
});

const SEMANTIC_BADGE_VARIANT = Object.freeze({
  [STATUS_SEMANTIC.POSTED]: 'info',
  [STATUS_SEMANTIC.ACTIVE]: 'info',
  [STATUS_SEMANTIC.ACCEPTED]: 'success',
  [STATUS_SEMANTIC.IN_TRANSIT]: 'info',
  [STATUS_SEMANTIC.COMPLETED]: 'success',
  [STATUS_SEMANTIC.DELIVERED]: 'success',
  [STATUS_SEMANTIC.REQUEST_SENT]: 'warning',
  [STATUS_SEMANTIC.CANCELLED]: 'danger',
  [STATUS_SEMANTIC.CLOSED]: 'secondary',
  [STATUS_SEMANTIC.REJECTED]: 'secondary',
  [STATUS_SEMANTIC.EXPIRED]: 'secondary'
});

const LIFECYCLE_TO_SEMANTIC = Object.freeze({
  created: STATUS_SEMANTIC.POSTED,
  bid_open: STATUS_SEMANTIC.ACTIVE,
  bid_accepted: STATUS_SEMANTIC.ACCEPTED,
  assigned: STATUS_SEMANTIC.ACCEPTED,
  picked_up: STATUS_SEMANTIC.ACCEPTED,
  in_transit: STATUS_SEMANTIC.IN_TRANSIT,
  delivered: STATUS_SEMANTIC.COMPLETED,
  closed: STATUS_SEMANTIC.CLOSED,
  cancelled: STATUS_SEMANTIC.CANCELLED
});

export function resolveStatusSemantic(raw) {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (BACKEND_TO_SEMANTIC[key]) return BACKEND_TO_SEMANTIC[key];
  const backend = normalizeBackendStatus(raw);
  if (backend && BACKEND_TO_SEMANTIC[backend]) return BACKEND_TO_SEMANTIC[backend];
  const canon = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return CANONICAL_TO_SEMANTIC[canon] || STATUS_SEMANTIC.ACTIVE;
}

export function resolveBadgeVariantForStatus(raw, opts = {}) {
  if (opts.historyOnly && resolveStatusSemantic(raw) === STATUS_SEMANTIC.REJECTED) {
    return 'secondary';
  }
  const semantic = resolveStatusSemantic(raw);
  return SEMANTIC_BADGE_VARIANT[semantic] || 'secondary';
}

export function resolveLifecycleBadgeVariant(stage) {
  const key = String(stage || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const semantic = LIFECYCLE_TO_SEMANTIC[key] || STATUS_SEMANTIC.ACTIVE;
  return SEMANTIC_BADGE_VARIANT[semantic] || 'secondary';
}

export function timelineDotClassForStatus(raw) {
  const semantic = resolveStatusSemantic(raw);
  if (semantic === STATUS_SEMANTIC.POSTED || semantic === STATUS_SEMANTIC.ACTIVE) return 'tp-timeline-dot--posted';
  if (semantic === STATUS_SEMANTIC.ACCEPTED) return 'tp-timeline-dot--accepted';
  if (semantic === STATUS_SEMANTIC.IN_TRANSIT) return 'tp-timeline-dot--in-transit';
  if (semantic === STATUS_SEMANTIC.COMPLETED || semantic === STATUS_SEMANTIC.DELIVERED) {
    return 'tp-timeline-dot--completed';
  }
  if (semantic === STATUS_SEMANTIC.CANCELLED) return 'tp-timeline-dot--cancelled';
  return 'tp-timeline-dot--closed';
}
