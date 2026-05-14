import { useEffect, useState } from 'react';
import { useApi } from './useApi.js';

const cache = new Map();

export function invalidateRatingSummary(userId) {
  if (userId) cache.delete(String(userId));
}

/**
 * Fetches reviews received by `userId` and derives average + count (frontend-only aggregate).
 */
export function useReceivedRatingSummary(userId) {
  const { request } = useApi();
  const key = userId ? String(userId) : '';
  const [state, setState] = useState(() => ({
    avg: null,
    count: 0,
    loading: Boolean(key)
  }));

  useEffect(() => {
    if (!key) {
      setState({ avg: null, count: 0, loading: false });
      return;
    }
    if (cache.has(key)) {
      setState({ ...cache.get(key), loading: false });
      return;
    }
    let cancelled = false;
    setState({ avg: null, count: 0, loading: true });
    (async () => {
      try {
        const data = await request({ url: `/reviews/${key}` });
        const list = Array.isArray(data) ? data : [];
        const count = list.length;
        const avg = count ? list.reduce((a, r) => a + Number(r.rating ?? r.score ?? 0), 0) / count : null;
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
  }, [key, request]);

  return state;
}
