import { isValidShipmentTrackRef, normalizeShipmentStatus } from './shipmentStatus.js';
import { trackingRefsMatch } from './trackingRefResolver.js';
import { upsertActiveShipmentRows, getActiveShipmentList } from './activeShipmentStore.js';
import { findActiveShipmentRow } from './activeShipmentModel.js';
import { normalizeBidStatus, BID_STATUS } from './bidStatus.js';
import { FLOW_TYPE } from './flowSession.js';

const ACTIVE_REST_STATUSES = new Set(['booked', 'pickedup', 'intransit', 'delivered']);

const activationByRef = new Map();
const optimisticBidById = new Map();
const listeners = new Set();
let notifyScheduled = false;
let scopedRefreshScheduled = false;
const pendingScopedRefresh = new Set();

const SCOPED_REFRESH_EVENTS = Object.freeze({
  bids: 'tp:bids-refresh',
  shipments: 'tp:shipments-refresh',
  tracking: 'tp:tracking-refresh',
  space: 'tp:space-refresh'
});

function refKey(ref) {
  return String(ref || '').trim();
}

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/** Synchronous — trackingActive must flip in the same tick as activation emit. */
function notify() {
  notifyListeners();
}

function notifyDeferred() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  const flush = () => {
    notifyScheduled = false;
    notifyListeners();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
  else setTimeout(flush, 0);
}

/** Scoped refresh only — never emits global/all refresh. */
export function emitScopedRefresh(scopes, meta = {}) {
  if (typeof window === 'undefined') return;
  const list = Array.isArray(scopes) ? scopes : [scopes];
  for (const scope of list) {
    const key = String(scope || '').trim();
    if (!key || key === 'all' || !SCOPED_REFRESH_EVENTS[key]) continue;
    pendingScopedRefresh.add(key);
  }
  if (!pendingScopedRefresh.size) return;
  if (scopedRefreshScheduled) return;
  scopedRefreshScheduled = true;
  const flush = () => {
    if (typeof window === 'undefined') return;
    for (const scope of pendingScopedRefresh) {
      const eventName = SCOPED_REFRESH_EVENTS[scope];
      if (!eventName) continue;
      window.dispatchEvent(new CustomEvent(eventName, { detail: { scope, ...meta } }));
    }
    pendingScopedRefresh.clear();
    scopedRefreshScheduled = false;
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
  else setTimeout(flush, 0);
}

/** After contract activation — synchronous scoped refresh (same tick as activation). */
export function emitActivationScopedRefresh(ref, meta = {}) {
  if (typeof window === 'undefined') return;
  for (const scope of ['bids', 'shipments', 'tracking']) {
    const eventName = SCOPED_REFRESH_EVENTS[scope];
    if (!eventName) continue;
    window.dispatchEvent(new CustomEvent(eventName, { detail: { scope, ref, ...meta } }));
  }
}

/** Canonical tracking ref: loadCode > bridgeRef > shipmentRef (never UUID). */
export function getTrackingRef(contract = {}) {
  if (!contract || typeof contract !== 'object') return '';
  const candidates = [
    contract.loadCode,
    contract.load_code,
    contract.code,
    contract.ref,
    contract.refKey,
    contract.trackRef,
    contract.bridgeRef,
    contract.bridge_ref,
    contract.booking_reference,
    contract.bookingReference,
    contract.shipmentRef,
    contract.shipment_ref
  ];
  for (const c of candidates) {
    const s = String(c ?? '').trim();
    if (s && isValidShipmentTrackRef(s)) return s;
  }
  return '';
}

function extractRef(response = {}) {
  return getTrackingRef(response) || null;
}

export function isStaleRestShipmentStatus(status) {
  const s = normalizeShipmentStatus(status);
  return !s || s === 'posted' || s === 'open';
}

/** Suppress stale REST rows while optimistic activation is live. */
export function shouldSuppressStaleRestRow(restRow = {}, ref = '') {
  if (!hasOptimisticActivation(ref)) return false;
  const status = normalizeShipmentStatus(restRow.shipmentStatus ?? restRow.status);
  return isStaleRestShipmentStatus(status);
}

function resolveFlowType(response = {}) {
  const raw = String(response.flowType || response.flow_type || '').toUpperCase();
  if (raw === 'CAPACITY' || raw === 'SPACE') return FLOW_TYPE.CAPACITY;
  return FLOW_TYPE.BID;
}

/**
 * Client-side optimistic contract activation — immediate on accept API 200.
 * REST /shipments/active reconciles later; never blocks UI until then.
 */
export function commitOptimisticActivation(response = {}, extras = {}) {
  const ref = extractRef(response) || refKey(extras.ref);
  if (!ref || !isValidShipmentTrackRef(ref)) return null;

  const flowType = resolveFlowType(response);
  const isSpace = flowType === FLOW_TYPE.CAPACITY;
  const entry = {
    ref,
    contractActivated: true,
    shipmentActive: true,
    trackingEnabled: true,
    shipmentStatus: 'booked',
    bidStatus: isSpace ? null : 'accepted',
    spaceRequestStatus: isSpace ? 'accepted' : null,
    flowType,
    origin: response.origin ?? extras.origin ?? null,
    destination: response.destination ?? extras.destination ?? null,
    carrierId:
      response.carrierId ??
      response.carrier_id ??
      extras.carrierId ??
      null,
    shipperId: response.shipperId ?? response.shipper_id ?? extras.shipperId ?? null,
    ts: Date.now()
  };

  activationByRef.set(ref, entry);

  const row = buildOptimisticTrackingRow(ref, {
    userId: extras.userId ?? null,
    role: extras.role ?? null,
    entry
  });
  if (row) {
    upsertActiveShipmentRows([row], { source: 'bootstrap' });
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tp:contract-activated', {
        detail: { ref, ...entry }
      })
    );
    emitActivationScopedRefresh(ref, { source: 'optimistic' });
  }

  notify();
  return entry;
}

