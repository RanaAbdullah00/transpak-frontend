/** Per-shipmentRef monotonic event ordering (in-memory, per tab). */

const seqByRef = new Map();

export function trackingEventTimestamp(payload) {
  const ts = payload?.ts;
  if (ts != null && Number.isFinite(Number(ts))) return Number(ts);
  const locAt = payload?.tracking?.locationUpdatedAt;
  if (locAt) {
    const t = new Date(locAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

function coordKey(payload) {
  const loc = payload?.tracking?.currentLocation ?? payload?.tracking?.location;
  if (!Array.isArray(loc) || loc.length < 2) return null;
  const lat = Number(loc[0]);
  const lng = Number(loc[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function refKey(ref) {
  return String(ref || '').trim();
}

/**
 * @returns {{ action: 'apply'|'drop', reason?: string }}
 */
export function evaluateTrackingSequence(shipmentRef, incoming, opts = {}) {
  const key = refKey(shipmentRef);
  if (!key || !incoming) return { action: 'drop', reason: 'empty' };

  const allowCatchUp = Boolean(opts.allowCatchUp);
  const ts = trackingEventTimestamp(incoming);
  const coords = coordKey(incoming);
  const row = seqByRef.get(key) || { lastTs: 0, lastCoordKey: null };

  if (ts > 0 && row.lastTs > 0 && ts < row.lastTs && !allowCatchUp) {
    return { action: 'drop', reason: 'stale_ts' };
  }

  if (
    ts > 0 &&
    row.lastTs > 0 &&
    ts === row.lastTs &&
    coords &&
    row.lastCoordKey &&
    coords === row.lastCoordKey
  ) {
    return { action: 'drop', reason: 'duplicate_ts_coord' };
  }

  const nextTs = ts > 0 ? ts : row.lastTs > 0 ? row.lastTs : Date.now();
  seqByRef.set(key, {
    lastTs: Math.max(row.lastTs, nextTs),
    lastCoordKey: coords || row.lastCoordKey
  });

  return { action: 'apply' };
}

export function resetTrackingSequencer(shipmentRef) {
  const key = refKey(shipmentRef);
  if (key) seqByRef.delete(key);
}

export function clearAllTrackingSequencers() {
  seqByRef.clear();
}
