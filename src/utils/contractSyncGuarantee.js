/**
 * Real-time contract sync guarantee — read-model reconciliation only.
 * Backend FSM remains source of truth; REST /shipments/active is authoritative for rows.
 */
import {
  mapLegacyToContract,
  normalizeContractEventType,
  CONTRACT_STATUS
} from './contractMapper.js';
import { resolveContractConsistency } from './contractConsistencyResolver.js';
import { getTrackingRef } from './trackingRefResolver.js';
import { updateContractLatch, clearContractLatchStore } from './contractLatchStore.js';
import { clearTrackingCache } from './trackingCache.js';
import { handleShipmentActivationSync } from './contractActivation.js';
import {
  buildContractEventKey,
  shouldProcessContractEvent,
  extractContractVersion,
  shouldApplyContractUpdate,
  recordContractVersion,
  scheduleContractRecompute,
  clearProductionStabilityLayer
} from './productionStabilityLayer.js';

const SYNC_INVALIDATION_EVENTS = new Set([
  'STATUS_UPDATED',
  'SHIPMENT_STATUS',
  'LOCATION_UPDATED',
  'TRACKING',
  'CONTRACT_ACCEPTED',
  'CONTRACT_STARTED',
  'CONTRACT_CREATED',
  'CONTRACT_COMPLETED',
  'DELIVERY_COMPLETED',
  'COUNTER_OFFER_ACCEPTED',
  'BID_ACCEPTED',
  'SPACE_ACCEPTED',
  'SHIPMENT_IN_TRANSIT',
  'SHIPMENT_PICKED_UP',
  'SPACE_IN_TRANSIT',
  'SPACE_COMPLETED',
  'CAPACITY_ACCEPTED'
]);

const cacheByRef = new Map();
const fallbackTimersByRef = new Map();
let globalVersion = 0;
let bootstrapped = false;

const FALLBACK_MS = 1500;

function refKey(ref) {
  return String(ref || '').trim();
}

export function invalidateContractCache(ref = null) {
  if (ref) {
    const key = refKey(ref);
    if (key) {
      cacheByRef.delete(key);
      clearTrackingCache(key);
    }
  } else {
    cacheByRef.clear();
  }
  globalVersion += 1;
}

export function clearContractSyncCache() {
  invalidateContractCache();
  if (typeof window !== 'undefined') {
    fallbackTimersByRef.forEach((id) => window.clearTimeout(id));
  }
  fallbackTimersByRef.clear();
  clearContractLatchStore();
  clearProductionStabilityLayer();
}

/** Normalize socket/REST payloads into { type, ref }. */
export function normalizeSyncEvent(dispatch = {}) {
  const type = normalizeContractEventType(
    dispatch.type || dispatch.dispatchType || dispatch.notification?.type || ''
  );
  const ref =
    getTrackingRef(dispatch.payload || {}) ||
    getTrackingRef(dispatch.notification || {}) ||
    getTrackingRef(dispatch) ||
    dispatch.refKey ||
    dispatch.shipmentRef ||
    dispatch.loadCode ||
    null;
  return { type: String(type).toUpperCase(), ref: ref ? refKey(ref) : null };
}

export function shouldTriggerContractSync(type) {
  const t = normalizeContractEventType(type);
  const u = String(t).toUpperCase();
  if (SYNC_INVALIDATION_EVENTS.has(u)) return true;
  return u.includes('STATUS') || u.includes('LOCATION') || u.includes('CONTRACT');
}

/**
 * Recompute unified contract + UI state from legacy row (read model only).
 */
export function recomputeUnifiedContract(input = {}, { role = null } = {}) {
  const resolved = resolveContractConsistency({
    restShipment: input,
    trackingPayload: input.trackingPayload ?? null,
    role
  });

  const unifiedContract = mapLegacyToContract({
    ...resolved.fields,
    ...input,
    shipmentStatus: resolved.fields.shipmentStatus ?? resolved.fields.status
  });

  const trackingEnabled =
    unifiedContract.trackingEnabled &&
    (unifiedContract.status === CONTRACT_STATUS.ACCEPTED ||
      unifiedContract.status === CONTRACT_STATUS.IN_TRANSIT);

  const contract = { ...unifiedContract, trackingEnabled };
  const uiState = {
    ...resolved.uiState,
    unifiedContract: contract,
    trackingEnabled: contract.trackingEnabled,
    canTrack: contract.trackingEnabled && Boolean(resolved.uiState.canTrack),
    showLiveMap: contract.trackingEnabled && Boolean(resolved.uiState.showLiveMap),
    allowGpsPublish: contract.trackingEnabled && Boolean(resolved.uiState.allowGpsPublish)
  };

  return { contract, uiState, fields: resolved.fields };
}

function scheduleSocketFallback(ref) {
  if (!ref || typeof window === 'undefined') return;
  const key = refKey(ref);
  const prev = fallbackTimersByRef.get(key);
  if (prev) window.clearTimeout(prev);
  fallbackTimersByRef.set(
    key,
    window.setTimeout(() => {
      fallbackTimersByRef.delete(key);
      void forceUIStateSync({ ref: key, source: 'fallback' });
    }, FALLBACK_MS)
  );
}

/**
 * Single reconciliation entry: socket OR REST → mapper → UI sync event.
 */