/** Instant bid accept UI — pairs with commitOptimisticActivation for LOAD flow. */
export function commitOptimisticBidAccept(bidId, response = {}, extras = {}) {
  const id = String(bidId || response.bidId || response.id || '').trim();
  if (!id) return commitOptimisticActivation(response, extras);

  const loadCode = extractRef(response) || extras.loadCode || null;
  optimisticBidById.set(id, {
    bidId: id,
    status: 'accepted',
    loadCode,
    ts: Date.now()
  });

  const contractEntry = commitOptimisticActivation(
    { ...response, loadCode: loadCode || response.loadCode },
    extras
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tp:bid-updated', {
        detail: { bidId: id, status: 'accepted', loadCode, ref: contractEntry?.ref ?? loadCode }
      })
    );
  }

  notify();
  return optimisticBidById.get(id);
}

export function getOptimisticBid(bidId) {
  const id = String(bidId || '').trim();
  return id ? optimisticBidById.get(id) ?? null : null;
}

function applyOptimisticBidOverlay(safeBid, opt) {
  return {
    ...safeBid,
    status: opt.status,
    suggestedAmount: opt.suggestedAmount ?? safeBid.suggestedAmount,
    suggestedBy: opt.suggestedBy ?? safeBid.suggestedBy,
    loadCode: opt.loadCode || safeBid.loadCode || safeBid.load_code
  };
}

/**
 * Bid merge precedence: optimistic overlay > REST.
 * Terminal optimistic states lock until REST confirms the same terminal state.
 */
