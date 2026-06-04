import { normalizeShipmentStatus } from './shipmentStatus.js';
import { TRACKING_ACTIVE_STATUSES } from './shipmentUIState.js';
import { getTrackingRef, trackingRefsMatch } from './trackingRefResolver.js';

/** Session-scoped contract latch (survives remount; cleared on auth session clear). */
const latchByRef = new Map();

/**
 * @typedef {Object} ContractLatchRow
 * @property {string} lastActiveContractRef
 * @property {number} lastActiveTimestamp
 * @property {string|null} lastKnownShipmentStatus
 * @property {string|null} assignedCarrierId
 * @property {string|null} loadId
 * @property {'state'|'event'} source
 */

/**
 * @param {object} input
 * @returns {ContractLatchRow|null}
 */
export function updateContractLatch(input = {}) {
  const ref = getTrackingRef(input);
  if (!ref) return null;

  const status =
    normalizeShipmentStatus(
      input.status ?? input.shipmentStatus ?? input.lastKnownShipmentStatus ?? 'booked'
    ) || 'booked';

  const row = {
    lastActiveContractRef: ref,
    lastActiveTimestamp: Date.now(),
    lastKnownShipmentStatus: status,
    assignedCarrierId:
      input.assignedCarrierId ?? input.assigned_carrier_id
        ? String(input.assignedCarrierId ?? input.assigned_carrier_id).trim()
        : null,
    loadId: input.loadId != null ? String(input.loadId).trim() : null,
    source: input.source === 'event' ? 'event' : 'state'
  };

  latchByRef.set(ref, row);
  if (row.loadId && row.loadId !== ref) {
    latchByRef.set(row.loadId, row);
  }
  return row;
}

/** @returns {ContractLatchRow|null} */
export function getContractLatch(trackingRef) {
  const key = getTrackingRef({ trackRef: trackingRef, code: trackingRef, id: trackingRef });
  if (!key) return null;
  const row = latchByRef.get(key);
  return row ? { ...row } : null;
}

/** Find latch matching any alias ref (code or UUID). */
export function findContractLatchForRefs(refs = []) {
  const list = Array.isArray(refs) ? refs : [refs];
  for (const r of list) {
    const key = String(r ?? '').trim();
    if (!key) continue;
    const direct = latchByRef.get(key);
    if (direct) return { ...direct };
  }
  for (const [, row] of latchByRef) {
    if (list.some((r) => trackingRefsMatch(r, row.lastActiveContractRef))) {
      return { ...row };
    }
  }
  return null;
}

export function isLatchTrackingActive(latch) {
  if (!latch) return false;
  const status = normalizeShipmentStatus(latch.lastKnownShipmentStatus) || '';
  return TRACKING_ACTIVE_STATUSES.includes(status);
}

export function clearContractLatchStore() {
  latchByRef.clear();
}
