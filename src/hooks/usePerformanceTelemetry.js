import { useEffect, useState } from 'react';

/**
 * Phase 4 — non-blocking performance telemetry (DEV or sampled production).
 * Does not participate in render paths; metrics updated via queueMicrotask.
 */

const RATING_DEFAULTS = {
  batchRequestCount: 0,
  batchCacheHits: 0,
  batchCacheMisses: 0,
  avgBatchResponseTime: 0,
  userCountPerBatch: 0,
  _batchResponseTotalMs: 0
};

const TRACKING_DEFAULTS = {
  socketEventCount: 0,
  rAFFlushCount: 0,
  debounceFlushCount: 0,
  rehydrateCount: 0,
  activeSourceTransitions: 0,
  dedupeSkippedCount: 0
};

const metrics = {
  rating: { ...RATING_DEFAULTS },
  tracking: { ...TRACKING_DEFAULTS },
  updatedAt: 0
};

const listeners = new Set();
let sampleDecided = false;
let sampleEnabled = false;

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn(getPerformanceMetricsSnapshot());
    } catch {
      /* ignore */
    }
  });
}

function scheduleMetricUpdate(fn) {
  queueMicrotask(() => {
    fn();
    metrics.updatedAt = Date.now();
    if (isTelemetryEnabled()) notifyListeners();
  });
}

export function isTelemetryEnabled() {
  if (import.meta.env.DEV) return true;
  if (import.meta.env.VITE_PERF_TELEMETRY === '1') return true;
  if (typeof window === 'undefined') return false;
  if (window.__TP_PERF_TELEMETRY__ === true) return true;
  if (!sampleDecided) {
    sampleDecided = true;
    sampleEnabled = Math.random() < 0.01;
    window.__TP_PERF_TELEMETRY__ = sampleEnabled;
  }
  return sampleEnabled;
}

function devLog(label, detail) {
  if (!isTelemetryEnabled()) return;
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[perf:${label}]`, detail);
  }
}

export function getPerformanceMetricsSnapshot() {
  const { _batchResponseTotalMs, ...rating } = metrics.rating;
  return {
    rating: {
      ...rating,
      avgBatchResponseTime:
        rating.batchRequestCount > 0
          ? Math.round(_batchResponseTotalMs / rating.batchRequestCount)
          : 0
    },
    tracking: { ...metrics.tracking },
    updatedAt: metrics.updatedAt
  };
}

export function resetPerformanceMetrics() {
  metrics.rating = { ...RATING_DEFAULTS };
  metrics.tracking = { ...TRACKING_DEFAULTS };
  metrics.updatedAt = Date.now();
}

export function recordRatingBatchRequest({ userCount = 0, durationMs = 0, cacheHits = 0, cacheMisses = 0 } = {}) {
  if (!isTelemetryEnabled()) return;
  scheduleMetricUpdate(() => {
    metrics.rating.batchRequestCount += 1;
    metrics.rating.userCountPerBatch = userCount;
    metrics.rating.batchCacheHits += cacheHits;
    metrics.rating.batchCacheMisses += cacheMisses;
    metrics.rating._batchResponseTotalMs += durationMs;
    devLog('rating-batch', { userCount, durationMs, cacheHits, cacheMisses });
  });
}

export function recordRatingCacheHit(count = 1) {
  if (!isTelemetryEnabled()) return;
  scheduleMetricUpdate(() => {
    metrics.rating.batchCacheHits += count;
  });
}

export function recordRatingCacheMiss(count = 1) {
  if (!isTelemetryEnabled()) return;
  scheduleMetricUpdate(() => {
    metrics.rating.batchCacheMisses += count;
  });
}

export function recordTrackingSocketEvent() {
  if (!isTelemetryEnabled()) return;
  scheduleMetricUpdate(() => {
    metrics.tracking.socketEventCount += 1;
  });
}

export function recordTrackingRAFFlush() {
  if (!isTelemetryEnabled()) return;
  scheduleMetricUpdate(() => {
    metrics.tracking.rAFFlushCount += 1;
  });
}

export function recordTrackingDebounceFlush() {
  if (!isTelemetryEnabled()) return;
  scheduleMetricUpdate(() => {
    metrics.tracking.debounceFlushCount += 1;
  });
}

export function recordTrackingRehydrate() {
  if (!isTelemetryEnabled()) return;
  scheduleMetricUpdate(() => {
    metrics.tracking.rehydrateCount += 1;
  });
}

export function recordActiveSourceTransition(from, to) {
  if (!isTelemetryEnabled()) return;
  scheduleMetricUpdate(() => {
    metrics.tracking.activeSourceTransitions += 1;
    devLog('source-transition', { from, to });
  });
}

export function recordTrackingEventDeduped() {
  if (!isTelemetryEnabled()) return;
  scheduleMetricUpdate(() => {
    metrics.tracking.dedupeSkippedCount += 1;
  });
}

/**
 * Subscribe to metric snapshots (DEV / sampled prod). Returns snapshot object.
 */
export function usePerformanceTelemetry({ pollMs = 0 } = {}) {
  const [snapshot, setSnapshot] = useState(() => getPerformanceMetricsSnapshot());

  useEffect(() => {
    if (!isTelemetryEnabled()) return undefined;
    const onUpdate = (next) => setSnapshot(next);
    listeners.add(onUpdate);
    if (pollMs > 0) {
      const id = setInterval(() => setSnapshot(getPerformanceMetricsSnapshot()), pollMs);
      return () => {
        listeners.delete(onUpdate);
        clearInterval(id);
      };
    }
    return () => listeners.delete(onUpdate);
  }, [pollMs]);

  return snapshot;
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__TP_PERF_METRICS__ = getPerformanceMetricsSnapshot;
}