export function mergeOptimisticBid(bid = {}) {
  const safeBid = bid && typeof bid === 'object' ? bid : {};
  const id = String(safeBid.id || '').trim();
  if (!id) return safeBid;
  const opt = optimisticBidById.get(id);
  if (!opt) return safeBid;

  const restStatus = normalizeBidStatus(safeBid.status);
  const optStatus = normalizeBidStatus(opt.status);

  if (optStatus === BID_STATUS.ACCEPTED || optStatus === BID_STATUS.REJECTED || optStatus === BID_STATUS.CANCELLED) {
    if (restStatus === optStatus) {
      optimisticBidById.delete(id);
      notify();
      return safeBid;
    }
    return applyOptimisticBidOverlay(safeBid, opt);
  }

  if (restStatus === BID_STATUS.REJECTED || restStatus === BID_STATUS.CANCELLED) {
    optimisticBidById.delete(id);
    notify();
    return safeBid;
  }

  if (restStatus === BID_STATUS.ACCEPTED) {
    optimisticBidById.delete(id);
    notify();
    return safeBid;
  }

  return applyOptimisticBidOverlay(safeBid, opt);
}

/** Instant bid reject — UI truth before REST list refresh. */
export function commitOptimisticBidReject(bidId, extras = {}) {
  const id = String(bidId || '').trim();
  if (!id) return null;
  optimisticBidById.set(id, {
    bidId: id,
    status: 'rejected',
    loadCode: extras.loadCode || null,
    ts: Date.now()
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tp:bid-updated', { detail: { bidId: id, status: 'rejected' } })
    );
  }
  emitScopedRefresh('bids');
  notify();
  return optimisticBidById.get(id);
}

/** Instant counter-offer — UI truth before REST list refresh. */
export function commitOptimisticBidSuggest(bidId, amount, extras = {}) {
  const id = String(bidId || '').trim();
  if (!id) return null;
  const suggestedBy = extras.suggestedBy || 'shipper';
  optimisticBidById.set(id, {
    bidId: id,
    status: 'counter_offered',
    suggestedAmount: amount,
    suggestedBy,
    loadCode: extras.loadCode || null,
    ts: Date.now()
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tp:bid-updated', {
        detail: { bidId: id, status: 'counter_offered', suggestedAmount: amount, suggestedBy }
      })
    );
  }
  emitScopedRefresh('bids');
  notifyDeferred();
  return optimisticBidById.get(id);
}

export function reconcileOptimisticBid(bidId) {
  const id = String(bidId || '').trim();
  if (!id || !optimisticBidById.has(id)) return;
  optimisticBidById.delete(id);
  notify();
}

/** SPACE request — optimistic accepted before list refresh. */
export function commitOptimisticSpaceAccept(requestId, response = {}, extras = {}) {
  const entry = commitOptimisticActivation(
    { ...response, flowType: 'CAPACITY' },
    { ...extras, ref: extractRef(response) || extras.ref }
  );
  const id = String(requestId || response.requestId || response.id || '').trim();
  if (typeof window !== 'undefined' && id) {
    window.dispatchEvent(
      new CustomEvent('tp:bid-updated', {
        detail: {
          spaceRequestId: id,
          status: 'accepted',
          ref: entry?.ref,
          flowType: 'CAPACITY'
        }
      })
    );
  }
  return entry;
}

export function getOptimisticActivation(ref) {
  const key = refKey(ref);
  if (!key) return null;
  for (const [storedRef, entry] of activationByRef) {
    if (trackingRefsMatch(storedRef, key)) return entry;
  }
  return activationByRef.get(key) ?? null;
}

export function hasOptimisticActivation(ref) {
  return Boolean(getOptimisticActivation(ref)?.contractActivated);
}

export function reconcileOptimisticActivation(ref) {
  const key = refKey(ref);
  if (!key || !hasOptimisticActivation(key)) return;

  const storeRow = findActiveShipmentRow(getActiveShipmentList(), key);
  if (!storeRow) return;

  const status = normalizeShipmentStatus(storeRow.shipmentStatus ?? storeRow.status);
  if (!ACTIVE_REST_STATUSES.has(status)) return;

  let removed = false;
  for (const storedRef of [...activationByRef.keys()]) {
    if (trackingRefsMatch(storedRef, key)) {
      activationByRef.delete(storedRef);
      removed = true;
    }
  }
  if (removed) notify();
}

