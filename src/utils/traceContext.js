/**
 * Phase 7 — client traceId propagation (X-Trace-Id header).
 */
const STORAGE_KEY = 'transpak_trace_id';

export function createTraceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateTraceId() {
  if (typeof sessionStorage === 'undefined') return createTraceId();
  let id = sessionStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = createTraceId();
    sessionStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function refreshTraceId() {
  const id = createTraceId();
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function traceHeaders(extra = {}) {
  return {
    'X-Trace-Id': getOrCreateTraceId(),
    ...extra
  };
}
