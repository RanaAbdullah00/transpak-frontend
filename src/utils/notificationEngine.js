import {
  buildNotificationEventId,
  claimNotificationEvent
} from './notificationEventRegistry.js';
import { isInternalDispatchLabel } from './i18nLabels.js';
import { sanitizeProductText } from './userErrors.js';

function cleanNotificationCopy(value, dispatchType) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (isInternalDispatchLabel(raw) || raw.toUpperCase() === dispatchType) return '';
  return sanitizeProductText(raw);
}

function localEventId() {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
export const NOTIFICATION_KIND = Object.freeze({
  ACCEPT: 'ACCEPT',
  REJECT: 'REJECT',
  SUGGEST: 'SUGGEST',
  STATUS_UPDATE: 'STATUS_UPDATE',
  CONTRACT: 'CONTRACT'
});

export const NOTIFICATION_CATEGORY = Object.freeze({
  CONTRACT: 'contract',
  BID: 'bid',
  STATUS: 'status',
  SYSTEM: 'system'
});

const DISPATCH_MAP = Object.freeze({
  BID_ACCEPTED: {
    kind: NOTIFICATION_KIND.CONTRACT,
    category: NOTIFICATION_CATEGORY.CONTRACT,
    soundType: 'contract',
    priority: 'high',
    focus: true
  },
  CONTRACT_STARTED: {
    kind: NOTIFICATION_KIND.CONTRACT,
    category: NOTIFICATION_CATEGORY.CONTRACT,
    soundType: 'contract',
    priority: 'high',
    focus: true
  },
  CAPACITY_ACCEPTED: {
    kind: NOTIFICATION_KIND.CONTRACT,
    category: NOTIFICATION_CATEGORY.CONTRACT,
    soundType: 'contract',
    priority: 'high',
    focus: true
  },
  SPACE_ACCEPTED: {
    kind: NOTIFICATION_KIND.CONTRACT,
    category: NOTIFICATION_CATEGORY.CONTRACT,
    soundType: 'contract',
    priority: 'high',
    focus: true
  },
  SPACE_REQUEST: {
    kind: NOTIFICATION_KIND.SUGGEST,
    category: NOTIFICATION_CATEGORY.BID,
    soundType: 'suggest',
    priority: 'medium',
    focus: true
  },
  SPACE_REQUEST_SENT: {
    kind: NOTIFICATION_KIND.SUGGEST,
    category: NOTIFICATION_CATEGORY.BID,
    soundType: 'suggest',
    priority: 'low',
    focus: false
  },
  COUNTER_OFFER_ACCEPTED: {
    kind: NOTIFICATION_KIND.CONTRACT,
    category: NOTIFICATION_CATEGORY.CONTRACT,
    soundType: 'contract',
    priority: 'high',
    focus: true
  },
  LOCATION_UPDATED: {
    kind: NOTIFICATION_KIND.STATUS_UPDATE,
    category: NOTIFICATION_CATEGORY.STATUS,
    soundType: 'status',
    priority: 'low',
    focus: false
  },
  CONTRACT_CREATED: {
    kind: NOTIFICATION_KIND.CONTRACT,
    category: NOTIFICATION_CATEGORY.CONTRACT,
    soundType: 'contract',
    priority: 'high',
    focus: true
  },
  CONTRACT_ACCEPTED: {
    kind: NOTIFICATION_KIND.CONTRACT,
    category: NOTIFICATION_CATEGORY.CONTRACT,
    soundType: 'contract',
    priority: 'high',
    focus: true
  },
  CONTRACT_REJECTED: {
    kind: NOTIFICATION_KIND.REJECT,
    category: NOTIFICATION_CATEGORY.BID,
    soundType: 'reject',
    priority: 'medium',
    focus: true
  },
  CONTRACT_COMPLETED: {
    kind: NOTIFICATION_KIND.STATUS_UPDATE,
    category: NOTIFICATION_CATEGORY.STATUS,
    soundType: 'status',
    priority: 'medium',
    focus: true
  },
  BID_REJECTED: {
    kind: NOTIFICATION_KIND.REJECT,
    category: NOTIFICATION_CATEGORY.BID,
    soundType: 'reject',
    priority: 'medium',
    focus: true
  },
  SPACE_REJECTED: {
    kind: NOTIFICATION_KIND.REJECT,
    category: NOTIFICATION_CATEGORY.BID,
    soundType: 'reject',
    priority: 'medium',
    focus: true
  },
  BID_COUNTER: {
    kind: NOTIFICATION_KIND.SUGGEST,
    category: NOTIFICATION_CATEGORY.BID,
    soundType: 'suggest',
    priority: 'medium',
    focus: false
  },
  COUNTER_OFFERED: {
    kind: NOTIFICATION_KIND.SUGGEST,
    category: NOTIFICATION_CATEGORY.BID,
    soundType: 'suggest',
    priority: 'medium',
    focus: false
  },
  BID_SUGGESTED: {
    kind: NOTIFICATION_KIND.SUGGEST,
    category: NOTIFICATION_CATEGORY.BID,
    soundType: 'suggest',
    priority: 'medium',
    focus: false
  },
  SHIPPER_CONFIRMATION_REQUEST: {
    kind: NOTIFICATION_KIND.SUGGEST,
    category: NOTIFICATION_CATEGORY.BID,
    soundType: 'suggest',
    priority: 'medium',
    focus: true
  },
  BID_CREATED: {
    kind: NOTIFICATION_KIND.SUGGEST,
    category: NOTIFICATION_CATEGORY.BID,
    soundType: 'suggest',
    priority: 'low',
    focus: false
  },
  BID_RECEIVED: {
    kind: NOTIFICATION_KIND.SUGGEST,
    category: NOTIFICATION_CATEGORY.BID,
    soundType: 'suggest',
    priority: 'medium',
    focus: false
  },
  SHIPMENT_STATUS: {
    kind: NOTIFICATION_KIND.STATUS_UPDATE,
    category: NOTIFICATION_CATEGORY.STATUS,
    soundType: 'status',
    priority: 'medium',
    focus: true
  },
  SHIPMENT_PICKED_UP: {
    kind: NOTIFICATION_KIND.STATUS_UPDATE,
    category: NOTIFICATION_CATEGORY.STATUS,
    soundType: 'status',
    priority: 'medium',
    focus: true
  },
  SHIPMENT_IN_TRANSIT: {
    kind: NOTIFICATION_KIND.STATUS_UPDATE,
    category: NOTIFICATION_CATEGORY.STATUS,
    soundType: 'status',
    priority: 'medium',
    focus: true
  },
  DELIVERED: {
    kind: NOTIFICATION_KIND.STATUS_UPDATE,
    category: NOTIFICATION_CATEGORY.STATUS,
    soundType: 'status',
    priority: 'medium',
    focus: true
  },
  DELIVERY_COMPLETED: {
    kind: NOTIFICATION_KIND.STATUS_UPDATE,
    category: NOTIFICATION_CATEGORY.STATUS,
    soundType: 'status',
    priority: 'medium',
    focus: true
  },
  STATUS_UPDATED: {
    kind: NOTIFICATION_KIND.STATUS_UPDATE,
    category: NOTIFICATION_CATEGORY.STATUS,
    soundType: 'status',
    priority: 'medium',
    focus: true
  },
  SPACE_IN_TRANSIT: {
    kind: NOTIFICATION_KIND.STATUS_UPDATE,
    category: NOTIFICATION_CATEGORY.STATUS,
    soundType: 'status',
    priority: 'medium',
    focus: true
  },
  SPACE_COMPLETED: {
    kind: NOTIFICATION_KIND.STATUS_UPDATE,
    category: NOTIFICATION_CATEGORY.STATUS,
    soundType: 'status',
    priority: 'low',
    focus: false
  }
});

function inferRoleTargets(dispatchType, roleType) {
  const rt = String(roleType || '').toLowerCase();
  if (rt === 'shipper') return ['shipper'];
  if (rt === 'carrier') return ['carrier'];
  if (rt === 'admin') return ['admin'];
  const t = String(dispatchType || '').toUpperCase();
  if (t.includes('BID') || t === 'SHIPPER_CONFIRMATION_REQUEST') {
    return ['shipper', 'carrier'];
  }
  if (t.includes('SPACE') || t.includes('CAPACITY') || t.includes('CONTRACT')) {
    return ['shipper', 'carrier'];
  }
  if (t.includes('SHIPMENT') || t.includes('DELIVER')) {
    return ['shipper', 'carrier'];
  }
  return ['shipper', 'carrier', 'admin'];
}

function extractRef(dispatch = {}, row = {}) {
  return (
    row.shipmentRef ??
    row.ref ??
    row.refKey ??
    row.loadCode ??
    row.code ??
    dispatch.refKey ??
    dispatch.shipmentRef ??
    dispatch.loadCode ??
    null
  );
}

function extractLoadId(dispatch = {}, row = {}) {
  return row.loadId ?? dispatch.loadId ?? null;
}

/** 10s buckets — collapse duplicate socket bursts without hiding distinct events. */
export function notificationTimestampBucket(ts) {
  const t = new Date(ts || Date.now()).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor(t / 10000);
}

export function dedupeKey(n) {
  const bucket = notificationTimestampBucket(n.timestamp);
  return [
    n.kind || '',
    n.dispatchType || '',
    n.shipmentRef || '',
    n.loadId || '',
    bucket
  ].join('|');
}

/**
 * Build unified notification from socket dispatch and/or persisted row.
 */
export function buildNotification(input = {}) {
  const rawType = String(input.dispatchType || input.type || input.title || '').toUpperCase();
  const dispatchType =
    {
      CONTRACT_CREATED: 'CONTRACT_STARTED',
      CONTRACT_ACCEPTED: 'CONTRACT_STARTED',
      CONTRACT_REJECTED: 'BID_REJECTED',
      CONTRACT_COMPLETED: 'DELIVERY_COMPLETED',
      COUNTER_OFFER_SENT: 'COUNTER_OFFERED',
      COUNTER_OFFER_ACCEPTED: 'BID_ACCEPTED',
      REQUEST_SENT: 'SPACE_REQUEST_SENT',
      REQUEST_ACCEPTED: 'SPACE_ACCEPTED',
      REQUEST_REJECTED: 'SPACE_REJECTED'
    }[rawType] || rawType;
  const meta = DISPATCH_MAP[dispatchType] || {
    kind: NOTIFICATION_KIND.ACCEPT,
    category: NOTIFICATION_CATEGORY.SYSTEM,
    soundType: 'status',
    priority: 'low',
    focus: false
  };

  const title = cleanNotificationCopy(input.title, dispatchType);
  const message = cleanNotificationCopy(input.message || input.body, dispatchType);
  const shipmentRef = extractRef(input, input);
  const loadId = extractLoadId(input, input);

  const built = {
    id: input.id || input.eventId || input._id || `eng-${localEventId()}`,
    eventId: input.eventId || input.id || null,
    kind: input.kind || meta.kind,
    category: input.category || meta.category,
    dispatchType,
    title,
    message: message || title || '',
    shipmentRef: shipmentRef ? String(shipmentRef).trim() : null,
    loadId: loadId ? String(loadId) : null,
    roleTarget: Array.isArray(input.roleTarget)
      ? input.roleTarget
      : inferRoleTargets(dispatchType, input.roleType),
    roleType: input.roleType ?? null,
    timestamp: input.timestamp || input.createdAt || new Date().toISOString(),
    soundType: input.soundType || meta.soundType,
    priority: input.priority || meta.priority,
    focus: input.focus != null ? Boolean(input.focus) : meta.focus,
    read: Boolean(input.read || input.isRead),
    dedupeKey: input.dedupeKey || null
  };

  built.globalEventId = buildNotificationEventId(built);
  built.dedupeKey = built.dedupeKey || built.globalEventId;
  return built;
}

export function normalizePersistedNotification(row = {}) {
  const dispatchType = String(row.type || row.title || '').toUpperCase();
  return buildNotification({
    ...row,
    dispatchType,
    message: row.message,
    title: row.title || row.type,
    roleType: row.roleType
  });
}

/**
 * Process realtime dispatch envelope → 0..1 notifications.
 */
export function processDispatchEvent(dispatch = {}) {
  if (!dispatch || typeof dispatch !== 'object') return [];

  const type = String(dispatch.type || '').toUpperCase();
  const row = dispatch.notification && typeof dispatch.notification === 'object'
    ? dispatch.notification
    : {};

  const built = buildNotification({
    ...row,
    dispatchType: type,
    type,
    title: row.title || type,
    message: row.message || row.title || type,
    roleType: row.roleType,
    eventId: row.eventId || row.id || dispatch.eventId,
    id: row.id || row._id || dispatch.eventId
  });

  built.dedupeKey = dedupeKey(built);
  built.globalEventId = buildNotificationEventId(built);
  return [built];
}

/**
 * Local/client flow notifications (status updates, manual emits).
 */
export function emitFlowNotification(input = {}) {
  const built = buildNotification({
    ...input,
    dispatchType: input.dispatchType || 'STATUS_UPDATED',
    timestamp: new Date().toISOString()
  });
  built.dedupeKey = dedupeKey(built);
  built.globalEventId = buildNotificationEventId(built);
  if (!claimNotificationEvent(built)) return built;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tp:flow-notification', { detail: built })
    );
  }
  return built;
}

export function getDispatchMeta(dispatchType) {
  return DISPATCH_MAP[String(dispatchType || '').toUpperCase()] || null;
}
