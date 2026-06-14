/** Display lifecycle — keep in sync with backend `utils/logisticsLifecycle.js`. */
import { resolveLifecycleBadgeVariant } from './statusColorTokens.js';
export const LIFECYCLE_STAGES = [
  'created',
  'posted',
  'bid_open',
  'bid_accepted',
  'assigned',
  'in_transit',
  'delivered',
  'closed'
];

const STAGE_VARIANT = {
  created: resolveLifecycleBadgeVariant('created'),
  posted: resolveLifecycleBadgeVariant('posted'),
  bid_open: resolveLifecycleBadgeVariant('bid_open'),
  bid_accepted: resolveLifecycleBadgeVariant('bid_accepted'),
  assigned: resolveLifecycleBadgeVariant('assigned'),
  in_transit: resolveLifecycleBadgeVariant('in_transit'),
  delivered: resolveLifecycleBadgeVariant('delivered'),
  closed: resolveLifecycleBadgeVariant('closed')
};

export function normalizeLifecycleStage(raw) {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (LIFECYCLE_STAGES.includes(key)) return key;
  if (key === 'intransit') return 'in_transit';
  return null;
}

export function lifecycleBadgeVariant(stage) {
  const s = normalizeLifecycleStage(stage);
  return STAGE_VARIANT[s] || 'secondary';
}

/** Reject driver coords when server timestamp is too old (watchers only). */
export const STALE_LOCATION_MS = 20 * 60 * 1000;

export function isLocationFresh(locationUpdatedAt, ts, maxAgeMs = STALE_LOCATION_MS) {
  const candidates = [];
  if (locationUpdatedAt) {
    const t = new Date(locationUpdatedAt).getTime();
    if (Number.isFinite(t)) candidates.push(t);
  }
  if (ts != null && Number.isFinite(Number(ts))) candidates.push(Number(ts));
  if (!candidates.length) return false;
  const latest = Math.max(...candidates);
  return Date.now() - latest <= maxAgeMs;
}
