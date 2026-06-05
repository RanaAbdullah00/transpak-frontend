import {
  handleShipmentActivationSync,
  isContractDispatchType,
  isShipmentSyncType
} from './contractActivation.js';
import { emitRealtimeRefresh } from './realtimeRefresh.js';
import {
  buildNotification,
  dedupeKey,
  normalizePersistedNotification,
  processDispatchEvent
} from './notificationEngine.js';
import { pushNotification } from './notificationStore.js';
import { playNotificationSoundForBurst } from './notificationSoundManager.js';
import { notifyFocusAttention } from './focusManager.js';
import { NOTIFICATION_KIND } from './notificationEngine.js';
import {
  buildNotificationEventId,
  claimNotificationEvent
} from './notificationEventRegistry.js';

const effectBurstAt = new Map();
const EFFECT_BURST_MS = 1200;

function shouldPublishEffects(burstKey) {
  const key = String(burstKey || 'default');
  const now = Date.now();
  const last = effectBurstAt.get(key) || 0;
  if (now - last < EFFECT_BURST_MS) return false;
  effectBurstAt.set(key, now);
  return true;
}

/**
 * Side effects for one notification per burst (toast + sound + focus).
 */
export function publishNotificationEffects(notification, { showToast = true, burstKey } = {}) {
  if (!notification) return;

  const burst =
    burstKey ||
    notification.globalEventId ||
    notification.dedupeKey ||
    buildNotificationEventId(notification) ||
    notification.id;
  if (!shouldPublishEffects(`fx|${burst}`)) return;

  if (showToast && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tp:notification-toast', { detail: notification })
    );
  }

  playNotificationSoundForBurst(notification.soundType, burst);
  notifyFocusAttention(notification);
}

/**
 * Full realtime dispatch pipeline (refresh + store + UX).
 */
export function ingestRealtimeDispatch(dispatch, { onPersistedNotification } = {}) {
  if (!dispatch || typeof dispatch !== 'object') return [];

  const type = String(dispatch.type || '').toUpperCase();

  if (isContractDispatchType(type)) {
    if (type === 'BID_ACCEPTED') emitRealtimeRefresh('bids');
    if (type === 'SPACE_ACCEPTED') emitRealtimeRefresh('space');
  } else {
    const scopes = {
      BID_REJECTED: 'bids',
      BID_COUNTER: 'bids',
      COUNTER_OFFERED: 'bids',
      BID_SUGGESTED: 'bids',
      SHIPPER_CONFIRMATION_REQUEST: 'bids',
      SPACE_REJECTED: 'space',
      SPACE_REQUEST: 'space',
      SPACE_IN_TRANSIT: 'space',
      SPACE_COMPLETED: 'space'
    };
    const scope = scopes[type];
    if (scope) emitRealtimeRefresh(scope);
    else if (!isShipmentSyncType(type)) emitRealtimeRefresh('all');
  }

  const engineItems = processDispatchEvent(dispatch);
  if (!engineItems.length && dispatch.notification) {
    engineItems.push(normalizePersistedNotification(dispatch.notification));
  }

  let primary = null;

  engineItems.forEach((raw) => {
    const n = buildNotification({ ...raw, dispatchType: raw.dispatchType || type });
    n.globalEventId = n.globalEventId || buildNotificationEventId(n);
    n.dedupeKey = n.dedupeKey || n.globalEventId;
    if (!claimNotificationEvent(n)) return;

    if (pushNotification(n) && !primary) {
      primary = n;
    }
  });

  if (primary) {
    publishNotificationEffects(primary, {
      burstKey: primary.globalEventId || buildNotificationEventId(primary)
    });
  }

  if (onPersistedNotification) {
    if (dispatch.notification) {
      onPersistedNotification({
        ...dispatch.notification,
        shipmentRef: primary?.shipmentRef,
        kind: primary?.kind
      });
    } else if (primary) {
      onPersistedNotification({
        id: primary.id,
        type: primary.dispatchType,
        title: primary.title,
        message: primary.message,
        roleType: primary.roleType,
        createdAt: primary.timestamp,
        read: false,
        shipmentRef: primary.shipmentRef
      });
    }
  }

  return engineItems;
}

/**
 * Client-side flow notification (e.g. status update).
 */
export function ingestFlowNotification(input = {}) {
  const n = buildNotification({
    ...input,
    dispatchType: input.dispatchType || 'STATUS_UPDATED',
    kind: input.kind || NOTIFICATION_KIND.STATUS_UPDATE
  });
  n.dedupeKey = dedupeKey(n);
  n.globalEventId = buildNotificationEventId(n);
  if (!claimNotificationEvent(n)) return n;
  if (pushNotification(n)) {
    if (!input.skipShipmentSync) {
      void handleShipmentActivationSync(n.shipmentRef || null);
    }
    publishNotificationEffects(n, { burstKey: n.globalEventId });
  }
  return n;
}
