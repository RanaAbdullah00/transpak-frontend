import { normalizeShipmentStatus, nextShipmentStatus } from './shipmentStatus.js';
import { translateShipmentOrLoadStatus } from './i18nLabels.js';
import { normalizeContractFields } from './contractFieldNormalizer.js';
import { getTrackingRef } from './trackingRefResolver.js';
import {
  deriveContractPhase,
  getContractUIColor,
  getContractUILabelKey,
  CONTRACT_PHASE
} from './contractStateEngine.js';
import { resolveContractConsistency } from './contractConsistencyResolver.js';
import {
  mapLegacyToContract,
  canCarrierUpdateContractStatus,
  CONTRACT_STATUS
} from './contractMapper.js';
import {
  getOptimisticActivation,
  mergeOptimisticContractInput
} from './contractActivationLayer.js';

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

/** Per-status badge colors (safe Bootstrap variants only). */
const STATUS_COLOR_VARIANT = Object.freeze({
  booked: 'primary',
  pickedup: 'info',
  intransit: 'warning',
  delivered: 'success',
  closed: 'secondary',
  posted: 'secondary',
  open: 'success',
  cancelled: 'danger'
});

/**
 * State-only: contract is trackable when status is in-progress, carrier assigned, and ref exists.
 */
export function canTrackShipment(input = {}) {
  const { status, hasAssigned, hasValidRef } = contractTrackFlags(normalizeContractFields(input));
  return TRACKING_ACTIVE_STATUSES.includes(status) && hasAssigned && hasValidRef;
}

/** Alias for contract-active checks used across dashboards and tracking. */
export function isContractActive(input = {}) {
  return canTrackShipment(input);
}

/**
 * Single UI authority for shipment presentation and permissions.
 */
export function getShipmentUIState(input = {}) {
  const merged = mergeOptimisticContractInput(input);
  const normalized = normalizeContractFields(merged);
  const ref = normalized.ref || getTrackingRef(normalized);
  const optimistic = ref ? getOptimisticActivation(ref) : null;
  const { status, hasAssigned, hasValidRef } = contractTrackFlags({ ...normalized, ref });
  const unifiedContract = mapLegacyToContract({
    ...normalized,
    ref,
    ...merged,
    shipmentStatus: merged.shipmentStatus ?? merged.status
  });
  const contractActivatedFlag =
    Boolean(optimistic?.contractActivated) || Boolean(merged.contractActivated);
  const legacyCanTrack = canTrackShipment({
    ...normalized,
    ref,
    status: merged.shipmentStatus ?? merged.status
  });
  const contractAccepted =
    contractActivatedFlag ||
    unifiedContract.status === CONTRACT_STATUS.ACCEPTED ||
    unifiedContract.status === CONTRACT_STATUS.IN_TRANSIT;
  const contractRefResolved = unifiedContract.ref || ref;
  const shipmentActive = contractAccepted;
  const statusEngineUnlocked = contractAccepted;
  const contractTrackingEnabled =
    contractAccepted && Boolean(String(contractRefResolved || '').trim());
  const contractCanTrack =
    contractTrackingEnabled && Boolean(unifiedContract.trackingEnabled ?? true);
  const canTrack = legacyCanTrack || contractCanTrack;

  const contractPhase = deriveContractPhase({ ...normalized, ref, ...merged });
  const phase =
    contractPhase === CONTRACT_PHASE.COMPLETED
      ? 'completed'
      : contractPhase === CONTRACT_PHASE.ACTIVE || contractPhase === CONTRACT_PHASE.ACCEPTED
        ? 'active'
        : contractPhase === CONTRACT_PHASE.NEGOTIATED
          ? 'negotiation'
          : 'incomplete';

  const role = normalized.role ? String(normalized.role).toLowerCase() : null;
  const isShipper = role === 'shipper';
  const isCarrier = role === 'carrier';

  const colorVariant =
    getContractUIColor(contractPhase, status) ||
    STATUS_COLOR_VARIANT[status] ||
    'secondary';

  const labelKey =
    contractPhase === CONTRACT_PHASE.ACCEPTED
      ? 'status.accepted'
      : contractPhase === CONTRACT_PHASE.NEGOTIATED
        ? getContractUILabelKey(contractPhase, status)
        : status === 'booked' && isShipper
          ? 'status.accepted'
          : status && STATUS_COLOR_VARIANT[status]
            ? `status.${status}`
            : getContractUILabelKey(contractPhase, status);

  const contractRef = unifiedContract.ref || ref;
  const advanceFromStatus =
    unifiedContract.status === CONTRACT_STATUS.IN_TRANSIT
      ? 'intransit'
      : unifiedContract.status === CONTRACT_STATUS.ACCEPTED
        ? 'booked'
        : status;
  const upcoming = nextShipmentStatus(advanceFromStatus);
  const canUpdateStatus =
    isCarrier &&
    Boolean(String(contractRef || '').trim()) &&
    (canCarrierUpdateContractStatus(unifiedContract) ||
      (contractActivatedFlag &&
        (unifiedContract.status === CONTRACT_STATUS.ACCEPTED ||
          unifiedContract.status === CONTRACT_STATUS.IN_TRANSIT ||
          contractPhase === CONTRACT_PHASE.ACCEPTED ||
          contractPhase === CONTRACT_PHASE.ACTIVE)));

  return {
    status,
    phase,
    unifiedContract,
    labelKey,
    colorVariant,
    canTrack,
    trackingActive: canTrack,
    contractActive: canTrack || shipmentActive || status === 'delivered',
    isActive: canTrack || shipmentActive,
    isCompleted: phase === 'completed',
    showRouteMap: Boolean(status),
    showLiveMap: canTrack,
    showLiveDriver: canTrack,
    allowSocketJoin: canTrack,
    allowGpsPublish: canTrack && isCarrier,
    showCarrierAdvance: canUpdateStatus,
    canUpdateStatus,
    showShipperAcceptedBanner: (status === 'booked' || contractPhase === CONTRACT_PHASE.ACCEPTED) && isShipper,
    upcomingStatus: upcoming,
    lifecycleStage: normalized.lifecycleStage ?? null,
    hasValidRef,
    contractPhase,
    shipmentActive,
    statusEngineUnlocked,
    trackingEnabled: contractTrackingEnabled,
    contractActivated: contractActivatedFlag || shipmentActive
  };
}

export function withShipmentUILabels(uiState, t) {
  if (!uiState) return uiState;
  let label = uiState.status || '';
  if (t && uiState.labelKey) {
    const translated = t(uiState.labelKey);
    label = translated !== uiState.labelKey ? translated : label;
  }
  if (t && (!label || label === uiState.labelKey)) {
    label = translateShipmentOrLoadStatus(t, uiState.status) || t('status.unknown');
  }
  const colorVariant = uiState.colorVariant || 'secondary';
  return {
    ...uiState,
    label,
    color: colorVariant
  };
}

export function shipmentUIStateFromTracking(payload, role, extras = {}) {
  return resolveContractConsistency({
    restShipment: extras,
    trackingPayload: payload,
    role
  }).uiState;
}

export function shipmentUIStateFromActiveRow(row, role) {
  const fields = normalizeContractFields({
    status: row?.shipmentStatus ?? row?.status,
    assignedCarrierId: row?.assignedCarrierId ?? row?.assigned_carrier_id,
    ref: row?.ref ?? row?.code ?? row?.loadCode ?? row?.refKey,
    role,
    ...row
  });
  return getShipmentUIState({
    ...fields,
    ref: fields.ref || getTrackingRef(row)
  });
}
