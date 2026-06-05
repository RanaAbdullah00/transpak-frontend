import { emitRealtimeRefresh } from './realtimeRefresh.js';

/** Scopes refreshed after bid/capacity accept (triggers REST refetch in listeners). */
const CONTRACT_REFRESH_SCOPES = Object.freeze(['bids', 'loads', 'shipments', 'space']);

const REFRESH_DEBOUNCE_MS = 600;
let lastActivationTs = 0;
const lastActivationByRef = new Map();

/** Socket dispatch types that should trigger a full list refresh (accelerator only). */
export const CONTRACT_DISPATCH_TYPES = new Set([
  'BID_ACCEPTED',
  'CONTRACT_STARTED',
  'SPACE_ACCEPTED'
]);

export function isContractDispatchType(type) {
  return CONTRACT_DISPATCH_TYPES.has(String(type || '').toUpperCase());
}

/**
 * Refresh dashboards and lists only. Contract truth comes from REST (/shipments/active, /track).
 */
/**
 * Refresh dashboards/lists only (REST remains source of truth).
 * @param {string} [shipmentRef] optional ref for per-shipment debounce
 */
export function activateContractUI(shipmentRef) {
  const now = Date.now();
  const ref = String(shipmentRef || '').trim();
  if (now - lastActivationTs < REFRESH_DEBOUNCE_MS) return;
  if (ref) {
    const lastRef = lastActivationByRef.get(ref) || 0;
    if (now - lastRef < REFRESH_DEBOUNCE_MS) return;
    lastActivationByRef.set(ref, now);
  }
  lastActivationTs = now;

  CONTRACT_REFRESH_SCOPES.forEach((scope) => emitRealtimeRefresh(scope));
}
