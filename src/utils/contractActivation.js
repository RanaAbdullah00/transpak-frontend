import { emitRealtimeRefresh } from './realtimeRefresh.js';

const REFRESH_DEBOUNCE_MS = 600;
const RETRY_DELAYS_MS = [1200, 2800];
let lastActivationTs = 0;
const lastActivationByRef = new Map();
const retryTimersByRef = new Map();

function scheduleActivationRetry(shipmentRef) {
  const ref = String(shipmentRef || '').trim();
  if (!ref || typeof window === 'undefined') return;

  const existing = retryTimersByRef.get(ref) || [];
  existing.forEach((id) => window.clearTimeout(id));

  const timers = RETRY_DELAYS_MS.map((ms) =>
    window.setTimeout(() => {
      emitRealtimeRefresh('shipments');
    }, ms)
  );
  retryTimersByRef.set(ref, timers);
}

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
export function activateContractUI(shipmentRef, { force = false } = {}) {
  const now = Date.now();
  const ref = String(shipmentRef || '').trim();

  if (!force) {
    if (ref) {
      const lastRef = lastActivationByRef.get(ref) || 0;
      if (now - lastRef < REFRESH_DEBOUNCE_MS) return;
    } else if (now - lastActivationTs < REFRESH_DEBOUNCE_MS) {
      return;
    }
  }

  lastActivationTs = now;
  if (ref) lastActivationByRef.set(ref, now);

  scheduleActivationRetry(ref || '__active__');
}
