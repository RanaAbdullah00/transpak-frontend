import { emitRealtimeRefresh } from './realtimeRefresh.js';

const SCOPE_REFRESH = {
  LOAD_POSTED: 'loads',
  BID_RECEIVED: 'bids',
  BID_ACCEPTED: 'bids',
  BID_REJECTED: 'bids',
  COUNTER_OFFERED: 'bids',
  SHIPMENT_STATUS: 'shipments',
  TRUCK_APPROVED: 'all',
  TRUCK_REJECTED: 'all',
  TRUCK_SUSPENDED: 'all'
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
