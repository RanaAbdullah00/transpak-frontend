import { useMemo } from 'react';
import { useRatingSummaryBatch, lookupRatingSummary, invalidateRatingSummary } from './useRatingSummaryBatch.js';

export { invalidateRatingSummary };

function parseReviewsPayload(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.reviews)) return data.reviews;
  return [];
}

/**
 * Single-user wrapper — delegates to useRatingSummaryBatch for one shared cache.
 */
export function useReceivedRatingSummary(userId) {
  const key = userId ? String(userId) : '';
  const { ratingMap, loading } = useRatingSummaryBatch(key ? [key] : []);
  const row = useMemo(() => lookupRatingSummary(ratingMap, key), [ratingMap, key]);
  return {
    avg: row.avg,
    count: row.count,
    lastReviewAt: row.lastReviewAt,
    loading: Boolean(key) && loading
  };
}

/** Legacy single-user fetch for panels that need full review list. */
export async function fetchRatingSummary(request, userId) {
  const key = String(userId || '').trim();
  if (!key) return { avg: null, count: 0, reviews: [] };
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
  return { avg, count, reviews: list };
}
