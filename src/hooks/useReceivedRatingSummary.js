import { useCallback, useEffect, useState } from 'react';
import { useApi } from './useApi.js';

const cache = new Map();

export function invalidateRatingSummary(userId) {
  if (userId) cache.delete(String(userId));
}

function parseReviewsPayload(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.reviews)) return data.reviews;
  return [];
}

/**
 * Fetches reviews received by `userId` and derives average + count (frontend-only aggregate).
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
    (async () => {
      try {
        const data = await request({ url: `/reviews/${key}` });
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
        if (!cancelled) setState({ ...row, loading: false });
      } catch {
        const row = { avg: null, count: 0 };
        cache.set(key, row);
        if (!cancelled) setState({ ...row, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, request, refreshTick]);

  return state;
}