export async function forceUIStateSync({
  ref = null,
  source = 'rest',
  dispatch = null,
  restRow = null,
  role = null
} = {}) {
  const refKeyResolved =
    refKey(ref) || (restRow ? refKey(getTrackingRef(restRow)) : null) || normalizeSyncEvent(dispatch).ref;

  const incomingVersion = extractContractVersion({ dispatch, restRow }, source);
  if (refKeyResolved && !shouldApplyContractUpdate(refKeyResolved, incomingVersion, source)) {
    const cached = getCachedContractView(refKeyResolved);
    if (cached) {
      return {
        contract: cached.contract,
        uiState: cached.uiState,
        fields: cached.fields
      };
    }
  }

  if (refKeyResolved) invalidateContractCache(refKeyResolved);

  let row = restRow;
  if (!row && refKeyResolved && (source === 'socket' || source === 'fallback')) {
    try {
      const result = await handleShipmentActivationSync(refKeyResolved, {
        force: source === 'fallback',
        fallback: source === 'fallback'
      });
      if (result?.matched) row = result.matched;
      else if (Array.isArray(result?.rows) && result.rows.length === 1) {
        [row] = result.rows;
      }
    } catch {
      /* REST rehydrate best-effort */
    }
  }

  const mergedInput = {
    ...(dispatch?.payload && typeof dispatch.payload === 'object' ? dispatch.payload : {}),
    ...(row && typeof row === 'object' ? row : {}),
    shipmentRef: refKeyResolved,
    ref: refKeyResolved,
    loadCode: row?.loadCode ?? row?.code ?? refKeyResolved
  };

  const reconciled = recomputeUnifiedContract(mergedInput, { role });

  if (refKeyResolved) {
    recordContractVersion(refKeyResolved, incomingVersion, source);
    cacheByRef.set(refKeyResolved, {
      version: globalVersion,
      contractVersion: incomingVersion,
      ...reconciled,
      updatedAt: Date.now(),
      source
    });
    updateContractLatch({
      ...reconciled.fields,
      source: source === 'socket' ? 'event' : 'state'
    });
  }

  if (source === 'socket' && refKeyResolved) {
    scheduleSocketFallback(refKeyResolved);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tp:contract-sync', {
        detail: {
          ref: refKeyResolved,
          contract: reconciled.contract,
          uiState: reconciled.uiState,
          source,
          version: globalVersion,
          contractVersion: incomingVersion,
          ts: Date.now()
        }
      })
    );
  }

  return reconciled;
}

function buildReconcileEventKey({ dispatch, restRow, source }) {
  if (dispatch && shouldTriggerContractSync(dispatch.type || dispatch.notification?.type)) {
    const { ref, type } = normalizeSyncEvent(dispatch);
    return {
      ref,
      key: buildContractEventKey(
        ref,
        type,
        dispatch.ts || dispatch.notification?.createdAt || Date.now()
      )
    };
  }
  if (restRow) {
    const ref = getTrackingRef(restRow);
    return {
      ref,
      key: buildContractEventKey(
        ref,
        source === 'hydrate' ? 'HYDRATE' : 'REST_ROW',
        restRow.updatedAt || restRow.statusUpdatedAt || Date.now()
      )
    };
  }
  return { ref: null, key: null };
}

/** Invalidate + reconcile from dispatch or REST row (PSL-gated). */
export function reconcileContractUpdate(input = {}) {
  const { dispatch, restRow, role, source = 'rest' } = input;
  const { ref, key } = buildReconcileEventKey({ dispatch, restRow, source });

  if (!ref && !dispatch && !restRow) return Promise.resolve(null);
  if (key && !shouldProcessContractEvent(key)) {
    return Promise.resolve(ref ? getCachedContractView(ref) : null);
  }

  if (dispatch && shouldTriggerContractSync(dispatch.type || dispatch.notification?.type)) {
    const reconcileSource = source === 'flow' ? 'flow' : 'socket';
    return new Promise((resolve) => {
      scheduleContractRecompute(
        ref,
        { dispatch, restRow, role, source: reconcileSource },
        (merged) => {
          resolve(
            forceUIStateSync({
              ref,
              source: merged.source || reconcileSource,
              dispatch: merged.dispatch,
              restRow: merged.restRow,
              role: merged.role
            })
          );
        }
      );
    });
  }

  if (restRow) {
    const restRef = getTrackingRef(restRow);
    return new Promise((resolve) => {
      scheduleContractRecompute(restRef, { restRow, role, source }, (merged) => {
        resolve(
          forceUIStateSync({
            ref: restRef,
            source: merged.source || source,
            restRow: merged.restRow,
            role: merged.role
          })
        );
      });
    });
  }

  return Promise.resolve(null);
}

export function getCachedContractView(ref) {
  const key = refKey(ref);
  if (!key) return null;
  const row = cacheByRef.get(key);
  return row ? { ...row } : null;
}

export function getContractSyncVersion() {
  return globalVersion;
}

/** Bootstrap window listeners — call once at app start. */
export function initContractSyncGuarantee() {
  if (bootstrapped || typeof window === 'undefined') return;
  bootstrapped = true;

  window.addEventListener('tp:active-shipments-hydrate', (e) => {
    const rows = Array.isArray(e?.detail?.rows) ? e.detail.rows : [];
    rows.forEach((row) => {
      void reconcileContractUpdate({ restRow: row, source: 'hydrate' });
    });
  });

  window.addEventListener('tp:session-cleared', () => {
    clearContractSyncCache();
  });
}