export function reconcileOptimisticAccept(ref, { bidId = null } = {}) {
  reconcileOptimisticActivation(ref);
  if (bidId) reconcileOptimisticBid(bidId);
}

/**
 * Deterministic snapshot engine — single authority for contract/shipment/bid state.
 * Precedence: optimistic activation > contract overlay > store/REST row > raw REST fields.
 * Existing merge helpers delegate here (gradual migration, safe coexistence).
 */
const SAFE_BASE_SNAPSHOT = Object.freeze({
  ref: '',
  contractFields: {},
  activeRow: null,
  bid: null,
  contractActivated: false,
  optimistic: null,
  shipmentStatus: null,
  trackingEnabled: false,
  ts: 0,
  source: 'none'
});

/** Base merge engine — consumers should use getUnifiedShipmentSnapshot from shipmentUIState.js. */
export function computeUnifiedShipmentSnapshot(input = {}) {
  try {
  const safe = input && typeof input === 'object' ? input : {};
  const restRow = safe.restRow ?? safe.activeRow ?? safe.storeRow ?? null;
  const restFields =
    restRow && typeof restRow === 'object'
      ? { ...restRow }
      : {};

  const ref =
    getTrackingRef(safe) ||
    refKey(safe.ref ?? safe.trackRef) ||
    getTrackingRef(restFields) ||
    '';

  const role = safe.role ?? restFields.role ?? null;
  const userId = safe.userId ?? null;
  const optimistic = ref ? getOptimisticActivation(ref) : null;

  const restBase = {
    ...restFields,
    ...safe,
    ref: ref || safe.ref,
    role: role ?? safe.role,
    assignedCarrierId:
      safe.assignedCarrierId ??
      safe.assigned_carrier_id ??
      restFields.assignedCarrierId ??
      restFields.assigned_carrier_id ??
      null,
    shipmentStatus:
      safe.shipmentStatus ?? safe.status ?? restFields.shipmentStatus ?? restFields.status ?? null,
    status: safe.status ?? safe.shipmentStatus ?? restFields.status ?? restFields.shipmentStatus ?? null,
    flowType: safe.flowType ?? restFields.flowType ?? null
  };
  delete restBase.restRow;
  delete restBase.storeRow;
  delete restBase.activeRow;
  delete restBase.bid;
  delete restBase.userId;

  let contractFields = restBase;
  if (optimistic?.contractActivated) {
    const isSpace = optimistic.flowType === FLOW_TYPE.CAPACITY;
    const mergedStatus = optimistic.shipmentStatus ?? 'booked';
    contractFields = {
      ...restBase,
      ref: optimistic.ref || ref,
      shipmentStatus: mergedStatus,
      status: mergedStatus,
      assignedCarrierId:
        optimistic.carrierId ??
        restBase.assignedCarrierId ??
        restBase.assigned_carrier_id ??
        null,
      bidStatus: isSpace ? restBase.bidStatus : (optimistic.bidStatus ?? 'accepted'),
      spaceRequestStatus: isSpace
        ? (optimistic.spaceRequestStatus ?? 'accepted')
        : restBase.spaceRequestStatus,
      flowType: optimistic.flowType ?? restBase.flowType,
      contractActivated: true
    };
  }

  const key = refKey(ref);
  let activeRowMerged = restRow && typeof restRow === 'object' ? { ...restRow } : null;
  const optimisticRow =
    optimistic?.contractActivated && key && isValidShipmentTrackRef(key)
      ? buildOptimisticTrackingRow(key, { userId, role, entry: optimistic })
      : null;

  if (optimisticRow) {
    if (!activeRowMerged || shouldSuppressStaleRestRow(activeRowMerged, key)) {
      activeRowMerged = optimisticRow;
    } else {
      activeRowMerged = {
        ...activeRowMerged,
        ...optimisticRow,
        shipmentStatus: optimisticRow.shipmentStatus,
        status: optimisticRow.status,
        trackingEnabled: true,
        contractActivated: true,
        assignedCarrierId:
          activeRowMerged.assignedCarrierId ?? optimisticRow.assignedCarrierId ?? null
      };
    }
  }

  const bidMerged = safe.bid ? mergeOptimisticBid(safe.bid) : null;
  const contractActivated =
    Boolean(optimistic?.contractActivated) || Boolean(contractFields.contractActivated);
  const resolvedRef = getTrackingRef(contractFields) || ref || '';

  return {
    ref: resolvedRef,
    contractFields,
    activeRow: activeRowMerged,
    bid: bidMerged,
    contractActivated,
    optimistic,
    shipmentStatus: contractFields.shipmentStatus ?? contractFields.status ?? null,
    trackingEnabled: Boolean(activeRowMerged?.trackingEnabled) || contractActivated,
    ts: optimistic?.ts ?? 0,
    source: contractActivated ? 'optimistic' : activeRowMerged ? 'rest' : 'none'
  };
  } catch {
    return { ...SAFE_BASE_SNAPSHOT, contractFields: {} };
  }
}

