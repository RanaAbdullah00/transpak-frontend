import { normalizeContractFields } from './contractFieldNormalizer.js';
import { getTrackingRef } from './trackingRefResolver.js';
import { canTrackShipment } from './shipmentUIState.js';
import { normalizeShipmentStatus } from './shipmentStatus.js';
import { isStaleRestShipmentStatus } from './contractActivationLayer.js';
import {
  normalizeBidStatus,
  isAwaitingShipper,
  isCounterOffered,
  BID_STATUS
} from './bidStatus.js';

/** Frontend-only contract phases (does not change backend FSM). */
export const CONTRACT_PHASE = Object.freeze({
  PENDING: 'pending',
  NEGOTIATED: 'negotiated',
  ACCEPTED: 'accepted',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CLOSED: 'closed'
});

/** Safe Bootstrap badge variants per phase/status. */
export function getContractUIColor(phase, status = null) {
  const s = normalizeShipmentStatus(status);
  if (phase === CONTRACT_PHASE.NEGOTIATED) return 'warning';
  if (phase === CONTRACT_PHASE.ACCEPTED) return 'success';
  if (phase === CONTRACT_PHASE.ACTIVE) {
    if (s === 'intransit') return 'warning';
    if (s === 'pickedup') return 'info';
    return 'primary';
  }
  if (phase === CONTRACT_PHASE.COMPLETED || s === 'delivered') return 'success';
  if (phase === CONTRACT_PHASE.CLOSED || s === 'closed' || s === 'cancelled') return 'secondary';
  if (phase === CONTRACT_PHASE.PENDING) return 'warning';
  return 'secondary';
}

/**
 * Derive unified contract phase for Flow A (bids) and Flow B (capacity rows).
 */
export function deriveContractPhase(input = {}) {
  if (input.contractActivated) {
    const fields = normalizeContractFields(input);
    const ref = fields.ref || getTrackingRef(input);
    const status = normalizeShipmentStatus(
      input.shipmentStatus ?? input.status ?? 'booked'
    );
    if (
      canTrackShipment({
        ...fields,
        ref,
        status: input.shipmentStatus ?? input.status ?? 'booked'
      })
    ) {
      return CONTRACT_PHASE.ACTIVE;
    }
    return CONTRACT_PHASE.ACCEPTED;
  }

  const bidStatus = input.bidStatus ?? input.bid?.status;
  if (bidStatus != null && !input.contractActivated) {
    const st = normalizeBidStatus(bidStatus);
    if (st === BID_STATUS.ACCEPTED) {
      const fields = normalizeContractFields(input);
      const ref = fields.ref || getTrackingRef(input);
      if (
        canTrackShipment({
          ...fields,
          ref,
          status: input.shipmentStatus ?? input.status
        })
      ) {
        return CONTRACT_PHASE.ACTIVE;
      }
      return CONTRACT_PHASE.ACCEPTED;
    }
    if (isAwaitingShipper(bidStatus) || isCounterOffered(bidStatus)) {
      return CONTRACT_PHASE.NEGOTIATED;
    }
    if (st === BID_STATUS.REJECTED || st === BID_STATUS.CANCELLED) {
      return CONTRACT_PHASE.CLOSED;
    }
    return CONTRACT_PHASE.PENDING;
  }

  const fields = normalizeContractFields(input);
  const ref = fields.ref || getTrackingRef(input);
  const status = normalizeShipmentStatus(
    input.shipmentStatus ?? input.status ?? input.tracking?.status
  );

  if (isStaleRestShipmentStatus(status)) {
    const sr = String(input.spaceRequestStatus || '').toLowerCase();
    if (sr === 'accepted' || sr === 'active' || sr === 'in_transit' || sr === 'intransit') {
      return CONTRACT_PHASE.ACCEPTED;
    }
    const bidSt = normalizeBidStatus(input.bidStatus ?? input.bid?.status);
    if (bidSt === BID_STATUS.ACCEPTED) return CONTRACT_PHASE.ACCEPTED;
  }

  if (canTrackShipment({ ...fields, ref, status: input.shipmentStatus ?? input.status })) {
    return CONTRACT_PHASE.ACTIVE;
  }
  if (status === 'delivered') return CONTRACT_PHASE.COMPLETED;
  if (status === 'closed' || status === 'cancelled') return CONTRACT_PHASE.CLOSED;

  if (input.spaceRequestStatus) {
    const sr = String(input.spaceRequestStatus).toLowerCase();
    if (sr === 'accepted' || sr === 'active' || sr === 'in_transit' || sr === 'intransit') {
      if (
        canTrackShipment({ ...fields, ref, status: input.shipmentStatus ?? 'booked' })
      ) {
        return CONTRACT_PHASE.ACTIVE;
      }
      return CONTRACT_PHASE.ACCEPTED;
    }
    if (sr === 'pending' || sr === 'requested') return CONTRACT_PHASE.NEGOTIATED;
    if (sr === 'completed' || sr === 'closed') return CONTRACT_PHASE.COMPLETED;
  }

  return CONTRACT_PHASE.PENDING;
}

/** Whether shipper-side acceptance should refresh active shipments + tracking. */
export function shouldActivateContractOnShipperAccept() {
  return true;
}

/** Carrier marketplace accept — negotiation only, never active contract. */
export function shouldActivateContractOnCarrierAccept() {
  return false;
}

export function getContractUILabelKey(phase, status = null) {
  if (phase === CONTRACT_PHASE.NEGOTIATED) return 'bidFlow.negotiationAwaitingShipper';
  if (phase === CONTRACT_PHASE.ACCEPTED) return 'status.accepted';
  if (phase === CONTRACT_PHASE.ACTIVE) {
    const s = normalizeShipmentStatus(status);
    return s ? `status.${s}` : 'status.booked';
  }
  if (phase === CONTRACT_PHASE.COMPLETED) return 'status.delivered';
  if (phase === CONTRACT_PHASE.CLOSED) return 'status.closed';
  return 'status.pending';
}
