/**
 * Phase 5 — sampled performance metrics export (non-blocking, additive).
 */
import {
  getPerformanceMetricsSnapshot,
  isTelemetryEnabled
} from '../hooks/usePerformanceTelemetry.js';
import { getCoordinatorTrace } from '../hooks/useTrackingCoordinator.js';
import api from '../services/api.js';

const EXPORT_INTERVAL_MS = Number(import.meta.env.VITE_PERF_EXPORT_INTERVAL_MS || 60_000);
let exportStarted = false;
let exportTimer = null;

export function buildPerformanceExportPayload() {
  const snap = getPerformanceMetricsSnapshot();
  return {
    schema: 'transpak.perf.v1',
    exportedAt: new Date().toISOString(),
    metrics: {
      rating: {
        ...snap.rating,
        avgBatchLatency: snap.rating.avgBatchResponseTime
      },
      tracking: snap.tracking,
      updatedAt: snap.updatedAt
    },
    coordinatorTrace: getCoordinatorTrace()
  };
}

export function exportPerformanceMetricsToConsole() {
  if (!isTelemetryEnabled()) return null;
  const payload = buildPerformanceExportPayload();
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[tp:perf-export]', JSON.stringify(payload));
  }
  return payload;
}

export async function exportPerformanceMetricsToBackend() {
  if (import.meta.env.VITE_PERF_EXPORT_BACKEND !== '1') return null;
  const payload = buildPerformanceExportPayload();
  try {
    await api.post('/operations/client-perf', payload, {
      skipGlobalErrorToast: true,
      timeout: 4000
    });
  } catch {
    /* sampled export must not affect UX */
  }
  return payload;
}

function scheduleExportTick() {
  const run = () => {
    exportPerformanceMetricsToConsole();
    exportPerformanceMetricsToBackend();
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 3000 });
  } else {
    queueMicrotask(run);
  }
}

export function initPerformanceTelemetryExport() {
  if (exportStarted || typeof window === 'undefined') return;
  if (!isTelemetryEnabled()) return;
  exportStarted = true;

  if (import.meta.env.DEV) {
    scheduleExportTick();
  }

  exportTimer = window.setInterval(scheduleExportTick, EXPORT_INTERVAL_MS);
  window.__TP_PERF_EXPORT__ = buildPerformanceExportPayload;

  return () => {
    if (exportTimer) window.clearInterval(exportTimer);
    exportTimer = null;
    exportStarted = false;
  };
}

export function stopPerformanceTelemetryExport() {
  if (exportTimer) window.clearInterval(exportTimer);
  exportTimer = null;
  exportStarted = false;
}
