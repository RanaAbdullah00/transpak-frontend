/**
 * In-memory query cache partitioned by user_id + workspace (activeRole).
 */

const store = new Map();
const DEFAULT_TTL_MS = Number(import.meta.env.VITE_WORKSPACE_CACHE_TTL_MS || 120000);
const MAX_ENTRIES = Number(import.meta.env.VITE_WORKSPACE_CACHE_MAX || 200);

function cacheKey(userId, workspace, suffix) {
  return `tp:${String(userId)}:${String(workspace)}:${String(suffix)}`;
}

export function getWorkspaceQueryCache(userId, workspace, suffix) {
  if (!userId || !workspace) return undefined;
  const key = cacheKey(userId, workspace, suffix);
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function setWorkspaceQueryCache(userId, workspace, suffix, value, ttlMs = DEFAULT_TTL_MS) {
  if (!userId || !workspace) return;
  pruneWorkspaceQueryCaches();
  store.set(cacheKey(userId, workspace, suffix), {
    value,
    expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null
  });
}

export function invalidateWorkspaceQueryCache(userId, workspace = null) {
  const uid = userId ? String(userId) : '';
  const ws = workspace ? String(workspace) : null;
  for (const key of [...store.keys()]) {
    if (!uid) {
      store.delete(key);
      continue;
    }
    if (!key.startsWith(`tp:${uid}:`)) continue;
    if (ws && !key.startsWith(`tp:${uid}:${ws}:`)) continue;
    store.delete(key);
  }
}

export function clearAllWorkspaceQueryCaches() {
  store.clear();
}

/** Drop expired entries and cap total size (Phase 8). */
export function pruneWorkspaceQueryCaches() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt && now > entry.expiresAt) store.delete(key);
  }
  if (store.size <= MAX_ENTRIES) return;
  const sorted = [...store.entries()].sort((a, b) => {
    const ea = a[1].expiresAt ?? 0;
    const eb = b[1].expiresAt ?? 0;
    return ea - eb;
  });
  const remove = sorted.slice(0, store.size - MAX_ENTRIES);
  remove.forEach(([key]) => store.delete(key));
}
