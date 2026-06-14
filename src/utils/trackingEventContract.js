/**
 * Phase 4 — tracking event identity contract (client-side).
 *
 * @typedef {Object} TrackingEvent
 * @property {string} eventId
 * @property {string} shipmentId
 * @property {number} timestamp
 * @property {'socket'|'polling'|'api'} source
 */

/**
 * @param {object} payload
 * @param {'socket'|'polling'|'api'} [source='socket']
 * @returns {TrackingEvent}
 */
export function normalizeTrackingEvent(payload, source = 'socket') {
  const shipmentId = String(payload?.refKey || payload?.loadId || '').trim();
  const timestamp = Number(
    payload?.ts ?? payload?.timestamp ?? payload?.tracking?.locationUpdatedAt ?? Date.now()
  );
  const serverId = String(payload?.eventId || payload?.id || '').trim();
  const status = String(payload?.tracking?.status || '').trim();
  const loc = payload?.tracking?.currentLocation ?? payload?.tracking?.location;
  const locKey = Array.isArray(loc) ? loc.map((n) => Number(n).toFixed(5)).join(',') : '';
  const eventId =
    serverId ||
    (shipmentId
      ? `tp:${shipmentId}:${Number.isFinite(timestamp) ? timestamp : 0}:${status}:${locKey}`
      : `tp:anon:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`);

  return {
    eventId,
    shipmentId,
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
    source
  };
}

/**
 * Ignore duplicate eventId; last-write-wins only when timestamp is newer.
 * @param {TrackingEvent} event
 * @param {{ cache: ReturnType<typeof import('./eventDedupeCache.js').createEventDedupeCache>, lastTimestampByShipment: Map<string, number> }} ctx
 */
export function shouldAcceptTrackingEvent(event, { cache, lastTimestampByShipment }) {
  if (!event?.eventId) return true;
  if (cache.has(event.eventId)) return false;
  if (event.shipmentId) {
    const last = lastTimestampByShipment.get(event.shipmentId) || 0;
    if (event.timestamp < last) return false;
  }
  return true;
}

/**
 * @param {TrackingEvent} event
 * @param {{ cache: ReturnType<typeof import('./eventDedupeCache.js').createEventDedupeCache>, lastTimestampByShipment: Map<string, number> }} ctx
 */
export function rememberTrackingEvent(event, { cache, lastTimestampByShipment }) {
  if (!event?.eventId) return;
  cache.remember(event.eventId);
  if (event.shipmentId) {
    const prev = lastTimestampByShipment.get(event.shipmentId) || 0;
    if (event.timestamp >= prev) {
      lastTimestampByShipment.set(event.shipmentId, event.timestamp);
    }
  }
}
