import { normalizeContractFields } from './contractFieldNormalizer.js';
import { getTrackingRef } from './trackingRefResolver.js';
import { getShipmentUIState } from './shipmentUIState.js';
import { sanitizeTrackingPayload } from './trackingPayloadSanitizer.js';
import { normalizeShipmentStatus } from './shipmentStatus.js';

/**
 * REST-authoritative contract view. Socket/cache only fill gaps — never override REST contract fields.
 */
export function resolveContractConsistency({
  restShipment = {},
  trackingPayload = null,
  cachedUi = null,
  role = null
} = {}) {
  const rest = normalizeContractFields(restShipment);
  const track = trackingPayload ? sanitizeTrackingPayload(trackingPayload) : null;

  const restStatus = normalizeShipmentStatus(
    rest.status ?? rest.shipmentStatus ?? cachedUi?.status
  );
  const lockRestStatus = Boolean(rest.status ?? rest.shipmentStatus);
  const socketStatus =
    !lockRestStatus && track?.tracking?.status
      ? normalizeShipmentStatus(track.tracking.status)
      : null;

  const merged = normalizeContractFields({
    ...(track || {}),
    ...rest,
    role: role ?? rest.role ?? cachedUi?.role ?? null,
    status: restStatus || socketStatus || 'posted',
    shipmentStatus: rest.shipmentStatus ?? rest.status ?? restStatus,
    assignedCarrierId:
      rest.assignedCarrierId ??
      rest.assigned_carrier_id ??
      track?.assignedCarrierId ??
      track?.assigned_carrier_id ??
      null,
    ref:
      rest.ref ||
      getTrackingRef(rest) ||
      getTrackingRef(track) ||
      getTrackingRef(restShipment) ||
      track?.refKey ||
      null
  });

  const ui = getShipmentUIState(merged);

  return {
    isActiveContract: Boolean(ui.contractActive),
    isTrackable: Boolean(ui.canTrack),
    uiPhase: ui.phase,
    contractPhase: ui.contractPhase,
    colorVariant: ui.colorVariant,
    fields: merged,
    uiState: ui
  };
}
