import api from '../services/api.js';
import { unwrapBody } from './unwrapApi.js';
import { emitRealtimeRefresh } from './realtimeRefresh.js';
import {
  findActiveShipmentRow,
  normalizeActiveShipmentList
} from './activeShipmentModel.js';

const SYNC_BURST_MS = 400;
const RETRY_DELAYS_MS = [1200, 2800];

/** Accept + status socket types that MUST run the atomic shipment pipeline. */
export const CONTRACT_DISPATCH_TYPES = new Set([
  'BID_ACCEPTED',
  'CONTRACT_STARTED',
  'SPACE_ACCEPTED'
]);

export const SHIPMENT_SYNC_TYPES = new Set([
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

const retryTimersByRef = new Map();
const lastSyncByRef = new Map();
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

function publishActiveShipmentsHydrate(rows, { loadCode = null, pendingRetry = false } = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('tp:active-shipments-hydrate', {
      detail: {
        rows: Array.isArray(rows) ? rows : [],
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
  return SHIPMENT_SYNC_TYPES.has(String(type || '').toUpperCase());
}

/** Resolve shipment ref from a socket dispatch envelope (load code preferred). */
export function resolveContractRefFromDispatch(dispatch) {
  if (!dispatch || typeof dispatch !== 'object') return null;
  return (
    dispatch.notification?.shipmentRef ||
    dispatch.notification?.refKey ||
    dispatch.notification?.code ||
    dispatch.payload?.loadCode ||
    dispatch.payload?.loadId ||
    dispatch.payload?.shipmentRef ||
    dispatch.refKey ||
    null
  );
}

/**
 * Single authority: accept/status signal → invalidate → GET /shipments/active → hydrate UI.
 * Idempotent per loadCode; retries only when the expected row is still missing.
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

  const run = (async () => {
    try {
      const rows = await fetchActiveShipments();
      const matched = ref ? findActiveShipmentRow(rows, ref) : null;
      const hasValid = ref ? Boolean(matched) : rows.length > 0;

      lastSyncByRef.set(refKey, Date.now());

      if (hasValid) {
        cancelRetries(refKey);
        publishActiveShipmentsHydrate(rows, { loadCode: ref, pendingRetry: false });
        return { rows, matched, hasValid };
      }

      if (!fallback) {
        scheduleFallbackRetries(refKey, ref);
        publishActiveShipmentsHydrate(rows, { loadCode: ref, pendingRetry: true });
      } else {
        publishActiveShipmentsHydrate(rows, { loadCode: ref, pendingRetry: false });
      }

      return { rows, matched, hasValid };
    } catch {
      if (!fallback) {
        scheduleFallbackRetries(refKey, ref);
        publishActiveShipmentsHydrate([], { loadCode: ref, pendingRetry: true });
      } else {
        publishActiveShipmentsHydrate([], { loadCode: ref, pendingRetry: false });
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

/** Socket/status entry — signals only; never mutates UI directly. */
export function runShipmentSyncFromDispatch(dispatch, type) {
  if (!isShipmentSyncType(type)) return;
  void handleShipmentActivationSync(resolveContractRefFromDispatch(dispatch));
}

/** @deprecated Use handleShipmentActivationSync — kept for backward compatibility. */
export function activateContractUI(loadCode, options = {}) {
  void handleShipmentActivationSync(loadCode, options);
}
