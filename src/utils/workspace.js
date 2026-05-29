/**
 * Workspace = UI mode (shipper | carrier | admin) for one authenticated account.
 * Keys isolate cached client state per account + workspace.
 */

export function getWorkspace(user) {
  const role = String(user?.activeRole || '').trim().toLowerCase();
  if (role === 'shipper' || role === 'carrier' || role === 'admin') return role;
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles[0] || 'unknown';
}

export function workspaceCacheKey(user, suffix) {
  const uid = user?.id ? String(user.id) : 'anon';
  const ws = getWorkspace(user);
  return `tp:${uid}:${ws}:${suffix}`;
}

export function readWorkspaceCache(user, suffix) {
  if (typeof window === 'undefined' || !user?.id) return null;
  try {
    const raw = sessionStorage.getItem(workspaceCacheKey(user, suffix));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeWorkspaceCache(user, suffix, value) {
  if (typeof window === 'undefined' || !user?.id) return;
  try {
    sessionStorage.setItem(workspaceCacheKey(user, suffix), JSON.stringify(value));
  } catch {
    /* quota */
  }
}

export function clearWorkspaceCachesForUser(userId) {
  if (typeof window === 'undefined' || !userId) return;
  const prefix = `tp:${userId}:`;
  const keys = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k);
  }
  keys.forEach((k) => sessionStorage.removeItem(k));
}
