import { normalizeBidStatus, BID_STATUS, isCounterOffered, isAwaitingShipper } from './bidStatus.js';
import { normalizeShipmentStatus } from './shipmentStatus.js';
import { normalizeContractFields } from './contractFieldNormalizer.js';
import { getTrackingRef } from './trackingRefResolver.js';
import { isStaleRestShipmentStatus } from './contractActivationLayer.js';

/** Unified contract model — maps legacy bid/load/space rows without changing APIs. */
export const CONTRACT_TYPE = Object.freeze({
  LOAD: 'LOAD',
  SPACE: 'SPACE'
});

export const CONTRACT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  IN_TRANSIT: 'IN_TRANSIT',
  COMPLETED: 'COMPLETED'
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [CONTRACT_STATUS.PENDING]: new Set([CONTRACT_STATUS.ACCEPTED]),
  [CONTRACT_STATUS.ACCEPTED]: new Set([CONTRACT_STATUS.IN_TRANSIT]),
  [CONTRACT_STATUS.IN_TRANSIT]: new Set([CONTRACT_STATUS.COMPLETED]),
  [CONTRACT_STATUS.COMPLETED]: new Set()
});

function mapSpaceStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === 'request_sent') return CONTRACT_STATUS.PENDING;
  if (s === 'rejected') return CONTRACT_STATUS.PENDING;
  if (s === 'active' || s === 'accepted') return CONTRACT_STATUS.ACCEPTED;
  if (s === 'in_transit' || s === 'intransit') return CONTRACT_STATUS.IN_TRANSIT;
  if (s === 'completed' || s === 'closed') return CONTRACT_STATUS.COMPLETED;
  return CONTRACT_STATUS.PENDING;
}

function mapShipmentToContractStatus(raw) {
  const s = normalizeShipmentStatus(raw);
  if (!s || s === 'posted' || s === 'open') return CONTRACT_STATUS.PENDING;
  if (s === 'booked' || s === 'pickedup') return CONTRACT_STATUS.ACCEPTED;
  if (s === 'intransit') return CONTRACT_STATUS.IN_TRANSIT;
  if (s === 'delivered' || s === 'closed' || s === 'cancelled') return CONTRACT_STATUS.COMPLETED;
  return CONTRACT_STATUS.PENDING;
}

function mapBidToContractStatus(bidStatus) {
  const st = normalizeBidStatus(bidStatus);
  if (st === BID_STATUS.ACCEPTED) return CONTRACT_STATUS.ACCEPTED;
  if (st === BID_STATUS.REJECTED || st === BID_STATUS.CANCELLED) return CONTRACT_STATUS.COMPLETED;
  if (isAwaitingShipper(bidStatus) || isCounterOffered(bidStatus)) return CONTRACT_STATUS.PENDING;
  return CONTRACT_STATUS.PENDING;
}

/**
 * Map any legacy row (bid, load, space request, active shipment) → unified Contract.
 */
