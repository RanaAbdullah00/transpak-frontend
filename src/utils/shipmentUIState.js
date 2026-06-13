import { normalizeShipmentStatus, nextShipmentStatus } from './shipmentStatus.js';
import { getBackendBadgeVariant } from './stateNormalizationEngine.js';
import { translateShipmentOrLoadStatus } from './i18nLabels.js';
import { normalizeContractFields } from './contractFieldNormalizer.js';
import { getTrackingRef } from './trackingRefResolver.js';
import {
  deriveContractPhase,
  getContractUIColor,
  getContractUILabelKey,
  CONTRACT_PHASE
} from './contractStateEngine.js';
import {
  mapLegacyToContract,
  canCarrierUpdateContractStatus,
  CONTRACT_STATUS
} from './contractMapper.js';
import { sanitizeTrackingPayload } from './trackingPayloadSanitizer.js';
import { computeUnifiedShipmentSnapshot } from './contractActivationLayer.js';
import { normalizeBidStatus, BID_STATUS, isActiveBidStatus } from './bidStatus.js';
import { isValidShipmentTrackRef } from './shipmentStatus.js';

/** Statuses where live GPS + socket tracking are allowed (matches backend contract). */
export const TRACKING_ACTIVE_STATUSES = Object.freeze(['booked', 'pickedup', 'intransit']);

const IS_DEV = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
const SNAPSHOT_REGISTRY = new WeakSet();

function registerSnapshotConsumer(snapshot) {
  if (snapshot && typeof snapshot === 'object') {
    SNAPSHOT_REGISTRY.add(snapshot);
  }
  return snapshot;
}

/** True when value was produced by getUnifiedShipmentSnapshot / sealSnapshot. */
export function isSnapshotConsumer(snapshot) {
  return Boolean(snapshot && typeof snapshot === 'object' && SNAPSHOT_REGISTRY.has(snapshot));
}

/**
 * Selector boundary guard — UI/hooks must only read state from sealed snapshots.
 * In dev, warns when raw REST/store/socket objects are used as UI truth.
 */
export function assertIsSnapshotConsumer(snapshot, context = 'unknown') {
  if (!snapshot || typeof snapshot !== 'object') {
    if (IS_DEV) {
      console.warn(`[snapshot-guard] ${context}: invalid snapshot — using empty snapshot`);
    }
    return getEmptyUnifiedSnapshot();
  }
  if (!SNAPSHOT_REGISTRY.has(snapshot) && IS_DEV) {
    console.warn(
      `[snapshot-guard] ${context}: UI state bypass — must use getUnifiedShipmentSnapshot()`
    );
  }
  return snapshot;
}

/** Flatten sealed bid buckets into a single array for list rendering. */
export function collectSnapshotBids(snapshot) {
  const safe = assertIsSnapshotConsumer(snapshot, 'collectSnapshotBids');
  const buckets = safe.bid ?? SAFE_BID_BUCKETS;
  return [
    ...safeObjectArray(buckets.active),
    ...safeObjectArray(buckets.suggested),
    ...safeObjectArray(buckets.rejected)
  ];
}

/** Single bid entry via unified selector (replaces direct getUnifiedBidSnapshot in UI). */
export function resolveBidFromSnapshot(snapshot, bidId = null, context = 'resolveBidFromSnapshot') {
  const safe = assertIsSnapshotConsumer(snapshot, context);
  const pool = collectSnapshotBids(safe);
  const id = String(bidId || '').trim();
  if (id) {
    return pool.find((b) => String(b?.id || '') === id) ?? pool[0] ?? {};
  }
  return pool[0] ?? {};
}

/** Safe UI defaults — never null, never undefined nested access required. */
export const SAFE_UI_STATE = Object.freeze({
  status: 'posted',
  phase: 'incomplete',
  unifiedContract: {},
  labelKey: 'status.unknown',
  colorVariant: 'secondary',
  canTrack: false,
  trackingActive: false,
  contractActive: false,
  isActive: false,
  isCompleted: false,
  showRouteMap: false,
  showLiveMap: false,
  showLiveDriver: false,
  allowSocketJoin: false,
  allowGpsPublish: false,
  showCarrierAdvance: false,
  canUpdateStatus: false,
  showShipperAcceptedBanner: false,
  upcomingStatus: null,
  lifecycleStage: null,
  hasValidRef: false,
  contractPhase: null,
  shipmentActive: false,
  statusEngineUnlocked: false,
  trackingEnabled: false,
  contractActivated: false
});