/**
 * Bid-only merge — internal/legacy; UI must use getUnifiedShipmentSnapshot from shipmentUIState.js.
 * @deprecated UI consumers — use getUnifiedShipmentSnapshot({ bid }) + resolveBidFromSnapshot.
 */
export function getUnifiedBidSnapshot(bid = {}) {
  try {
    const safe = bid && typeof bid === 'object' ? bid : {};
    const merged = computeUnifiedShipmentSnapshot({ bid: safe });
    return merged?.bid ?? safe;
  } catch {
    return bid && typeof bid === 'object' ? bid : {};
  }
}

/**
 * Active-row merge precedence: optimistic > store/REST.
 * @deprecated Prefer getUnifiedShipmentSnapshot — kept for safe coexistence.
 */
export function mergeActiveRowWithOptimistic(restRow, ref, { userId = null, role = null } = {}) {
  const key = refKey(ref);
  if (!key || !isValidShipmentTrackRef(key)) return restRow || null;
  return (
    computeUnifiedShipmentSnapshot({ restRow, ref, userId, role }).activeRow ?? restRow ?? null
  );
}

export function buildOptimisticTrackingRow(ref, { userId = null, role = null, entry = null } = {}) {
  const opt = entry || getOptimisticActivation(ref);
  if (!opt?.contractActivated) return null;
  const key = refKey(ref) || opt.ref;
  if (!key || !isValidShipmentTrackRef(key)) return null;

  const isCarrier = String(role || '').toLowerCase() === 'carrier';
  return {
    trackRef: key,
    code: key,
    loadCode: key,
    origin: opt.origin ?? null,
    destination: opt.destination ?? null,
    shipmentStatus: opt.shipmentStatus ?? 'booked',
    status: opt.shipmentStatus ?? 'booked',
    trackingEnabled: true,
    flowType: opt.flowType ?? FLOW_TYPE.BID,
    assignedCarrierId: opt.carrierId ?? (isCarrier ? userId : null),
    contractActivated: true
  };
}

export function subscribeOptimisticActivation(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  try {
    listener();
  } catch {
    /* ignore */
  }
  return () => listeners.delete(listener);
}

/**
 * Contract-field merge — delegates to getUnifiedShipmentSnapshot.
 * @deprecated Prefer getUnifiedShipmentSnapshot — kept for safe coexistence.
 */
export function mergeOptimisticContractInput(input = {}) {
  return computeUnifiedShipmentSnapshot(input).contractFields;
}
