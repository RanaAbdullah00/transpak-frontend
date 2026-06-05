import { normalizeShipmentStatus } from './shipmentStatus.js';
import {
  assertIsSnapshotConsumer,
  getUnifiedShipmentSnapshot,
  SAFE_UI_STATE,
  TRACKING_ACTIVE_STATUSES
} from './shipmentUIState.js';
import {
  findContractLatchForRefs,
  isLatchTrackingActive,
  updateContractLatch
} from './contractLatchStore.js';
import { collectTrackingRefs, getTrackingRef, trackingRefsMatch } from './trackingRefResolver.js';

/**
 * State-first contract resolver (socket/events are accelerators only).
 * @param {object} input row, tracking payload, or activation opts
 * @param {{ source?: 'state'|'event'|'latch', role?: string }} [opts]
 */
export function resolveContractState(input = {}, opts = {}) {
  const trackingRef = getTrackingRef(input);
  const assignedCarrierId =
    input.assignedCarrierId ?? input.assigned_carrier_id ?? null;
  const status = normalizeShipmentStatus(
    input.status ??
      input.shipmentStatus ??
      input.tracking?.status ??
      input.lastKnownShipmentStatus
  );

  const snapshot = assertIsSnapshotConsumer(
    getUnifiedShipmentSnapshot({
      ...input,
      restRow: input.restRow ?? input,
      ref: trackingRef,
      status,
      assignedCarrierId,
      lifecycleStage: input.lifecycleStage,
      role: opts.role ?? input.role
    }),
    'resolveContractState'
  );
  const ui = snapshot.uiState ?? SAFE_UI_STATE;

  const refs = collectTrackingRefs({ ...input, trackRef: trackingRef });
  const latch = findContractLatchForRefs(refs);
  const latchActive = isLatchTrackingActive(latch);

  const hasAssigned =
    Boolean(String(assignedCarrierId ?? '').trim()) ||
    Boolean(String(latch?.assignedCarrierId ?? '').trim()) ||
    TRACKING_ACTIVE_STATUSES.includes(status) ||
    (latchActive && Boolean(trackingRef));

  const stateCanTrack = TRACKING_ACTIVE_STATUSES.includes(ui.status) && hasAssigned;
  const latchCanTrack =
    latchActive &&
    hasAssigned &&
    (!trackingRef ||
      trackingRefsMatch(trackingRef, latch.lastActiveContractRef) ||
      refs.includes(latch.lastActiveContractRef));

  const canTrack = stateCanTrack || latchCanTrack;
  const isActive = ui.isActive || (latchActive && canTrack);

  let source = opts.source || 'state';
  if (!stateCanTrack && latchCanTrack) source = 'latch';
  if (opts.source === 'event') source = 'event';

  const role = opts.role ?? input.role;
  const isCarrier = role === 'carrier';

  return {
    isActive,
    canTrack,
    contractActive: canTrack || ui.contractActive,
    trackingRef: trackingRef || latch?.lastActiveContractRef || '',
    assignedCarrierId:
      assignedCarrierId ?? latch?.assignedCarrierId ?? null,
    status: ui.status || latch?.lastKnownShipmentStatus || status,
    source,
    uiState: {
      ...ui,
      canTrack,
      trackingActive: canTrack,
      contractActive: canTrack || ui.contractActive,
      isActive,
      showLiveMap: canTrack,
      showLiveDriver: canTrack,
      allowSocketJoin: canTrack,
      allowGpsPublish: canTrack && isCarrier && canTrack
    },
    latch: latchActive ? latch : null
  };
}

/** Persist latch from REST tracking payload when contract is active. */
export function syncContractLatchFromPayload(payload, extras = {}) {
  if (!payload) return null;
  const trackingRef = getTrackingRef(payload);
  const status = payload?.tracking?.status;
  const norm = normalizeShipmentStatus(status);
  if (!TRACKING_ACTIVE_STATUSES.includes(norm)) return null;

  return updateContractLatch({
    trackRef: trackingRef,
    loadId: payload.loadId,
    status: norm,
    assignedCarrierId:
      extras.assignedCarrierId ??
      extras.assigned_carrier_id ??
      payload.assignedCarrierId ??
      payload.assigned_carrier_id,
    source: 'state'
  });
}

/** Tracking API payload + role → UI state with latch fallback. */
export function contractUIStateFromTracking(payload, role, extras = {}) {
  const resolved = resolveContractState(
    {
      ...extras,
      ...payload,
      status: extras.status ?? extras.shipmentStatus ?? payload?.tracking?.status,
      assignedCarrierId:
        extras.assignedCarrierId ??
        extras.assigned_carrier_id ??
        payload?.assignedCarrierId,
      lifecycleStage: extras.lifecycleStage ?? payload?.lifecycleStage,
      role
    },
    { role, source: payload ? 'state' : 'latch' }
  );

  if (payload && resolved.canTrack) {
    syncContractLatchFromPayload(payload, extras);
  }

  return resolved.uiState;
}

/** Active shipment list row → contract state. */
export function contractStateFromActiveRow(row, role) {
  return resolveContractState(
    {
      restRow: row,
      ref: getTrackingRef(row),
      shipmentStatus: row?.shipmentStatus ?? row?.status,
      assignedCarrierId: row?.assignedCarrierId ?? row?.assigned_carrier_id,
      code: row?.code,
      id: row?.id,
      loadId: row?.id,
      role
    },
    { role, source: 'state' }
  );
}