const SAFE_PERMISSIONS = Object.freeze({
  canUpdateStatus: false,
  canTrack: false,
  allowGpsPublish: false,
  showCarrierAdvance: false,
  allowSocketJoin: false
});

const SAFE_TRACKING_FLAGS = Object.freeze({
  enabled: false,
  ref: '',
  gate: false,
  showLiveMap: false,
  showShell: false,
  isHydrated: false,
  isEmpty: true
});

/** Canonical bid bucket shape — arrays always defined. */
export const SAFE_BID_BUCKETS = Object.freeze({
  active: Object.freeze([]),
  rejected: Object.freeze([]),
  suggested: Object.freeze([])
});

function safeObjectArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function isSuggestedBid(bid = {}) {
  if (!bid || typeof bid !== 'object') return false;
  if (bid.bidType === 'suggested') return true;
  const status = normalizeBidStatus(bid.status);
  return status === BID_STATUS.COUNTER && bid.suggestedBy === 'carrier';
}

function bucketSingleBid(bid, buckets) {
  if (!bid || typeof bid !== 'object') return;
  const status = normalizeBidStatus(bid.status);
  if (isSuggestedBid(bid)) {
    buckets.suggested.push(bid);
  } else if (
    status === BID_STATUS.REJECTED ||
    status === BID_STATUS.CANCELLED ||
    status === 'expired'
  ) {
    buckets.rejected.push(bid);
  } else if (status === BID_STATUS.ACCEPTED || isActiveBidStatus(status)) {
    buckets.active.push(bid);
  } else {
    buckets.rejected.push(bid);
  }
}

/** Normalize any bid input into immutable { active, rejected, suggested } arrays. */
export function normalizeBidBuckets({ singleBid = null, bidsArray = null, bucketShape = null } = {}) {
  const buckets = { active: [], rejected: [], suggested: [] };

  if (bucketShape && typeof bucketShape === 'object') {
    const hasBucketKeys =
      Array.isArray(bucketShape.active) ||
      Array.isArray(bucketShape.rejected) ||
      Array.isArray(bucketShape.suggested);
    if (hasBucketKeys) {
      safeObjectArray(bucketShape.active).forEach((b) => bucketSingleBid(b, buckets));
      safeObjectArray(bucketShape.rejected).forEach((b) => bucketSingleBid(b, buckets));
      safeObjectArray(bucketShape.suggested).forEach((b) => bucketSingleBid(b, buckets));
      return {
        active: Object.freeze([...buckets.active]),
        rejected: Object.freeze([...buckets.rejected]),
        suggested: Object.freeze([...buckets.suggested])
      };
    }
  }

  safeObjectArray(bidsArray).forEach((b) => bucketSingleBid(b, buckets));
  if (singleBid && typeof singleBid === 'object' && !Array.isArray(singleBid)) {
    bucketSingleBid(singleBid, buckets);
  }

  return {
    active: Object.freeze([...buckets.active]),
    rejected: Object.freeze([...buckets.rejected]),
    suggested: Object.freeze([...buckets.suggested])
  };
}

function freezeUiState(uiState = {}) {
  const safe = uiState && typeof uiState === 'object' ? uiState : {};
  const unified =
    safe.unifiedContract && typeof safe.unifiedContract === 'object'
      ? Object.freeze({ ...safe.unifiedContract })
      : Object.freeze({});
  return Object.freeze({ ...SAFE_UI_STATE, ...safe, unifiedContract: unified });
}

