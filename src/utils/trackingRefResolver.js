/**
 * Canonical tracking ref for URLs, sockets, and REST (Flow A + Flow B).
 * Prefer human load code; fall back to UUID only when no code exists.
 */
export function getTrackingRef(input = {}) {
  if (!input || typeof input !== 'object') return '';

  const code = input.refKey ?? input.code ?? input.loadCode ?? input.trackRef;
  if (code != null && String(code).trim()) return String(code).trim();

  const loadId = input.loadId ?? input.id;
  if (loadId != null && String(loadId).trim()) return String(loadId).trim();

  return '';
}

/** True if two refs refer to the same shipment (code vs UUID). */
export function trackingRefsMatch(a, b) {
  const left = String(a ?? '').trim();
  const right = String(b ?? '').trim();
  if (!left || !right) return false;
  return left === right;
}

/** Collect candidate refs from a payload or list row. */
export function collectTrackingRefs(input = {}) {
  const refs = [
    getTrackingRef(input),
    input.refKey,
    input.code,
    input.loadCode,
    input.loadId,
    input.id,
    input.trackRef
  ]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
  return [...new Set(refs)];
}
