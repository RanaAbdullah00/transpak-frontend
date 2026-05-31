const SEEN_MAX = 800;
const BC_NAME = 'tp-realtime-dedupe';
const seenEventIds = new Set();
const seenOrder = [];
let broadcastChannel = null;

function pruneSeen() {
  while (seenOrder.length > SEEN_MAX) {
    const old = seenOrder.shift();
    if (old) seenEventIds.delete(old);
  }
}

function markEventSeen(id, { broadcast = true } = {}) {
  if (!id || seenEventIds.has(id)) return;
  seenEventIds.add(id);
  seenOrder.push(id);
  pruneSeen();
  if (broadcast) {
    try {
      broadcastChannel?.postMessage({ eventId: id });
    } catch {
      /* ignore cross-tab publish failures */
    }
  }
}

function initBroadcastChannel() {
  if (broadcastChannel || typeof BroadcastChannel === 'undefined') return;
  try {
    broadcastChannel = new BroadcastChannel(BC_NAME);
    broadcastChannel.onmessage = (ev) => {
      const id = ev?.data?.eventId != null ? String(ev.data.eventId).trim() : '';
      if (id) markEventSeen(id, { broadcast: false });
    };
  } catch {
    broadcastChannel = null;
  }
}

initBroadcastChannel();

/**
 * Returns true if this event should be processed (first time in this browser).
 */
export function shouldProcessRealtimeEvent(eventId) {
  const id = eventId != null ? String(eventId).trim() : '';
  if (!id) return true;
  if (seenEventIds.has(id)) return false;
  markEventSeen(id, { broadcast: true });
  return true;
}

export function clearRealtimeDedupeCache() {
  seenEventIds.clear();
  seenOrder.length = 0;
}

/** Mark server-synced event IDs as seen so socket replay does not duplicate UI updates. */
export function acknowledgeSyncedEventIds(rows) {
  if (!Array.isArray(rows)) return;
  rows.forEach((row) => {
    const id = row?.eventId ?? row?.id ?? row?._id;
    if (id != null) markEventSeen(String(id).trim(), { broadcast: true });
  });
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

function moduleSyncKey(userId) {
  const uid = userId != null ? String(userId).trim() : '';
  return uid ? `tp:${uid}:module-sync` : 'tp:module-sync';
}

export function getModuleSyncTimestamps(userId) {
  try {
    const raw = sessionStorage.getItem(moduleSyncKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setModuleSyncTimestamps(modules, userId) {
  try {
    if (!modules || typeof modules !== 'object') return;
    const prev = getModuleSyncTimestamps(userId);
    sessionStorage.setItem(moduleSyncKey(userId), JSON.stringify({ ...prev, ...modules }));
  } catch {
    // ignore
  }
}

export function getLastEventSyncAt(userId) {
  return getLastNotificationSyncAt(userId);
}
