import { notificationTimestampBucket } from './notificationEngine.js';

const MAX_REGISTRY = 200;
const registryOrder = [];
const registrySet = new Set();

function pruneRegistry() {
  while (registryOrder.length > MAX_REGISTRY) {
    const old = registryOrder.shift();
    if (old) registrySet.delete(old);
  }
}

/**
 * Canonical global notification event identity (socket + REST + flow).
 * Format: TYPE_SHIPMENTREF_TIMESTAMPBUCKET
 */
export function buildNotificationEventId(input = {}) {
  const type = String(
    input.dispatchType || input.type || input.kind || input.title || 'EVENT'
  )
    .toUpperCase()
    .replace(/\s+/g, '_');
  const ref = String(
    input.shipmentRef ?? input.refKey ?? input.ref ?? input.code ?? input.loadCode ?? '_'
  ).trim() || '_';
  const entity = String(
    input.entityId ?? input.eventId ?? input.notificationId ?? ''
  ).trim();
  if (entity) {
    return `${type}_${ref}_${entity}`;
  }
  const bucket = notificationTimestampBucket(
    input.timestamp ?? input.createdAt ?? Date.now()
  );
  return `${type}_${ref}_${bucket}`;
}

/**
 * Returns true if this event should be processed (first occurrence).
 * Registers both semantic global id and optional server eventId.
 */
export function claimNotificationEvent(input = {}) {
  const globalId =
    input.globalEventId ||
    input.eventId ||
    buildNotificationEventId(input);

  const serverId =
    input.eventId && String(input.eventId).trim() !== String(globalId).trim()
      ? String(input.eventId).trim()
      : null;

  const ids = [String(globalId).trim(), serverId].filter(Boolean);
  if (!ids.length) return true;

  for (const id of ids) {
    if (registrySet.has(id)) return false;
  }

  ids.forEach((id) => {
    if (!registrySet.has(id)) {
      registrySet.add(id);
      registryOrder.push(id);
    }
  });
  pruneRegistry();
  return true;
}

export function hasNotificationEventId(eventId) {
  const id = eventId != null ? String(eventId).trim() : '';
  return id ? registrySet.has(id) : false;
}

export function clearNotificationEventRegistry() {
  registrySet.clear();
  registryOrder.length = 0;
}

/** Pre-register server-synced rows so socket replay does not re-process. */
export function registerNotificationEventIds(rows = []) {
  if (!Array.isArray(rows)) return;
  rows.forEach((row) => {
    const globalId = buildNotificationEventId({
      dispatchType: row?.type || row?.title,
      shipmentRef: row?.shipmentRef || row?.refKey,
      timestamp: row?.createdAt,
      eventId: row?.eventId || row?.id || row?._id
    });
    if (!registrySet.has(globalId)) {
      registrySet.add(globalId);
      registryOrder.push(globalId);
    }
    const serverId = row?.eventId ?? row?.id ?? row?._id;
    if (serverId != null) {
      const sid = String(serverId).trim();
      if (sid && !registrySet.has(sid)) {
        registrySet.add(sid);
        registryOrder.push(sid);
      }
    }
    pruneRegistry();
  });
}