/** Seal draft snapshot to invariant schema + shallow immutability. */
function sealSnapshot(draft = {}, input = {}) {
  const safeDraft = draft && typeof draft === 'object' ? draft : {};
  const safeInput = input && typeof input === 'object' ? input : {};

  const rawRef = String(safeDraft.ref ?? '').trim();
  const ref = isValidShipmentTrackRef(rawRef) ? rawRef : '';

  const contractFields = normalizeContractFields(
    safeDraft.contractFields && typeof safeDraft.contractFields === 'object'
      ? { ...safeDraft.contractFields, ...(ref ? { ref } : {}) }
      : ref
        ? { ref }
        : {}
  );

  let activeRow = safeDraft.activeRow ?? null;
  if (activeRow != null && typeof activeRow !== 'object') activeRow = null;

  const uiState = freezeUiState(safeDraft.uiState);
  const trackingEnabled =
    Boolean(safeDraft.trackingEnabled) || Boolean(safeDraft.contractActivated);
  const isHydrated = Boolean(activeRow) || Boolean(safeDraft.contractActivated);

  const permissions = Object.freeze({
    canUpdateStatus: Boolean(safeDraft.permissions?.canUpdateStatus ?? uiState.canUpdateStatus),
    canTrack: Boolean(safeDraft.permissions?.canTrack ?? uiState.canTrack),
    allowGpsPublish: Boolean(safeDraft.permissions?.allowGpsPublish ?? uiState.allowGpsPublish),
    showCarrierAdvance: Boolean(
      safeDraft.permissions?.showCarrierAdvance ?? uiState.showCarrierAdvance
    ),
    allowSocketJoin: Boolean(safeDraft.permissions?.allowSocketJoin ?? uiState.allowSocketJoin)
  });

  const tracking = Object.freeze({
    enabled: Boolean(safeDraft.tracking?.enabled ?? trackingEnabled),
    ref,
    gate: Boolean(safeDraft.tracking?.gate ?? uiState.canTrack),
    showLiveMap: Boolean(safeDraft.tracking?.showLiveMap ?? uiState.showLiveMap),
    showShell: Boolean(safeDraft.tracking?.showShell ?? isHydrated),
    isHydrated: Boolean(safeDraft.tracking?.isHydrated ?? isHydrated),
    isEmpty: Boolean(safeDraft.tracking?.isEmpty ?? !isHydrated)
  });

  const bid = normalizeBidBuckets({
    singleBid: safeDraft.bid,
    bidsArray: safeInput.bids ?? safeInput.bidList ?? null,
    bucketShape: safeDraft.bid
  });

  return registerSnapshotConsumer(
    Object.freeze({
      ref,
      contractFields: Object.freeze({ ...contractFields }),
      activeRow: activeRow ? Object.freeze({ ...activeRow }) : null,
      bid,
      uiState,
      permissions,
      tracking,
      contractActivated: Boolean(safeDraft.contractActivated),
      optimistic: safeDraft.optimistic ?? null,
      shipmentStatus: safeDraft.shipmentStatus ?? null,
      trackingEnabled,
      ts: Number.isFinite(Number(safeDraft.ts)) ? Number(safeDraft.ts) : 0,
      source: String(safeDraft.source || 'none')
    })
  );
}

let sealedEmptySnapshot = null;
function getEmptyUnifiedSnapshot() {
  if (!sealedEmptySnapshot) {
    sealedEmptySnapshot = sealSnapshot({
      ref: '',
      contractFields: {},
      activeRow: null,
      bid: SAFE_BID_BUCKETS,
      contractActivated: false,
      optimistic: null,
      shipmentStatus: null,
      trackingEnabled: false,
      ts: 0,
      source: 'none',
      uiState: SAFE_UI_STATE,
      permissions: SAFE_PERMISSIONS,
      tracking: SAFE_TRACKING_FLAGS
    });
  }
  return sealedEmptySnapshot;
}

/** Always-defined sealed snapshot — used when selector input or merge fails. */
export const EMPTY_UNIFIED_SNAPSHOT = getEmptyUnifiedSnapshot();

function enrichSnapshot(base = {}, input = {}) {
  const safeBase = base && typeof base === 'object' ? base : {};
  let uiState = SAFE_UI_STATE;
  try {
    uiState = deriveShipmentUIState(safeBase);
  } catch {
    uiState = SAFE_UI_STATE;
  }
  const trackingEnabled =
    Boolean(safeBase.trackingEnabled) || Boolean(safeBase.contractActivated);
  const isHydrated = Boolean(safeBase.activeRow) || Boolean(safeBase.contractActivated);
  const rawRef = String(safeBase.ref ?? '').trim();
  const ref = isValidShipmentTrackRef(rawRef) ? rawRef : '';

  return sealSnapshot(
    {
      ref,
      contractFields:
        safeBase.contractFields && typeof safeBase.contractFields === 'object'
          ? safeBase.contractFields
          : {},
      activeRow: safeBase.activeRow ?? null,
      bid: safeBase.bid ?? null,
      contractActivated: Boolean(safeBase.contractActivated),
      optimistic: safeBase.optimistic ?? null,
      shipmentStatus: safeBase.shipmentStatus ?? null,
      trackingEnabled,
      ts: safeBase.ts ?? 0,
      source: safeBase.source ?? 'none',
      uiState,
      permissions: {
        canUpdateStatus: Boolean(uiState?.canUpdateStatus),
        canTrack: Boolean(uiState?.canTrack),
        allowGpsPublish: Boolean(uiState?.allowGpsPublish),
        showCarrierAdvance: Boolean(uiState?.showCarrierAdvance),
        allowSocketJoin: Boolean(uiState?.allowSocketJoin)
      },
      tracking: {
        enabled: trackingEnabled,
        ref,
        gate: Boolean(uiState?.canTrack),
        showLiveMap: Boolean(uiState?.showLiveMap),
        showShell: isHydrated,
        isHydrated,
        isEmpty: !isHydrated
      }
    },
    input
  );
}

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
  intransit: 'primary',
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
 * Derive presentation + permission state from a base snapshot (no re-merge).
 */
