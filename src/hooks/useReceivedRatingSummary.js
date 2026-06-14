import { useCallback, useEffect, useState } from 'react';
import { useApi } from './useApi.js';

const cache = new Map();
const pendingIds = new Set();
const waiters = new Set();
let batchTimer = null;

export function invalidateRatingSummary(userId) {
  if (userId) cache.delete(String(userId));
}

function parseReviewsPayload(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.reviews)) return data.reviews;
  return [];
}

function notifyWaiters() {
  waiters.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
  waiters.clear();
}

function scheduleBatchFetch(request) {
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(async () => {
    batchTimer = null;
    const ids = [...pendingIds];
    pendingIds.clear();
    if (!ids.length) {
      notifyWaiters();
      return;
    }
    try {
      const data = await request({
        url: '/reviews/summary',
        params: { userIds: ids.join(',') },
        skipGlobalErrorToast: true
      });
      for (const id of ids) {
        const row = data?.[id] || { ratingAverage: 0, ratingCount: 0 };
        const count = Number(row.ratingCount || 0);
        const avg = count ? Number(row.ratingAverage ?? 0) : null;
        cache.set(id, { avg, count });
      }
    } catch {
      for (const id of ids) {
        cache.set(id, { avg: null, count: 0 });
      }
    }
    notifyWaiters();
  }, 40);
}

/**
 * Fetches reviews received by `userId` — batches summary lookups via GET /reviews/summary.
 */
export function useReceivedRatingSummary(userId) {
  const { request } = useApi();
  const key = userId ? String(userId) : '';
  const [refreshTick, setRefreshTick] = useState(0);
  const [state, setState] = useState(() => ({
    avg: null,
    count: 0,
    loading: Boolean(key)
  }));

  const bumpRefresh = useCallback(() => {
    if (key) {
      cache.delete(key);
      setRefreshTick((n) => n + 1);
    }
  }, [key]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'reviews') return;
      bumpRefresh();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [bumpRefresh]);

  useEffect(() => {
    if (!key) {
      setState({ avg: null, count: 0, loading: false });
      return;
    }
    if (refreshTick === 0 && cache.has(key)) {
      setState({ ...cache.get(key), loading: false });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    const applyFromCache = () => {
      if (cancelled) return;
      const row = cache.get(key) || { avg: null, count: 0 };
      setState({ ...row, loading: false });
    };

    if (cache.has(key)) {
      applyFromCache();
      return () => {
        cancelled = true;
      };
    }

    pendingIds.add(key);
    waiters.add(applyFromCache);
    scheduleBatchFetch(request);

    return () => {
      cancelled = true;
      waiters.delete(applyFromCache);
    };
  }, [key, request, refreshTick]);

  return state;
}

/** Legacy single-user fetch for panels that need full review list. */
export async function fetchRatingSummary(request, userId) {
  const key = String(userId || '').trim();
  if (!key) return { avg: null, count: 0, reviews: [] };
  if (cache.has(key)) return { ...cache.get(key), reviews: [] };
  const data = await request({ url: `/reviews/${key}`, skipGlobalErrorToast: true });
  const list = parseReviewsPayload(data);
  const count = Number(data?.ratingCount ?? list.length) || 0;
  const avgFromApi = data?.ratingAverage != null ? Number(data.ratingAverage) : null;
  const avg =
    avgFromApi != null && !Number.isNaN(avgFromApi)
      ? avgFromApi
      : count
        ? list.reduce((a, r) => a + Number(r.rating ?? r.score ?? 0), 0) / count
        : null;
  const row = { avg, count };
  cache.set(key, row);
  return { ...row, reviews: list };
}
