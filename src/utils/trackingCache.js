import { normalizeTracking } from '../adapters/normalize.js';
import { trackingEventTimestamp } from './trackingSequencer.js';

/** Last-known-good tracking payloads (survives hook remount; cleared on auth session clear). */

const cacheByRef = new Map();

function refKey(ref) {
  return String(ref || '').trim();
}

/**
 * @returns {import('../adapters/normalize.js').normalizeTracking extends Function ? ReturnType<...> : object|null}
 */
export function getCachedTrackingPayload(shipmentRef) {
  const row = cacheByRef.get(refKey(shipmentRef));
  return row?.payload ? { ...row.payload } : null;
}

export function getLastKnownCoordinates(shipmentRef) {
  try {
    const row = cacheByRef.get(refKey(shipmentRef));
    if (!row) return null;
    if (Array.isArray(row.lastValidCoordinates) && row.lastValidCoordinates.length >= 2) {
      const lat = Number(row.lastValidCoordinates[0]);
      const lng = Number(row.lastValidCoordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    }
    const loc = row.payload?.tracking?.currentLocation ?? row.payload?.tracking?.location;
    if (
      Array.isArray(loc) &&
      loc.length >= 2 &&
      Number.isFinite(Number(loc[0])) &&
      Number.isFinite(Number(loc[1]))
    ) {
      return [Number(loc[0]), Number(loc[1])];
    }
    return null;
  } catch {
    return null;
  }
}

export function getCacheMeta(shipmentRef) {
  const row = cacheByRef.get(refKey(shipmentRef));
  if (!row) return null;
  return {
    lastValidTimestamp: row.lastValidTimestamp,
    lastKnownStatus: row.lastKnownStatus,
    lastUpdatedFromSocket: row.lastUpdatedFromSocket,
    updatedAt: row.updatedAt
  };
}

/**
 * @param {string} shipmentRef
 * @param {object|null} payload normalized tracking payload
 * @param {'socket'|'rest'} source
 */
export function updateTrackingCache(shipmentRef, payload, source = 'socket') {
  const key = refKey(shipmentRef);
  if (!key || !payload || typeof payload !== 'object') return;

  try {
  const loc = payload?.tracking?.currentLocation ?? payload?.tracking?.location;
  const hasCoords =
    Array.isArray(loc) &&
    loc.length >= 2 &&
    Number.isFinite(Number(loc[0])) &&
    Number.isFinite(Number(loc[1]));

  cacheByRef.set(key, {
    payload: normalizeTracking(payload),
    lastValidCoordinates: hasCoords ? [Number(loc[0]), Number(loc[1])] : null,
    lastValidTimestamp: trackingEventTimestamp(payload) || Date.now(),
    lastKnownStatus: payload?.tracking?.status ?? null,
    lastUpdatedFromSocket: source === 'socket',
    updatedAt: Date.now()
  });
  } catch {
    /* ignore corrupt cache writes */
  }
}

export function clearTrackingCache(shipmentRef) {
  const key = refKey(shipmentRef);
  if (key) cacheByRef.delete(key);
}

export function clearAllTrackingCaches() {
  cacheByRef.clear();
}