export function mapLegacyToContract(input = {}) {
  if (input.contractActivated) {
    const fields = normalizeContractFields(input);
    const ref = fields.ref || getTrackingRef(input);
    const isSpaceRow =
      input.listingId != null ||
      input.requestedKg != null ||
      input.spaceRequestId != null ||
      String(input.flowType || '').toUpperCase() === 'CAPACITY' ||
      String(input.booking_reference || input.bookingReference || '').startsWith('space:');
    const shipmentStatus = input.shipmentStatus ?? input.status ?? 'booked';
    const ship = mapShipmentToContractStatus(shipmentStatus);
    const status =
      ship === CONTRACT_STATUS.IN_TRANSIT || ship === CONTRACT_STATUS.COMPLETED
        ? ship
        : CONTRACT_STATUS.ACCEPTED;
    return {
      id: String(input.id ?? input.requestId ?? input.shipmentId ?? ref ?? '').trim() || null,
      type: isSpaceRow ? CONTRACT_TYPE.SPACE : CONTRACT_TYPE.LOAD,
      status,
      shipperId: input.shipperId ?? input.shipper_id ?? null,
      carrierId: fields.assignedCarrierId ?? input.carrierId ?? input.carrier_id ?? null,
      trackingEnabled: Boolean(ref),
      ref
    };
  }

  const fields = normalizeContractFields(input);
  const ref = fields.ref || getTrackingRef(input);
  const isSpaceRow =
    input.listingId != null ||
    input.requestedKg != null ||
    input.spaceRequestId != null ||
    String(input.flowType || '').toUpperCase() === 'CAPACITY' ||
    String(input.booking_reference || input.bookingReference || '').startsWith('space:');
  const spaceStatus =
    input.spaceRequestStatus ?? input.spaceStatus ?? (isSpaceRow ? input.status : null);
  const bidStatus = input.bidStatus ?? input.bid?.status;
  const shipmentStatus = input.shipmentStatus ?? input.tracking?.status ?? input.status;

  let type = CONTRACT_TYPE.LOAD;
  let status = CONTRACT_STATUS.PENDING;

  if (spaceStatus != null && isSpaceRow) {
    type = CONTRACT_TYPE.SPACE;
    status = mapSpaceStatus(spaceStatus);
  } else if (bidStatus != null) {
    type = CONTRACT_TYPE.LOAD;
    status = mapBidToContractStatus(bidStatus);
    if (status === CONTRACT_STATUS.ACCEPTED) {
      const ship = mapShipmentToContractStatus(shipmentStatus);
      if (ship === CONTRACT_STATUS.IN_TRANSIT || ship === CONTRACT_STATUS.COMPLETED) status = ship;
      else if (ship === CONTRACT_STATUS.ACCEPTED) status = CONTRACT_STATUS.ACCEPTED;
      else if (isStaleRestShipmentStatus(shipmentStatus)) status = CONTRACT_STATUS.ACCEPTED;
    }
  } else if (shipmentStatus != null) {
    type = input.flowType === 'CAPACITY' ? CONTRACT_TYPE.SPACE : CONTRACT_TYPE.LOAD;
    status = mapShipmentToContractStatus(shipmentStatus);
  } else if (spaceStatus != null) {
    type = CONTRACT_TYPE.SPACE;
    status = mapSpaceStatus(spaceStatus);
  }

  const trackingEnabled =
    (status === CONTRACT_STATUS.ACCEPTED || status === CONTRACT_STATUS.IN_TRANSIT) &&
    Boolean(ref);

  return {
    id: String(input.id ?? input.requestId ?? input.shipmentId ?? ref ?? '').trim() || null,
    type,
    status,
    shipperId: input.shipperId ?? input.shipper_id ?? null,
    carrierId: fields.assignedCarrierId ?? input.carrierId ?? input.carrier_id ?? null,
    trackingEnabled,
    ref
  };
}

export function canTransitionContract(fromStatus, toStatus) {
  const from = String(fromStatus || '').toUpperCase();
  const to = String(toStatus || '').toUpperCase();
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false;
}

/** Carrier may advance lifecycle only after acceptance (ACCEPTED or IN_TRANSIT). */
export function canCarrierUpdateContractStatus(contract = {}) {
  const status = String(contract.status || '').toUpperCase();
  return status === CONTRACT_STATUS.ACCEPTED || status === CONTRACT_STATUS.IN_TRANSIT;
}

/** Listing close allowed when no active contract or all contracts completed. */
export function canCloseListingWithContract(listing = {}) {
  const activeCount = Number(listing.activeRequestCount ?? 0);
  if (activeCount > 0) return false;
  return true;
}

/** Normalize socket/API event names → unified contract event vocabulary (display/routing only). */
export function normalizeContractEventType(rawType = '') {
  const t = String(rawType || '').toUpperCase();
  const ALIAS = {
    CONTRACT_CREATED: 'CONTRACT_STARTED',
    CONTRACT_ACCEPTED: 'CONTRACT_STARTED',
    CONTRACT_REJECTED: 'BID_REJECTED',
    CONTRACT_COMPLETED: 'DELIVERY_COMPLETED',
    COUNTER_OFFER_SENT: 'COUNTER_OFFERED',
    COUNTER_OFFER_ACCEPTED: 'BID_ACCEPTED',
    STATUS_UPDATED: 'SHIPMENT_STATUS',
    LOCATION_UPDATED: 'LOCATION_UPDATED',
    LOAD_POSTED: 'LOAD_POSTED',
    REQUEST_SENT: 'SPACE_REQUEST_SENT',
    REQUEST_ACCEPTED: 'SPACE_ACCEPTED',
    REQUEST_REJECTED: 'SPACE_REJECTED'
  };
  return ALIAS[t] || t;
}
