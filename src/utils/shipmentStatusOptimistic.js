import { normalizeShipmentStatus, nextShipmentStatus, SHIPMENT_ORDER } from './shipmentStatus.js';

/** View-layer optimistic status + timeline — does not touch activation/snapshot engines. */
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
