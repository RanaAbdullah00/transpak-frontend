import { abortAllInflight } from './inflightRequests.js';
import { clearAuthStorage } from './authSession.js';
import { clearWorkspaceCachesForUser } from './workspace.js';
import { clearAllWorkspaceQueryCaches, invalidateWorkspaceQueryCache } from './workspaceQueryCache.js';

/**
 * Abort HTTP + workspace caches without clearing auth token (role/workspace switch).
 */
export function prepareWorkspaceSwitch(userId = null) {
  abortAllInflight();
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
  prepareWorkspaceSwitch(userId);
  clearAllWorkspaceQueryCaches();
  clearAuthStorage();
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('transpak_notifications_cache');
    sessionStorage.removeItem('transpak_notifications_cache_at');
    sessionStorage.removeItem('tp:notif-last-sync');
    window.dispatchEvent(new CustomEvent('tp:session-cleared'));
  }
}
