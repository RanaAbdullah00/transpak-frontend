import { normalizeShipmentStatus, nextShipmentStatus, SHIPMENT_ORDER } from './shipmentStatus.js';

/** View-layer optimistic status + timeline — does not touch activation/snapshot engines. */
const TIMELINE_DISPLAY_STATUSES = new Set(['booked', 'pickedup', 'intransit', 'delivered']);
const statusByRef = new Map();
const socketStatusByRef = new Map();
const timelineByRef = new Map();
const lastEmitByRef = new Map();
const listeners = new Set();
const EMIT_DEDUPE_MS = 800;

function refKey(ref) {
  return String(ref || '').trim();
}

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function getOptimisticShipmentStatus(ref) {
  const key = refKey(ref);
  return key ? statusByRef.get(key) ?? null : null;
}

export function getSocketShipmentStatus(ref) {
  const key = refKey(ref);
  return key ? socketStatusByRef.get(key)?.status ?? null : null;
}

function statusRank(status) {
  const normalized = normalizeShipmentStatus(status);
  if (!normalized) return -1;
  const idx = SHIPMENT_ORDER.indexOf(normalized);
  return idx < 0 ? -1 : idx;
}

function pickFurthestStatus(current, incoming) {
  if (!incoming) return current;
  if (!current) return incoming;
  const ci = statusRank(current);
  const ii = statusRank(incoming);
  if (ii < 0) return current;
  if (ci < 0) return incoming;
  return ii >= ci ? incoming : current;
}

export function getOptimisticStatusTimeline(ref) {
  const key = refKey(ref);
  return key ? [...(timelineByRef.get(key) ?? [])] : [];
}

/** Idempotent bridge — all status UI sync must go through this emitter. */
export function emitShipmentStatusUpdated(ref, status, { source = 'unknown', previous = null } = {}) {
  const key = refKey(ref);
  const normalized = normalizeShipmentStatus(status) || (status ? String(status).trim().toLowerCase() : '');
  if (!key || !normalized || typeof window === 'undefined') return false;

  const now = Date.now();
  const last = lastEmitByRef.get(key);
  if (last?.status === normalized && now - (last.ts || 0) < EMIT_DEDUPE_MS) {
    return false;
  }
  lastEmitByRef.set(key, { status: normalized, ts: now });
  socketStatusByRef.set(key, { status: normalized, ts: now, source });

  window.dispatchEvent(
    new CustomEvent('tp:shipment-status-updated', {
      detail: { ref: key, status: normalized, previous, source }
    })
  );
  notify();
  return true;
}

export function commitOptimisticStatusAdvance(ref, nextStatus, { label = null } = {}) {
  const key = refKey(ref);
  const normalized = normalizeShipmentStatus(nextStatus);
  if (!key || !normalized) return null;

  const previous = statusByRef.get(key) ?? null;
  statusByRef.set(key, normalized);

  const entry = {
    event: label || normalized,
    time: new Date().toISOString(),
    location: null
  };
  timelineByRef.set(key, [...(timelineByRef.get(key) ?? []), entry]);

  emitShipmentStatusUpdated(key, normalized, { source: 'optimistic', previous });
  return normalized;
}

