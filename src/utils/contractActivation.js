/**
 * Shipment activation pipeline (production contract).
 *
 * TRUTH:     GET /shipments/active
 * ENTRY:     triggerAcceptActivationSync() after accept API 200 only
 * SOCKETS:   emitRealtimeRefresh('shipments') — signals only, never activation sync
 * FALLBACK:  1.2s / 2.8s retries if expected row missing; cancelled on first valid row
 */
import api from '../services/api.js';
import { unwrapBody } from './unwrapApi.js';
import { emitRealtimeRefresh } from './realtimeRefresh.js';
import {
  findActiveShipmentRow,
  mergeActiveShipmentRows,
  normalizeActiveShipmentList
} from './activeShipmentModel.js';
import { upsertActiveShipmentRows as upsertStoreRows } from './activeShipmentStore.js';
import {
  commitOptimisticActivation,
  reconcileOptimisticActivation
} from './contractActivationLayer.js';

const SYNC_BURST_MS = 400;
const RETRY_DELAYS_MS = [1200, 2800];

/** Accept socket types — signals only (never run activation sync). */
export const CONTRACT_DISPATCH_TYPES = new Set([
  'BID_ACCEPTED',
  'CONTRACT_STARTED',
  'SPACE_ACCEPTED'
]);

/** All shipment-related socket signals — refresh scope only. */
export const SHIPMENT_SIGNAL_TYPES = new Set([
  ...CONTRACT_DISPATCH_TYPES,
  'STATUS_UPDATED',
  'SHIPMENT_STATUS',
  'SHIPMENT_PICKED_UP',
  'SHIPMENT_IN_TRANSIT',
  'DELIVERED',
  'DELIVERY_COMPLETED',
  'SHIPMENT_CREATED',
  'CAPACITY_ACCEPTED'
]);

/** @deprecated use SHIPMENT_SIGNAL_TYPES */
export const SHIPMENT_SYNC_TYPES = SHIPMENT_SIGNAL_TYPES;

const retryTimersByRef = new Map();
const lastSyncByRef = new Map();
const fetchGenByRef = new Map();
let lastPublishedRows = [];
let syncInFlight = null;
let syncInFlightKey = null;

function syncKey(loadCode) {
  return String(loadCode || '').trim() || '__active__';
}

function cancelRetries(refKey) {
  const timers = retryTimersByRef.get(refKey) || [];
  timers.forEach((id) => window.clearTimeout(id));
  retryTimersByRef.delete(refKey);
}

function scheduleFallbackRetries(refKey, loadCode) {
  cancelRetries(refKey);
  if (typeof window === 'undefined') return;
  const timers = RETRY_DELAYS_MS.map((ms) =>
    window.setTimeout(() => {
      void handleShipmentActivationSync(loadCode, { fallback: true });
    }, ms)
  );
  retryTimersByRef.set(refKey, timers);
}

async function fetchActiveShipments() {
  const response = await api({
    method: 'GET',
    url: '/shipments/active',
    skipGlobalErrorToast: true
  });
  return normalizeActiveShipmentList(unwrapBody(response.data));
}

function publishActiveShipmentsHydrate(
  rows,
  { loadCode = null, pendingRetry = false, authoritative = false } = {}
) {
  if (typeof window === 'undefined') return;
  if (pendingRetry && (!Array.isArray(rows) || !rows.length)) return;

  const merged = authoritative
    ? normalizeActiveShipmentList(rows)
    : mergeActiveShipmentRows(lastPublishedRows, rows, {
        silent: lastPublishedRows.length > 0 && (!Array.isArray(rows) || !rows.length)
      });

  lastPublishedRows = merged;

  upsertStoreRows(merged, {
    authoritative,
    source: authoritative ? 'hydrate' : 'rest'
  });

  window.dispatchEvent(
    new CustomEvent('tp:active-shipments-hydrate', {
      detail: {
        rows: merged,
        loadCode: loadCode || null,
        pendingRetry: Boolean(pendingRetry),
        ts: Date.now()
      }
    })
  );
}

export function isContractDispatchType(type) {
  return CONTRACT_DISPATCH_TYPES.has(String(type || '').toUpperCase());
}

export function isShipmentSyncType(type) {
  return SHIPMENT_SIGNAL_TYPES.has(String(type || '').toUpperCase());
}

