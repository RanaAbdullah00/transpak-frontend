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

function refKey(ref) {
  return String(ref || '').trim();
}

function notify() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  const flush = () => {
    notifyScheduled = false;
    listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
  else setTimeout(flush, 0);
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

export function mergeOptimisticBid(bid = {}) {
  const id = String(bid.id || '').trim();
  if (!id) return bid;
  const opt = optimisticBidById.get(id);
  if (!opt) return bid;
  return {
    ...bid,
    status: opt.status,
    loadCode: bid.loadCode || opt.loadCode || bid.load_code
  };
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
  return () => listeners.delete(listener);
}

export function mergeOptimisticContractInput(input = {}) {
  const ref = getTrackingRef(input) || refKey(input.ref ?? input.trackRef);
  const opt = ref ? getOptimisticActivation(ref) : null;
  if (!opt?.contractActivated) return input;

  const isSpace = opt.flowType === FLOW_TYPE.CAPACITY;
  const mergedStatus = opt.shipmentStatus ?? 'booked';
  return {
    ...input,
    ref: opt.ref || ref,
    shipmentStatus: mergedStatus,
    status: mergedStatus,
    assignedCarrierId: opt.carrierId ?? input.assignedCarrierId ?? input.assigned_carrier_id ?? null,
    bidStatus: isSpace ? input.bidStatus : (opt.bidStatus ?? 'accepted'),
    spaceRequestStatus: isSpace ? (opt.spaceRequestStatus ?? 'accepted') : input.spaceRequestStatus,
    flowType: opt.flowType ?? input.flowType,
    contractActivated: true
  };
}
