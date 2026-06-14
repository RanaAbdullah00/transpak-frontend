import api from '../services/api.js';
import { unwrapResponseData } from './unwrapApi.js';
import { notificationQueryParams } from './workspaceApi.js';
import { setLastNotificationSyncAt, setModuleSyncTimestamps } from './realtimeDedupe.js';
export async function syncNotificationsSince(user, { since } = {}) {
  const params = {
    ...notificationQueryParams(user),
    limit: 80,
    ...(since ? { since } : {})
  };
  const res = await api.get('/notifications/sync', {
    params,
    skipGlobalErrorToast: true
  });
  const data = unwrapResponseData(res) || {};
  const serverTime = data.serverTime || new Date().toISOString();
  setLastNotificationSyncAt(serverTime, user?.id);
  return {
    unreadCount: Number(data.unreadCount) || 0,
    items: Array.isArray(data.items) ? data.items : [],
    serverTime
  };
}

export async function fetchUnreadCount(user) {
  const res = await api.get('/notifications/unread-count', {
    params: notificationQueryParams(user),
    skipGlobalErrorToast: true
  });
  const data = unwrapResponseData(res);
  return Number(data?.count) || 0;
}

function refreshScopesFromNotifications(items) {
  const scopes = new Set();
  for (const n of items || []) {
    const t = String(n.title || n.type || '').toUpperCase();
    if (t.includes('BID')) scopes.add('bids');
    if (
      t.includes('SHIPMENT') ||
      t.includes('DELIVERY') ||
      t.includes('PICKED') ||
      t.includes('TRANSIT') ||
      t.includes('CONTRACT')
    ) {
      scopes.add('shipments');
    }
    if (t.includes('SPACE') || t.includes('CAPACITY')) scopes.add('space');
    if (t.includes('LOAD')) scopes.add('loads');
  }
  return scopes.size ? [...scopes] : ['all'];
}

function mapNotificationSyncFallback(fallback) {
  const items = Array.isArray(fallback.items) ? fallback.items : [];
  return {
    serverTime: fallback.serverTime,
    unreadCount: fallback.unreadCount,
    notifications: items,
    refreshScopes: refreshScopesFromNotifications(items),
    modules: {},
    auditEvents: []
  };
}

/**
 * Backend-confirmed event sync after reconnect (notifications + module refresh hints).
 * Falls back to /notifications/sync when /operations/sync/events is not deployed yet.
 */
export async function syncEventsSince(user, { since } = {}) {
  const params = notificationQueryParams(user, {
    ...(since ? { since } : {})
  });
  try {
    const res = await api.get('/operations/sync/events', {
      params,
      skipGlobalErrorToast: true
    });
    const data = unwrapResponseData(res) || {};
    const serverTime = data.serverTime || new Date().toISOString();
    setLastNotificationSyncAt(serverTime, user?.id);
    if (data.modules && typeof data.modules === 'object') {
      setModuleSyncTimestamps(data.modules, user?.id);
    }
    return {
      serverTime,
      unreadCount: Number(data.unreadCount) || 0,
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      refreshScopes: Array.isArray(data.refreshScopes) ? data.refreshScopes : [],
      modules: data.modules || {},
      auditEvents: Array.isArray(data.auditEvents) ? data.auditEvents : []
    };
  } catch (err) {
    if (err?.response?.status === 404) {
      const fallback = await syncNotificationsSince(user, { since });
      return mapNotificationSyncFallback(fallback);
    }
    throw err;
  }
}
