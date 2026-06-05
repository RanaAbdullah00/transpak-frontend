import { normalizeTracking } from '../adapters/normalize.js';

const EMPTY_TRACKING = Object.freeze({
  refKey: '',
  tracking: Object.freeze({ status: 'posted', currentLocation: null }),
  liveTrackingMap: Object.freeze({ coordinates: [] }),
  history: Object.freeze([])
});

/**
 * Safe tracking payload for hooks/maps — never throws on partial API data.
 */
export function sanitizeTrackingPayload(raw) {
  if (!raw) return null;
  try {
    const normalized = normalizeTracking(raw) || raw;
    if (!normalized || typeof normalized !== 'object') return null;

    const refKey = String(
      normalized.refKey ?? normalized.code ?? normalized.loadCode ?? ''
    ).trim();

    const tracking = normalized.tracking && typeof normalized.tracking === 'object'
      ? normalized.tracking
      : { status: 'posted' };

    const coords = Array.isArray(normalized.liveTrackingMap?.coordinates)
      ? normalized.liveTrackingMap.coordinates
      : [];

    return {
      ...normalized,
      refKey: refKey || normalized.refKey,
      tracking: {
        status: tracking.status ?? 'posted',
        currentLocation: tracking.currentLocation ?? tracking.location ?? null,
        location: tracking.location ?? null,
        locationUpdatedAt: tracking.locationUpdatedAt ?? null,
        locationUnavailable: Boolean(tracking.locationUnavailable),
        eta: tracking.eta ?? null,
        ts: tracking.ts ?? null
      },
      liveTrackingMap: { coordinates: coords },
      history: Array.isArray(normalized.history) ? normalized.history : []
    };
  } catch {
    return null;
  }
}

export function emptyTrackingPayload(ref = '') {
  return {
    ...EMPTY_TRACKING,
    refKey: String(ref || '').trim()
  };
}

/** Skip React updates when tracking snapshot is unchanged. */
export function trackingPayloadEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const aLoc = a.tracking?.currentLocation ?? a.tracking?.location;
  const bLoc = b.tracking?.currentLocation ?? b.tracking?.location;
  const sameLoc =
    JSON.stringify(aLoc ?? null) === JSON.stringify(bLoc ?? null);
  return (
    String(a.refKey || '') === String(b.refKey || '') &&
    String(a.tracking?.status || '') === String(b.tracking?.status || '') &&
    sameLoc &&
    Number(a.ts || 0) === Number(b.ts || 0)
  );
}
