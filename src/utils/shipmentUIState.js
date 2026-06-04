import { normalizeShipmentStatus, nextShipmentStatus } from './shipmentStatus.js';
import { normalizeContractFields } from './contractFieldNormalizer.js';

/** Statuses where live GPS + socket tracking are allowed (matches backend contract). */
export const TRACKING_ACTIVE_STATUSES = Object.freeze(['booked', 'pickedup', 'intransit']);

function contractTrackFlags(input = {}) {
  const fields = normalizeContractFields(input);
  const status =
    normalizeShipmentStatus(
      input.status ?? input.shipmentStatus ?? input.tracking?.status ?? 'posted'
    ) || 'posted';
  const hasAssigned = Boolean(String(fields.assignedCarrierId ?? '').trim());
  const hasValidRef = Boolean(String(fields.ref ?? '').trim());
  return { status, hasAssigned, hasValidRef };
}

/**
 * State-only: contract is trackable when status is in-progress, carrier assigned, and ref exists.
 */
export function canTrackShipment(input = {}) {
  const { status, hasAssigned, hasValidRef } = contractTrackFlags(input);
  return TRACKING_ACTIVE_STATUSES.includes(status) && hasAssigned && hasValidRef;
}

/**
 * Single UI authority for shipment presentation and permissions.
 */
export function getShipmentUIState(input = {}) {
  const status =
    normalizeShipmentStatus(
      input.status ?? input.shipmentStatus ?? input.tracking?.status ?? 'posted'
    ) || 'posted';

  const assignedRaw = input.assignedCarrierId ?? input.assigned_carrier_id;
  const hasAssigned = Boolean(String(assignedRaw ?? '').trim());
  const canTrack = TRACKING_ACTIVE_STATUSES.includes(status) && hasAssigned;

  const phase =
    status === 'delivered' || status === 'closed'
      ? 'completed'
      : canTrack
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

  return {
    status,
    phase,
    labelKey,
    colorVariant,
    canTrack,
    trackingActive: canTrack,
    contractActive: canTrack || status === 'delivered',
    isActive: canTrack,
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
}

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

export function shipmentUIStateFromTracking(payload, role, extras = {}) {
  if (!payload && !extras.status && !extras.shipmentStatus) {
    return getShipmentUIState(normalizeContractFields({ status: 'posted', role, ...extras }));
  }
  return getShipmentUIState(
    normalizeContractFields({
      status: extras.status ?? extras.shipmentStatus ?? payload?.tracking?.status,
      assignedCarrierId:
        extras.assignedCarrierId ??
        extras.assigned_carrier_id ??
        payload?.assignedCarrierId ??
        payload?.assigned_carrier_id,
      ref:
        extras.ref ??
        extras.code ??
        extras.loadCode ??
        payload?.ref ??
        payload?.code ??
        payload?.loadCode ??
        payload?.refKey,
      lifecycleStage: extras.lifecycleStage ?? payload?.lifecycleStage,
      role
    })
  );
}

export function shipmentUIStateFromActiveRow(row, role) {
  return getShipmentUIState(
    normalizeContractFields({
      status: row?.shipmentStatus ?? row?.status,
      assignedCarrierId: row?.assignedCarrierId ?? row?.assigned_carrier_id,
      ref: row?.ref ?? row?.code ?? row?.loadCode ?? row?.refKey,
      role
    })
  );
}
