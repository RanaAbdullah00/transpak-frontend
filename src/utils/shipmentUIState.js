import { normalizeShipmentStatus, nextShipmentStatus } from './shipmentStatus.js';

/** Statuses where live GPS + socket tracking are allowed (matches backend contract). */
export const TRACKING_ACTIVE_STATUSES = Object.freeze(['booked', 'pickedup', 'intransit']);

/**
 * Single UI authority for shipment presentation and permissions.
 * @param {{
 *   status?: string,
 *   shipmentStatus?: string,
 *   tracking?: { status?: string },
 *   assignedCarrierId?: string|null,
 *   assigned_carrier_id?: string|null,
 *   role?: 'shipper'|'carrier'|'admin'|null,
 *   lifecycleStage?: string|null
 * }} input
 */
export function getShipmentUIState(input = {}) {
  const status =
    normalizeShipmentStatus(
      input.status ?? input.shipmentStatus ?? input.tracking?.status ?? 'posted'
    ) || 'posted';

  const assignedRaw = input.assignedCarrierId ?? input.assigned_carrier_id;
  const lifecycleKey = String(input.lifecycleStage || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const lifecycleImpliesAssigned = [
    'bid_accepted',
    'assigned',
    'in_transit',
    'delivered',
    'closed'
  ].includes(lifecycleKey);
  const hasAssigned =
    Boolean(String(assignedRaw ?? '').trim()) ||
    (TRACKING_ACTIVE_STATUSES.includes(status) && lifecycleImpliesAssigned);

  const canTrack = TRACKING_ACTIVE_STATUSES.includes(status) && hasAssigned;

  const phase =
    status === 'delivered' || status === 'closed'
      ? 'completed'
      : TRACKING_ACTIVE_STATUSES.includes(status)
        ? 'active'
        : 'incomplete';

  const role = input.role ? String(input.role).toLowerCase() : null;
  const isShipper = role === 'shipper';
  const isCarrier = role === 'carrier';

  const colorVariant =
    phase === 'completed' ? 'success' : phase === 'active' ? 'primary' : 'secondary';

  const labelKey =
    status === 'booked' && isShipper ? 'status.accepted' : `status.${status}`;

  const upcoming = nextShipmentStatus(status);
  const canUpdateStatus = canTrack && isCarrier && status !== 'closed' && Boolean(upcoming);

  const base = {
    status,
    phase,
    labelKey,
    colorVariant,
    canTrack,
    trackingActive: canTrack,
    contractActive: canTrack || status === 'delivered',
    isActive: phase === 'active',
    isCompleted: phase === 'completed',
    showRouteMap: Boolean(status),
    showLiveMap: canTrack,
    showLiveDriver: canTrack,
    allowSocketJoin: canTrack,
    allowGpsPublish: canTrack && isCarrier,
    showCarrierAdvance: canUpdateStatus,
    canUpdateStatus,
    showShipperAcceptedBanner: status === 'booked' && isShipper,
    upcomingStatus: upcoming,
    lifecycleStage: input.lifecycleStage ?? null
  };

  return base;
}

/** Attach translated label + canonical permission aliases for components. */
export function withShipmentUILabels(uiState, t) {
  if (!uiState) return uiState;
  const label =
    t && uiState.labelKey
      ? t(uiState.labelKey) !== uiState.labelKey
        ? t(uiState.labelKey)
        : uiState.status
      : uiState.status;
  return {
    ...uiState,
    label,
    color: uiState.colorVariant
  };
}

/**
 * Build resolver input from a tracking API payload + workspace role.
 */
export function shipmentUIStateFromTracking(payload, role, extras = {}) {
  if (!payload && !extras.status && !extras.shipmentStatus) {
    return getShipmentUIState({ status: 'posted', role, ...extras });
  }
  return getShipmentUIState({
    status: extras.status ?? extras.shipmentStatus ?? payload?.tracking?.status,
    assignedCarrierId:
      extras.assignedCarrierId ??
      extras.assigned_carrier_id ??
      payload?.assignedCarrierId ??
      payload?.assigned_carrier_id,
    lifecycleStage: extras.lifecycleStage ?? payload?.lifecycleStage,
    role
  });
}

/** Dashboard list row → UI state (API filter fields only). */
export function shipmentUIStateFromActiveRow(row, role) {
  return getShipmentUIState({
    status: row?.shipmentStatus ?? row?.status,
    assignedCarrierId: row?.assignedCarrierId ?? row?.assigned_carrier_id,
    role
  });
}
