/**
 * Bridge layer — maps existing realtime signals into ActiveShipmentStore updates.
 *
 * PHASE 1 (current): REST/bootstrap + hydrate events populate the store.
 * PHASE 2 (future): ShipmentEventStream pushes full payloads without REST fetch.
 *
 * Existing socket types (no new events): BID_ACCEPTED, CONTRACT_STARTED,
 * SPACE_ACCEPTED, STATUS_UPDATED — remain refresh signals only until Phase 2.
 */

import {
  getActiveShipmentList,
  removeActiveShipment,
  upsertActiveShipmentRows
} from './activeShipmentStore.js';

/** Future event types — require backend Phase 2 + new socket contract. */
export const SHIPMENT_EVENT_TYPES = Object.freeze({
  COMMITTED: 'SHIPMENT_COMMITTED',
  REJECTED: 'SHIPMENT_REJECTED',
  SUGGESTED: 'SHIPMENT_SUGGESTED',
  STATUS_UPDATED: 'SHIPMENT_STATUS_UPDATED'
});

const FUTURE_EVENT_TYPES = new Set(Object.values(SHIPMENT_EVENT_TYPES));

/**
 * Phase 2 handler — apply a versioned shipment event directly to the store.
 * Payload must include: shipmentId, loadCode, flowType, shipmentStatus, trackingEnabled, version.
 */
export function handleShipmentEvent(event = {}) {
  const type = String(event?.type || '').toUpperCase();
  const payload = event?.payload || event;
  const version = Number(payload?.version) || Date.now();

  if (type === SHIPMENT_EVENT_TYPES.REJECTED) {
    const key = payload.shipmentId || payload.loadCode;
    if (key) removeActiveShipment(key);
    return getActiveShipmentList();
  }

  if (
    type === SHIPMENT_EVENT_TYPES.COMMITTED ||
    type === SHIPMENT_EVENT_TYPES.STATUS_UPDATED ||
    type === SHIPMENT_EVENT_TYPES.SUGGESTED
  ) {
    return upsertActiveShipmentRows(
      [
        {
          ...payload,
          updatedAt: payload.updatedAt || new Date(version).toISOString()
        }
      ],
      { authoritative: false, source: 'event' }
    );
  }

  return getActiveShipmentList();
}

/** Returns true when dispatch type is a future stream event (Phase 2). */
export function isFutureShipmentEventType(type) {
  return FUTURE_EVENT_TYPES.has(String(type || '').toUpperCase());
}

/**
 * Bridge hook for realtimeDispatch — Phase 2 events go to store; legacy types unchanged.
 */
export function bridgeDispatchToShipmentStore(dispatch) {
  const type = String(dispatch?.type || '').toUpperCase();
  if (!isFutureShipmentEventType(type)) return false;

  const payload =
    dispatch?.payload ||
    dispatch?.notification ||
    dispatch?.shipment ||
    null;
  if (!payload) return false;

  handleShipmentEvent({
    type,
    payload: {
      ...payload,
      version: payload.version || dispatch?.at || Date.now()
    }
  });
  return true;
}
