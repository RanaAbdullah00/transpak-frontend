import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth.js';
import { getWorkspace } from '../utils/workspace.js';
import {
  getWorkspaceQueryCache,
  setWorkspaceQueryCache,
  invalidateWorkspaceQueryCache
} from '../utils/workspaceQueryCache.js';

/**
 * Workspace-scoped data fetch with in-memory cache (user_id + activeRole).
 */
export function useWorkspaceQuery(cacheSuffix, fetcher, { enabled = true, ttlMs = 120000 } = {}) {
  const { user, sessionVersion } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const userId = user?.id ? String(user.id) : '';
  const workspace = user ? getWorkspace(user) : '';

  const run = useCallback(async () => {
    if (!enabled || !userId || !workspace) {
      setLoading(false);
      return;
    }
    const cached = getWorkspaceQueryCache(userId, workspace, cacheSuffix);
    if (cached !== undefined) {
      setData(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setWorkspaceQueryCache(userId, workspace, cacheSuffix, result, ttlMs);
      setData(result);
    } catch (err) {
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, userId, workspace, cacheSuffix, ttlMs]);

  useEffect(() => {
    setData(null);
    setError(null);
    if (!enabled || !userId) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await run();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, workspace, sessionVersion, cacheSuffix, enabled, run]);

  useEffect(() => {
    const onSwitch = () => {
      if (userId) invalidateWorkspaceQueryCache(userId);
      setData(null);
    };
    window.addEventListener('tp:workspace-switching', onSwitch);
    window.addEventListener('tp:session-cleared', onSwitch);
    return () => {
      window.removeEventListener('tp:workspace-switching', onSwitch);
      window.removeEventListener('tp:session-cleared', onSwitch);
    };
  }, [userId]);

  return { data, loading, error, refetch: run };
}
