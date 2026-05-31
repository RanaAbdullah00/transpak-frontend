import { emitRealtimeRefresh } from './realtimeRefresh.js';

const SCOPE_REFRESH = {
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
  SPACE_ACCEPTED: 'space',
  SPACE_REJECTED: 'space',
  SPACE_IN_TRANSIT: 'space',
  SPACE_COMPLETED: 'space',
  SPACE_UPDATE: 'space',
  CONTRACT_STARTED: 'bids',
  DELIVERED: 'shipments',
  DELIVERY_COMPLETED: 'shipments',
  SHIPMENT_PICKED_UP: 'shipments',
  SHIPMENT_IN_TRANSIT: 'shipments',
  LOGIN_SUCCESS: 'all'
};

/**
 * Apply dispatch:event side effects (lists refresh) without duplicate notification inserts.
 */
export function handleDispatchEvent(dispatch, { onNotification } = {}) {
  if (!dispatch || typeof dispatch !== 'object') return;

  const type = String(dispatch.type || '').toUpperCase();
  const scope = SCOPE_REFRESH[type] || 'all';
  emitRealtimeRefresh(scope);

  if (dispatch.notification && onNotification) {
    onNotification(dispatch.notification);
  }
}