export function deriveShipmentUIState(snapshot = {}) {
  const safeSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const merged = safeSnapshot.contractFields ?? {};
  const normalized = normalizeContractFields(merged);
  const ref = safeSnapshot.ref || normalized.ref || getTrackingRef(normalized);
  const optimistic = safeSnapshot.optimistic ?? null;
  const { status, hasAssigned, hasValidRef } = contractTrackFlags({ ...normalized, ref });
  const unifiedContract = mapLegacyToContract({
    ...normalized,
    ref,
    ...merged,
    contractActivated:
      Boolean(merged.contractActivated) || Boolean(optimistic?.contractActivated),
    shipmentStatus: merged.shipmentStatus ?? merged.status
  });
  const contractActivatedFlag = Boolean(safeSnapshot.contractActivated);
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
    getBackendBadgeVariant(status) ||
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

/**
 * Single deterministic selector — sole authority for contract, bid, tracking, and UI state.
 * Precedence: optimistic activation > contract overlay > store/REST row > raw REST fields.
 */
export function getUnifiedShipmentSnapshot(input = {}) {
  try {
    const safeInput = input && typeof input === 'object' ? input : {};
    const base = computeUnifiedShipmentSnapshot(safeInput);
    if (!base || typeof base !== 'object') {
      return getEmptyUnifiedSnapshot();
    }
    return enrichSnapshot(base, safeInput);
  } catch {
    return getEmptyUnifiedSnapshot();
  }
}

/**
 * Single UI authority for shipment presentation and permissions.
 */
export function getShipmentUIState(input = {}) {
  const snapshot = assertIsSnapshotConsumer(
    getUnifiedShipmentSnapshot(input),
    'getShipmentUIState'
  );
  return snapshot.uiState ?? SAFE_UI_STATE;
}

/**
 * REST + socket contract view routed through unified snapshot (optimistic never downgraded).
 */
export function resolveContractConsistency({
  restShipment = {},
  trackingPayload = null,
  cachedUi = null,
  role = null
} = {}) {
  const snapshot =
    getUnifiedShipmentSnapshot({
      restRow: restShipment,
      role: role ?? restShipment?.role ?? cachedUi?.role ?? null,
      ...(cachedUi && typeof cachedUi === 'object' ? cachedUi : {})
    }) ?? getEmptyUnifiedSnapshot();
  const track = trackingPayload ? sanitizeTrackingPayload(trackingPayload) : null;
  const contractFields = snapshot.contractFields ?? {};

  const fields = normalizeContractFields({
    ...contractFields,
    role: contractFields.role ?? role ?? restShipment?.role ?? null,
    ...(track?.tracking ? { tracking: track.tracking } : {})
  });

  const ui = snapshot.uiState ?? SAFE_UI_STATE;

  return {
    isActiveContract: Boolean(ui?.contractActive),
    isTrackable: Boolean(ui?.canTrack),
    uiPhase: ui?.phase ?? 'incomplete',
    contractPhase: ui?.contractPhase ?? null,
    colorVariant: ui?.colorVariant ?? 'secondary',
    fields,
    uiState: ui
  };
}

export function withShipmentUILabels(uiState, t) {
  if (!uiState || typeof uiState !== 'object') return SAFE_UI_STATE;
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
  return getShipmentUIState({
    restRow: row,
    role,
    ref: getTrackingRef(row)
  });
}
