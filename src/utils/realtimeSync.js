import api from '../services/api.js';
import { unwrapResponseData } from './unwrapApi.js';
import { mergeWorkspaceParams } from './workspaceApi.js';
import { setLastNotificationSyncAt } from './realtimeDedupe.js';

/**
 * Reconnect recovery — sync missed notifications + authoritative unread count.
 */
export async function syncNotificationsSince(user, { since } = {}) {
  const params = mergeWorkspaceParams(user, {
    limit: 80,
    ...(since ? { since } : {})
  });
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
    params: mergeWorkspaceParams(user),
    skipGlobalErrorToast: true
  });
  const data = unwrapResponseData(res);
  return Number(data?.count) || 0;
}
