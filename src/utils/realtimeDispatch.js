import { runShipmentSyncFromDispatch } from './contractActivation.js';
import { commitOptimisticActivation } from './contractActivationLayer.js';
import { isValidShipmentTrackRef } from './shipmentStatus.js';
import { bridgeDispatchToShipmentStore } from './shipmentEventBridge.js';
import { ingestRealtimeDispatch } from './notificationPipeline.js';
import { reconcileContractUpdate, shouldTriggerContractSync } from './contractSyncGuarantee.js';
import {
  buildNotificationEventId,
  hasNotificationEventId
} from './notificationEventRegistry.js';
import { emitShipmentStatusUpdated } from './shipmentStatusOptimistic.js';

/** @deprecated internal — scopes handled in notificationPipeline */
export const SCOPE_REFRESH = {
  LOAD_POSTED: 'loads',
  BID_CREATED: 'bids',
  BID_UPDATED: 'bids',
  BID_RECEIVED: 'bids',
  BID_ACCEPTED: 'loads',
  BID_REJECTED: 'bids',
  BID_COUNTER: 'bids',
  COUNTER_OFFERED: 'bids',
  SHIPPER_CONFIRMATION_REQUEST: 'bids',
  SHIPMENT_STATUS: 'shipments',
  TRUCK_UPDATED: 'all',
  TRUCK_APPROVED: 'all',
  TRUCK_REJECTED: 'all',
  TRUCK_SUSPENDED: 'all',
  SPACE_LISTED: 'loads',
  CAPACITY_PUBLISHED: 'loads',
  SPACE_REQUEST: 'space',
  SPACE_REQUEST_SENT: 'space',
  SPACE_ACCEPTED: 'space',
  SPACE_REJECTED: 'space',
  SPACE_IN_TRANSIT: 'space',
  SPACE_COMPLETED: 'space',
  SPACE_UPDATE: 'space',
  CONTRACT_STARTED: 'shipments',
  DELIVERED: 'shipments',
  DELIVERY_COMPLETED: 'shipments',
  SHIPMENT_PICKED_UP: 'shipments',
  SHIPMENT_IN_TRANSIT: 'shipments',
  SHIPMENT_CREATED: 'shipments',
  CAPACITY_ACCEPTED: 'shipments',
  REVIEW_RECEIVED: 'all',
  USER_REGISTERED: 'all',
  SPACE_CLOSED: 'space',
  LOGIN_SUCCESS: 'all',
  VERIFICATION_PENDING: 'all',
  VERIFICATION_APPROVED: 'all',
  VERIFICATION_REJECTED: 'all',
  TRUCK_PENDING: 'all'
};

const STATUS_DISPATCH_TYPES = new Set([
  'SHIPMENT_PICKED_UP',
  'SHIPMENT_IN_TRANSIT',
  'DELIVERY_COMPLETED',
  'DELIVERED',
  'SHIPMENT_STATUS',
  'STATUS_UPDATED'
]);

const STATUS_FROM_DISPATCH_TYPE = Object.freeze({
  SHIPMENT_PICKED_UP: 'pickedup',
  SHIPMENT_IN_TRANSIT: 'intransit',
  DELIVERY_COMPLETED: 'delivered',
  DELIVERED: 'delivered'
});

function emitShipmentStatusUpdatedFromDispatch(dispatch, type) {
  if (!STATUS_DISPATCH_TYPES.has(type)) return;
  const ref = String(
    dispatch.payload?.loadCode ||
      dispatch.payload?.ref ||
      dispatch.notification?.shipmentRef ||
      dispatch.notification?.refKey ||
      dispatch.refKey ||
      ''
  ).trim();
  if (!ref) return;
  const status =
    dispatch.payload?.status ||
    dispatch.notification?.status ||
    STATUS_FROM_DISPATCH_TYPE[type] ||
    null;
  if (status) {
    emitShipmentStatusUpdated(ref, status, { source: 'dispatch' });
  }
}

const SOCKET_CONTRACT_ACTIVATION_TYPES = new Set(['BID_ACCEPTED', 'CONTRACT_STARTED', 'SPACE_ACCEPTED']);

function applySocketContractActivation(dispatch, type) {
  try {
    if (!SOCKET_CONTRACT_ACTIVATION_TYPES.has(type)) return;
    const payload =
      (dispatch?.payload && typeof dispatch.payload === 'object' ? dispatch.payload : null) ||
      (dispatch?.notification && typeof dispatch.notification === 'object'
        ? dispatch.notification
        : {}) ||
      {};
    const loadCode = String(
      payload.loadCode ?? payload.code ?? payload.ref ?? payload.shipmentRef ?? ''
    ).trim();
    if (!loadCode || !isValidShipmentTrackRef(loadCode)) return;
    commitOptimisticActivation(
      {
        loadCode,
        origin: payload.origin ?? null,
        destination: payload.destination ?? null,
        shipmentStatus: payload.shipmentStatus ?? payload.status ?? 'booked',
        flowType: payload.flowType ?? null
      },
      { ref: loadCode }
    );
  } catch {
    /* socket activation must never crash UI */
  }
}

/**
 * Socket dispatch entry — shipment refresh runs before dedupe; notifications may be deduped, UI refresh is not.
 */
export function handleDispatchEvent(dispatch, { onNotification } = {}) {
  if (!dispatch || typeof dispatch !== 'object') return;
  const type = String(dispatch.type || '').toUpperCase();

  applySocketContractActivation(dispatch, type);
  emitShipmentStatusUpdatedFromDispatch(dispatch, type);

  if (!bridgeDispatchToShipmentStore(dispatch)) {
    runShipmentSyncFromDispatch(dispatch, type);
  }

  if (shouldTriggerContractSync(type)) {
    void reconcileContractUpdate({ dispatch, source: 'socket' });
  }

  const probeId = buildNotificationEventId({
    dispatchType: type,
    shipmentRef:
      dispatch.notification?.shipmentRef ||
      dispatch.notification?.refKey ||
      dispatch.payload?.loadCode ||
      dispatch.refKey ||
      dispatch.notification?.code,
    entityId:
      dispatch.eventId ||
      dispatch.notification?.id ||
      dispatch.payload?.bidId ||
      dispatch.payload?.truckId ||
      dispatch.entityId,
    timestamp: dispatch.notification?.createdAt || dispatch.ts,
    eventId: dispatch.eventId || dispatch.notification?.id
  });
  if (hasNotificationEventId(probeId)) return;

  ingestRealtimeDispatch(dispatch, { onPersistedNotification: onNotification });
}
