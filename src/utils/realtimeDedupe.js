const SEEN_MAX = 800;
const seenEventIds = new Set();
const seenOrder = [];

function pruneSeen() {
  while (seenOrder.length > SEEN_MAX) {
    const old = seenOrder.shift();
    if (old) seenEventIds.delete(old);
  }
}

/**
 * Returns true if this event should be processed (first time).
 */
export function shouldProcessRealtimeEvent(eventId) {
  const id = eventId != null ? String(eventId).trim() : '';
  if (!id) return true;
  if (seenEventIds.has(id)) return false;
  seenEventIds.add(id);
  seenOrder.push(id);
  pruneSeen();
  return true;
}

export function clearRealtimeDedupeCache() {
  seenEventIds.clear();
  seenOrder.length = 0;
}

function lastSyncKey(userId) {
  const uid = userId != null ? String(userId).trim() : '';
  return uid ? `tp:${uid}:notif-last-sync` : 'tp:notif-last-sync';
}

export function getLastNotificationSyncAt(userId) {
  try {
    return sessionStorage.getItem(lastSyncKey(userId));
  } catch {
    return null;
  }
}

export function setLastNotificationSyncAt(iso, userId) {
  try {
    if (iso) sessionStorage.setItem(lastSyncKey(userId), String(iso));
  } catch {
    // ignore
  }
}
