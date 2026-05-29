import { abortAllInflight } from './inflightRequests.js';
import { clearAuthStorage } from './authSession.js';
import { clearWorkspaceCachesForUser } from './workspace.js';
import { clearAllWorkspaceQueryCaches, invalidateWorkspaceQueryCache } from './workspaceQueryCache.js';

/**
 * Workspace switch — clear caches; optionally abort in-flight HTTP (commercial role changes).
 */
export function prepareWorkspaceSwitch(userId = null, { abortInflight = false } = {}) {
  if (abortInflight) abortAllInflight();
  if (userId) {
    clearWorkspaceCachesForUser(userId);
    invalidateWorkspaceQueryCache(userId);
  } else {
    clearAllWorkspaceQueryCaches();
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tp:workspace-switching'));
  }
}

/**
 * Atomic client session teardown — call on logout and before login as another user.
 */
export function clearEntireSession({ userId = null } = {}) {
  prepareWorkspaceSwitch(userId, { abortInflight: true });
  clearAllWorkspaceQueryCaches();
  clearAuthStorage();
  if (typeof window !== 'undefined') {
    if (userId) {
      sessionStorage.removeItem(`transpak_notifications_cache:${userId}`);
      sessionStorage.removeItem(`transpak_notifications_cache_at:${userId}`);
      sessionStorage.removeItem(`tp:${userId}:notif-last-sync`);
    }
    sessionStorage.removeItem('transpak_notifications_cache');
    sessionStorage.removeItem('transpak_notifications_cache_at');
    sessionStorage.removeItem('tp:notif-last-sync');
    window.dispatchEvent(new CustomEvent('tp:session-cleared'));
  }
}
