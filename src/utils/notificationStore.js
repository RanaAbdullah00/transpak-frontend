const MAX_ITEMS = 100;
const DEDUPE_WINDOW_MS = 30000;
/** @type {import('./notificationEngine.js').buildNotification extends Function ? ReturnType<typeof import('./notificationEngine.js').buildNotification>[] : object[]} */
const EMPTY_SNAPSHOT = Object.freeze([]);
let items = [];
let snapshotVersion = 0;
let cachedSnapshot = EMPTY_SNAPSHOT;
let cachedSnapshotVersion = -1;
let snapshotInFlight = false;
const listeners = new Set();

function freezeItems(rows) {
  return Object.freeze(rows.map((row) => Object.freeze({ ...row })));
}
const recentKeys = new Map();

function bumpSnapshot() {
  snapshotVersion += 1;
}

function notifyListeners() {
  bumpSnapshot();
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tp:unread-sync', { detail: { count: getUnreadCount() } })
    );
  }
}

function pruneDedupe() {
  const now = Date.now();
  recentKeys.forEach((ts, key) => {
    if (now - ts > DEDUPE_WINDOW_MS) recentKeys.delete(key);
  });
}

export function getNotificationSnapshot() {
  if (cachedSnapshotVersion === snapshotVersion) return cachedSnapshot;
  if (snapshotInFlight) return cachedSnapshot;
  snapshotInFlight = true;
  cachedSnapshot = items.length ? freezeItems(items) : EMPTY_SNAPSHOT;
  cachedSnapshotVersion = snapshotVersion;
  queueMicrotask(() => {
    snapshotInFlight = false;
  });
  return cachedSnapshot;
}

export function subscribeNotifications(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUnreadCount() {
  return items.filter((n) => !n.read).length;
}

/**
 * @param {ReturnType<import('./notificationEngine.js').buildNotification>} notification
 */
export function pushNotification(notification) {
  if (!notification) return false;

  pruneDedupe();
  const key =
    notification.dedupeKey ||
    notification.globalEventId ||
    `${notification.kind}|${notification.shipmentRef || ''}|${notification.message}`;
  const last = recentKeys.get(key);
  if (last && Date.now() - last < DEDUPE_WINDOW_MS) return false;
  recentKeys.set(key, Date.now());
  const id = String(notification.id || '');
  if (id && items.some((n) => String(n.id) === id)) return false;

  items = [{ ...notification, read: Boolean(notification.read) }, ...items].slice(0, MAX_ITEMS);
  notifyListeners();
  return true;
}

export function markNotificationRead(id) {
  const sid = String(id || '');
  if (!sid) return;
  items = items.map((n) =>
    String(n.id) === sid ? { ...n, read: true, isRead: true } : n
  );
  notifyListeners();
}

export function markAllNotificationsRead() {
  items = items.map((n) => ({ ...n, read: true, isRead: true }));
  notifyListeners();
}

export function clearNotificationsByRef(shipmentRef) {
  const ref = String(shipmentRef || '').trim();
  if (!ref) return;
  items = items.filter((n) => String(n.shipmentRef || '') !== ref);
  notifyListeners();
}

export function clearNotificationStore() {
  items = [];
  recentKeys.clear();
  cachedSnapshot = EMPTY_SNAPSHOT;
  cachedSnapshotVersion = snapshotVersion;
  snapshotInFlight = false;
  notifyListeners();
}

export function mergePersistedNotifications(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  list.forEach((row) => {
    const id = String(row.id || row._id || '');
    if (id && items.some((n) => String(n.id) === id)) return;
    pushNotification({
      ...row,
      read: Boolean(row.read || row.isRead),
      dedupeKey: row.dedupeKey || `persist|${id}`
    });
  });
}
