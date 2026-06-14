import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from './useApi.js';
import {
  recordRatingBatchRequest,
  recordRatingCacheHit,
  recordRatingCacheMiss
} from './usePerformanceTelemetry.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cache = new Map();
const pendingIds = new Set();
const waiters = new Set();
let batchTimer = null;

function normalizeUserId(id) {
  const key = String(id || '').trim();
  return UUID_RE.test(key) ? key : '';
}

function normalizeSummaryRow(row = {}) {
  const count = Number(row.ratingCount ?? row.count ?? 0) || 0;
  const avgRaw = row.avgRating ?? row.ratingAverage ?? row.avg;
  const avg =
    avgRaw != null && !Number.isNaN(Number(avgRaw))
      ? Number(avgRaw)
      : count
        ? Number(row.ratingAverage ?? 0)
        : null;
  return {
    avgRating: count ? avg : null,
    count,
    lastReviewAt: row.lastReviewAt ?? null
  };
}

export function invalidateRatingSummary(userId) {
  const key = normalizeUserId(userId);
  if (key) cache.delete(key);
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
    const cacheMisses = ids.filter((id) => !cache.has(id)).length;
    const cacheHits = ids.length - cacheMisses;
    recordRatingCacheMiss(cacheMisses);
    const started = Date.now();
    try {
      const data = await request({
        url: '/reviews/summary',
        params: { userIds: ids.join(',') },
        skipGlobalErrorToast: true
      });
      for (const id of ids) {
        cache.set(id, normalizeSummaryRow(data?.[id]));
      }
    } catch {
      for (const id of ids) {
        cache.set(id, { avgRating: null, count: 0, lastReviewAt: null });
      }
    }
    recordRatingBatchRequest({
      userCount: ids.length,
      durationMs: Date.now() - started,
      cacheHits,
      cacheMisses
    });
    notifyWaiters();
  }, 40);
}

function buildRatingMap(ids) {
  const map = {};
  for (const id of ids) {
    map[id] = cache.get(id) || { avgRating: null, count: 0, lastReviewAt: null };
  }
  return map;
}

function idsNeedFetch(ids) {
  return ids.some((id) => !cache.has(id));
}

/**
 * Batch rating summaries for visible list user IDs — one GET /reviews/summary per coalesce window.
 */
export function useRatingSummaryBatch(userIds = []) {
  const { request } = useApi();
  const [refreshTick, setRefreshTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mapTick, setMapTick] = useState(0);
  const idsKey = useMemo(() => {
    const unique = [...new Set((Array.isArray(userIds) ? userIds : []).map(normalizeUserId).filter(Boolean))];
    unique.sort();
    return unique.join(',');
  }, [userIds]);
  const ids = useMemo(
    () => (idsKey ? idsKey.split(',').filter(Boolean) : []),
    [idsKey]
  );

  const bumpRefresh = useCallback(() => {
    for (const id of ids) cache.delete(id);
    setRefreshTick((n) => n + 1);
  }, [ids]);

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
    if (!ids.length) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const applyFromCache = () => {
      if (cancelled) return;
      setMapTick((n) => n + 1);
      setLoading(false);
    };

    if (!idsNeedFetch(ids) && refreshTick === 0) {
      recordRatingCacheHit(ids.length);
      setLoading(false);
      return undefined;
    }

    if (ids.every((id) => cache.has(id))) {
      recordRatingCacheHit(ids.length);
      applyFromCache();
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    for (const id of ids) pendingIds.add(id);
    waiters.add(applyFromCache);
    scheduleBatchFetch(request);

    return () => {
      cancelled = true;
      waiters.delete(applyFromCache);
    };
  }, [idsKey, ids, request, refreshTick]);

  const ratingMap = useMemo(() => buildRatingMap(ids), [ids, idsKey, mapTick]);

  return { ratingMap, loading };
}

export function lookupRatingSummary(ratingMap, userId) {
  const key = normalizeUserId(userId);
  if (!key || !ratingMap) return { avg: null, count: 0, lastReviewAt: null };
  const row = ratingMap[key];
  if (!row) return { avg: null, count: 0, lastReviewAt: null };
  return {
    avg: row.avgRating ?? null,
    count: row.count ?? 0,
    lastReviewAt: row.lastReviewAt ?? null
  };
}
