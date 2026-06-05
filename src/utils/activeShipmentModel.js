import { getTrackingRef, trackingRefsMatch } from './trackingRefResolver.js';
import { normalizeShipmentStatus } from './shipmentStatus.js';
import { FLOW_TYPE } from './flowSession.js';

const TERMINAL_STATUSES = new Set(['delivered', 'closed', 'completed']);

/**
 * Normalize one row from GET /shipments/active — sole source of truth.
 */
export function normalizeActiveShipmentRow(row = {}) {
  const shipmentStatus = normalizeShipmentStatus(row.shipmentStatus ?? row.status) || 'booked';
  const flowTypeRaw = String(row.flowType || 'BID').toUpperCase();
  const flowType = flowTypeRaw === 'CAPACITY' ? FLOW_TYPE.CAPACITY : FLOW_TYPE.BID;
  const trackRef = getTrackingRef(row);
  const trackingEnabled =
    row.trackingEnabled != null
      ? Boolean(row.trackingEnabled)
      : !TERMINAL_STATUSES.has(shipmentStatus);

  return {
    ...row,
    shipmentStatus,
    flowType,
    trackRef,
    trackingEnabled
  };
}

export function normalizeActiveShipmentList(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  return list.map(normalizeActiveShipmentRow).filter((r) => r.trackRef);
}

/**
 * Merge active list update — never wipe valid UI on empty transient socket refresh.
 */
export function mergeActiveShipmentRows(prev = [], incoming, { silent = false } = {}) {
  const next = normalizeActiveShipmentList(incoming);
  const prior = Array.isArray(prev) ? prev : [];
  if (silent && prior.length > 0 && next.length === 0) return prior;
  return next;
}

export function isActiveShipmentTrackable(row = {}) {
  if (row.trackingEnabled != null) return Boolean(row.trackingEnabled);
  const status = normalizeShipmentStatus(row.shipmentStatus ?? row.status);
  return Boolean(status) && !TERMINAL_STATUSES.has(status);
}

export function findActiveShipmentRow(rows = [], trackRef = '') {
  const ref = String(trackRef || '').trim();
  if (!ref) return null;
  const list = Array.isArray(rows) ? rows : [];
  for (const raw of list) {
    const row = normalizeActiveShipmentRow(raw);
    if (
      trackingRefsMatch(row.trackRef, ref) ||
      trackingRefsMatch(row.code, ref) ||
      trackingRefsMatch(row.id, ref) ||
      trackingRefsMatch(row.shipmentId, ref)
    ) {
      return row;
    }
  }
  return null;
}

export async function fetchActiveShipmentRow(request, trackRef) {
  const data = await request({
    method: 'GET',
    url: '/shipments/active',
    skipGlobalErrorToast: true
  });
  return findActiveShipmentRow(normalizeActiveShipmentList(data), trackRef);
}
