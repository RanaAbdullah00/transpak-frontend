import { runShipmentSyncFromDispatch } from './contractActivation.js';
import { ingestRealtimeDispatch } from './notificationPipeline.js';
import {
  buildNotificationEventId,
  hasNotificationEventId
} from './notificationEventRegistry.js';

/** @deprecated internal — scopes handled in notificationPipeline */
export const SCOPE_REFRESH = {
  LOAD_POSTED: 'loads',
  BID_CREATED: 'bids',
  BID_UPDATED: 'bids',
  BID_RECEIVED: 'bids',
  BID_ACCEPTED: 'bids',
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

/**
 * Socket dispatch entry — shipment sync ALWAYS runs; dedupe blocks notifications only.
 */
export function handleDispatchEvent(dispatch, { onNotification } = {}) {
  if (!dispatch || typeof dispatch !== 'object') return;
  const type = String(dispatch.type || '').toUpperCase();

  runShipmentSyncFromDispatch(dispatch, type);

  const probeId = buildNotificationEventId({
    dispatchType: type,
    shipmentRef:
      dispatch.notification?.shipmentRef ||
      dispatch.notification?.refKey ||
      dispatch.payload?.loadCode ||
      dispatch.refKey ||
      dispatch.notification?.code,
    timestamp: dispatch.notification?.createdAt || dispatch.ts,
    eventId: dispatch.eventId || dispatch.notification?.id
  });
  if (hasNotificationEventId(probeId)) return;

  ingestRealtimeDispatch(dispatch, { onPersistedNotification: onNotification });
}