export function subscribeOptimisticShipmentStatus(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Strict status merge order: API base → socket overlay → optimistic overlay.
 * Optimistic store always wins when further along the pipeline.
 */
export function resolveEffectiveShipmentStatus(ref, apiStatus) {
  const api = normalizeShipmentStatus(apiStatus);
  const socket = getSocketShipmentStatus(ref);
  const opt = getOptimisticShipmentStatus(ref);

  let resolved = api || 'booked';
  if (socket) resolved = pickFurthestStatus(resolved, socket);
  if (opt) resolved = pickFurthestStatus(resolved, opt);
  return resolved || 'booked';
}

export function resolveUpcomingShipmentStatus(ref, currentStatus) {
  return nextShipmentStatus(resolveEffectiveShipmentStatus(ref, currentStatus));
}

/** Seed optimistic store from API on load/refresh (server truth unless local opt is further). */
export function rehydrateShipmentStatusFromApi(
  ref,
  { status, history = [], updatedAt = null } = {},
  { force = false } = {}
) {
  const key = refKey(ref);
  if (!key) return;
  const apiStatus = normalizeShipmentStatus(status);
  if (!apiStatus) return;
  const opt = getOptimisticShipmentStatus(key);
  if (!force && opt && statusRank(opt) > statusRank(apiStatus)) {
    return;
  }
  statusByRef.set(key, apiStatus);
  const historyList = Array.isArray(history) ? history : [];
  if (force || historyList.length || !timelineByRef.get(key)?.length) {
    const entries = historyList
      .filter((h) => h && typeof h === 'object')
      .map((h) => ({
        event: h.event || h.label || h.status || apiStatus,
        time: h.time || updatedAt || null,
        location: h.location ?? null,
        status: h.status || apiStatus
      }));
    timelineByRef.set(key, entries);
  }
  notify();
}

function inferTimelineEventStatus(ev, fallbackStatus) {
  const fromField = normalizeShipmentStatus(ev?.status);
  if (fromField) return fromField;
  const fromEvent = normalizeShipmentStatus(ev?.event || ev?.label);
  if (fromEvent && SHIPMENT_ORDER.includes(fromEvent)) return fromEvent;
  return fallbackStatus;
}

/** Collapse duplicate status rows within a time window; enforce monotonic pipeline order. */
export function dedupeTimelineEvents(events, { windowMs = 120_000 } = {}) {
  const list = (Array.isArray(events) ? events : []).filter((ev) => ev && typeof ev === 'object');
  const seen = new Map();
  const out = [];
  for (const ev of list) {
    const status = inferTimelineEventStatus(ev, null);
    const label = String(ev.event || ev.label || status || '').trim().toLowerCase();
    const key = status || label;
    if (!key) {
      out.push(ev);
      continue;
    }
    const ts = ev.time ? new Date(ev.time).getTime() : 0;
    const prev = seen.get(key);
    if (prev != null && ts && Math.abs(ts - prev) < windowMs) continue;
    seen.set(key, ts || Date.now());
    out.push(ev);
  }
  return out.sort((a, b) => {
    const ra = statusRank(inferTimelineEventStatus(a, 'booked'));
    const rb = statusRank(inferTimelineEventStatus(b, 'booked'));
    if (ra !== rb) return ra - rb;
    const ta = a.time ? new Date(a.time).getTime() : 0;
    const tb = b.time ? new Date(b.time).getTime() : 0;
    return ta - tb;
  });
}

/**
 * Merge API history + optimistic timeline; terminal effective status wins over stale rows.
 */
export function mergeShipmentTimelineEvents(
  ref,
  history = [],
  { apiStatus = null, fallbackLabel = 'Update', updatedAt = null } = {}
) {
  const key = refKey(ref);
  const historyList = Array.isArray(history) ? history : [];
  const optimisticLog = key ? getOptimisticStatusTimeline(key) : [];
  const baseStatus =
    normalizeShipmentStatus(apiStatus) ||
    normalizeShipmentStatus(historyList[0]?.status) ||
    'booked';
  const effectiveStatus = resolveEffectiveShipmentStatus(key, baseStatus);
  const merged = dedupeTimelineEvents(
    [...historyList, ...optimisticLog].filter((ev) => ev && typeof ev === 'object')
  );
  const events = merged.map((ev) => ({
    label: ev.event || ev.label || fallbackLabel,
    time: ev.time || '',
    done: true,
    note: ev.location ?? null,
    status: inferTimelineEventStatus(ev, effectiveStatus)
  }));
  const filtered = events.filter((ev) => {
    const st = normalizeShipmentStatus(ev.status);
    return st && TIMELINE_DISPLAY_STATUSES.has(st);
  });
  const byStatus = new Map();
  for (const ev of filtered) {
    byStatus.set(normalizeShipmentStatus(ev.status), ev);
  }
  const ordered = SHIPMENT_ORDER.filter((s) => TIMELINE_DISPLAY_STATUSES.has(s))
    .map((s) => byStatus.get(s))
    .filter(Boolean);
  return { events: ordered, effectiveStatus };
}