/** Extract activation ref from accept API response — loadCode preferred, then shipmentId. */
export function resolveAcceptActivationRef(response) {
  if (!response || typeof response !== 'object') return null;
  const ref =
    response.loadCode ||
    response.load_code ||
    response.code ||
    response.shipmentRef ||
    response.shipmentId ||
    response.loadId ||
    null;
  return ref != null ? String(ref).trim() || null : null;
}

/**
 * Authoritative activation — ONLY after API success (accept or status mutation).
 * GET /shipments/active is the sole truth; sockets never call this for accept flows.
 */
export async function handleShipmentActivationSync(loadCode, { force = false, fallback = false } = {}) {
  const ref = String(loadCode || '').trim();
  const refKey = syncKey(ref);
  const now = Date.now();

  emitRealtimeRefresh('shipments', { atomicSync: true });

  if (!force && !fallback) {
    const last = lastSyncByRef.get(refKey) || 0;
    if (now - last < SYNC_BURST_MS && syncInFlight) {
      return syncInFlight;
    }
  }

  if (syncInFlight && syncInFlightKey === refKey && !force) {
    return syncInFlight;
  }

  const fetchGen = (fetchGenByRef.get(refKey) || 0) + 1;
  fetchGenByRef.set(refKey, fetchGen);

  const run = (async () => {
    try {
      const rows = await fetchActiveShipments();
      if (fetchGenByRef.get(refKey) !== fetchGen) {
        return { rows: [], matched: null, hasValid: false, stale: true };
      }

      const matched = ref ? findActiveShipmentRow(rows, ref) : null;
      const hasValid = ref ? Boolean(matched) : rows.length > 0;

      lastSyncByRef.set(refKey, Date.now());

      if (hasValid) {
        cancelRetries(refKey);
        publishActiveShipmentsHydrate(rows, { loadCode: ref, authoritative: true });
        return { rows, matched, hasValid };
      }

      if (!fallback) {
        scheduleFallbackRetries(refKey, ref);
      } else if (rows.length) {
        publishActiveShipmentsHydrate(rows, { loadCode: ref, authoritative: true });
      }

      return { rows, matched, hasValid };
    } catch {
      if (fetchGenByRef.get(refKey) !== fetchGen) {
        return { rows: [], matched: null, hasValid: false, stale: true };
      }
      if (!fallback) {
        scheduleFallbackRetries(refKey, ref);
      }
      return { rows: [], matched: null, hasValid: false };
    } finally {
      if (syncInFlightKey === refKey) {
        syncInFlight = null;
        syncInFlightKey = null;
      }
    }
  })();

  syncInFlight = run;
  syncInFlightKey = refKey;
  return run;
}

/** Post-accept activation — call ONLY after accept API returns 200 with loadCode/shipmentId. */
export function triggerAcceptActivationSync(response, extras = {}) {
  const ref = resolveAcceptActivationRef(response);
  if (!ref) return Promise.resolve({ rows: [], matched: null, hasValid: false });
  commitOptimisticActivation(response, extras);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tp:contract-sync', { detail: { ref, optimistic: true } })
    );
  }
  return handleShipmentActivationSync(ref, { force: true });
}

/** Post-status-mutation activation — call ONLY after status API returns 200. */
export function triggerStatusActivationSync(trackRef) {
  const ref = String(trackRef || '').trim();
  if (!ref) return Promise.resolve({ rows: [], matched: null, hasValid: false });
  return handleShipmentActivationSync(ref, { force: true });
}

/**
 * Socket entry — signals only. Never runs activation sync; never mutates UI directly.
 * Deduped notifications still reach this via handleDispatchEvent (runs before dedupe).
 */
export function runShipmentSyncFromDispatch(dispatch, type) {
  if (!isShipmentSyncType(type)) return;
  emitRealtimeRefresh('shipments', { contractSync: true, dispatchType: type });
}

/** @deprecated Use triggerAcceptActivationSync after accept API 200. */
export function activateContractUI(loadCode, options = {}) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      '[contractActivation] activateContractUI is deprecated — use triggerAcceptActivationSync(response) after accept API'
    );
  }
  void handleShipmentActivationSync(loadCode, options);
}
