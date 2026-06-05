import { normalizeBidStatus, BID_STATUS, isCounterOffered } from './bidStatus.js';
import { canTrackShipment } from './shipmentUIState.js';
import { normalizeContractFields } from './contractFieldNormalizer.js';
import { getTrackingRef } from './trackingRefResolver.js';

export const FLOW_TYPE = Object.freeze({
  BID: 'BID',
  CAPACITY: 'CAPACITY'
});

export const FLOW_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  ACTIVE_CAPACITY_MATCH: 'ACTIVE_CAPACITY_MATCH',
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED'
});

/** Frontend bidType — suggested uses counter_offered + carrier suggest (no schema change). */
export function deriveBidType(bid = {}) {
  if (!bid || typeof bid !== 'object') return 'normal';
  if (bid.bidType === 'suggested') return 'suggested';
  if (isCounterOffered(bid.status) && bid.suggestedBy === 'carrier') return 'suggested';
  return 'normal';
}

export function isBidFlowActive(bid) {
  return normalizeBidStatus(bid?.status) === BID_STATUS.ACCEPTED;
}

export function isCapacityFlowActive(row = {}) {
  const s = String(row.status || '').toLowerCase();
  return s === 'active' || s === 'in_transit' || s === 'accepted';
}

export function isCapacityFlowPending(row = {}) {
  return String(row.status || '').toLowerCase() === 'request_sent';
}

export function resolveFlowTrackRef(row = {}) {
  return getTrackingRef({
    code: row.loadCode,
    loadCode: row.loadCode,
    loadId: row.loadId,
    id: row.id,
    ref: row.shipmentRef
  });
}

export function isFlowTrackable(row = {}, { carrierMode = false } = {}) {
  const fields = normalizeContractFields({
    status: row.shipmentStatus ?? row.status,
    assignedCarrierId: row.assignedCarrierId ?? row.carrierId,
    ref: resolveFlowTrackRef(row),
    role: carrierMode ? 'carrier' : 'shipper'
  });
  return canTrackShipment(fields);
}

export function flowStatusFromBid(bid) {
  if (!bid) return FLOW_STATUS.PENDING;
  const st = normalizeBidStatus(bid.status);
  if (st === BID_STATUS.ACCEPTED) return FLOW_STATUS.ACTIVE;
  if (st === BID_STATUS.REJECTED || st === BID_STATUS.CANCELLED) return FLOW_STATUS.REJECTED;
  return FLOW_STATUS.PENDING;
}

/** Map existing socket dispatch types → flow metadata (no new event names). */
export function flowTypeFromDispatchType(dispatchType) {
  const t = String(dispatchType || '').toUpperCase();
  if (t.includes('SPACE') || t.includes('CAPACITY')) return FLOW_TYPE.CAPACITY;
  return FLOW_TYPE.BID;
}

export function flowStatusFromCapacity(row = {}) {
  const s = String(row.status || '').toLowerCase();
  if (s === 'completed') return FLOW_STATUS.COMPLETED;
  if (s === 'rejected') return FLOW_STATUS.REJECTED;
  if (isCapacityFlowActive(row)) return FLOW_STATUS.ACTIVE_CAPACITY_MATCH;
  return FLOW_STATUS.PENDING;
}
