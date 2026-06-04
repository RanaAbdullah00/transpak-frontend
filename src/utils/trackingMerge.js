import { normalizeTracking } from '../adapters/normalize.js';
import { isLocationFresh } from './logisticsLifecycle.js';

export function matchesTrackingRef(payloadRef, ...localRefs) {
  const p = String(payloadRef ?? '').trim();
  if (!p) return false;
  return localRefs.some((r) => {
    const loc = String(r ?? '').trim();
    return loc && p === loc;
  });
}

/** Match socket/REST payloads when ref is load code but client still holds UUID (or vice versa). */
export function matchesTrackingPayload(incoming, ...localRefs) {
  if (!incoming) return false;
  const incomingKeys = [incoming.refKey, incoming.loadId]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
  if (!incomingKeys.length) return false;
  const locals = localRefs.map((r) => String(r ?? '').trim()).filter(Boolean);
  if (!locals.length) return false;
  return incomingKeys.some((k) => locals.includes(k));
}

function trackingTimestamp(p) {
  const ts = p?.ts;
  if (ts != null && Number.isFinite(Number(ts))) return Number(ts);
  const locAt = p?.tracking?.locationUpdatedAt;
  if (locAt) {
    const t = new Date(locAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

export function isStaleTrackingUpdate(prev, incoming) {
  if (!incoming) return true;
  if (!prev) return false;
  const prevTs = trackingTimestamp(prev);
  const incTs = trackingTimestamp(incoming);
  if (incTs > 0 && prevTs > 0 && incTs < prevTs) return true;
  const prevLocAt = prev?.tracking?.locationUpdatedAt;
  const incLocAt = incoming?.tracking?.locationUpdatedAt;
  if (prevLocAt && incLocAt) {
    const p = new Date(prevLocAt).getTime();
    const i = new Date(incLocAt).getTime();
    if (Number.isFinite(p) && Number.isFinite(i) && i < p) return true;
  }
  return false;
}

export function mergeTrackingHistory(prev, incoming) {
  if (!Array.isArray(incoming) || incoming.length === 0) return Array.isArray(prev) ? prev : [];
  const keyOf = (ev) =>
    `${String(ev?.time ?? '')}|${String(ev?.event ?? ev?.label ?? '')}|${String(ev?.location ?? ev?.note ?? '')}`;
  const map = new Map();
  for (const ev of [...incoming, ...(Array.isArray(prev) ? prev : [])]) {
    const k = keyOf(ev);
    if (!map.has(k)) map.set(k, ev);
  }
  return Array.from(map.values());
}

/** Socket partial updates merge over REST baseline; driver coords prefer newer timestamps. */
function coordPair(loc) {
  if (!Array.isArray(loc) || loc.length < 2) return null;
  const lat = Number(loc[0]);
  const lng = Number(loc[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/** Skip React state updates when socket tick has no meaningful map change. */
export function shouldApplyTrackingUpdate(prev, incoming) {
  if (!incoming) return false;
  if (!prev) return true;
  if (isStaleTrackingUpdate(prev, incoming)) return false;

  const prevStatus = String(prev?.tracking?.status || '');
  const nextStatus = String(incoming?.tracking?.status || '');
  if (prevStatus !== nextStatus) return true;

  const prevCoord = coordPair(prev?.tracking?.currentLocation ?? prev?.tracking?.location);
  const nextCoord = coordPair(
    incoming?.tracking?.currentLocation ?? incoming?.tracking?.location
  );
  if (prevCoord !== nextCoord) return true;

  const prevHist = Array.isArray(prev?.history) ? prev.history.length : 0;
  const nextHist = Array.isArray(incoming?.history) ? incoming.history.length : 0;
  if (prevHist !== nextHist) return true;

  return false;
}

export function mergeTrackingPayload(prev, incoming) {
  if (!incoming) return prev;
  if (isStaleTrackingUpdate(prev, incoming)) return prev;

  const incLoc = incoming?.tracking?.currentLocation ?? incoming?.tracking?.location;
  const hasIncLoc =
    Array.isArray(incLoc) &&
    incLoc.length >= 2 &&
    Number.isFinite(Number(incLoc[0])) &&
    Number.isFinite(Number(incLoc[1]));

  const incFresh =
    hasIncLoc &&
    (isLocationFresh(
      incoming?.tracking?.locationUpdatedAt,
      incoming?.ts ?? incoming?.tracking?.ts
    ) ||
      (Number(incoming?.ts) > 0 && Number(incoming?.ts) >= Number(prev?.ts || 0)));

  const prevLoc = prev?.tracking?.currentLocation ?? prev?.tracking?.location;
  const prevFresh =
    Array.isArray(prevLoc) &&
    prevLoc.length >= 2 &&
    isLocationFresh(prev?.tracking?.locationUpdatedAt, prev?.ts ?? prev?.tracking?.ts);

  const prevCoords = prev?.liveTrackingMap?.coordinates;
  const incCoords = incoming?.liveTrackingMap?.coordinates;
  const mergedCoords =
    Array.isArray(incCoords) && incCoords.length > 0
      ? incCoords
      : Array.isArray(prevCoords) && prevCoords.length > 0
        ? prevCoords
        : incCoords || prevCoords || [];

  let mergedLocation = null;
  let locationUnavailable = true;
  if (incFresh) {
    mergedLocation = [Number(incLoc[0]), Number(incLoc[1])];
    locationUnavailable = false;
  } else if (prevFresh && Array.isArray(prevLoc)) {
    mergedLocation = [Number(prevLoc[0]), Number(prevLoc[1])];
    locationUnavailable = false;
  } else if (hasIncLoc) {
    mergedLocation = [Number(incLoc[0]), Number(incLoc[1])];
    locationUnavailable = false;
  } else if (Array.isArray(prevLoc) && prevLoc.length >= 2) {
    mergedLocation = [Number(prevLoc[0]), Number(prevLoc[1])];
    locationUnavailable = false;
  } else {
    mergedLocation = prev?.tracking?.currentLocation ?? null;
    locationUnavailable = prev?.tracking?.locationUnavailable ?? true;
  }

  const merged = {
    loadId: incoming.loadId ?? prev?.loadId,
    refKey: incoming.refKey ?? prev?.refKey,
    origin: incoming.origin ?? prev?.origin,
    destination: incoming.destination ?? prev?.destination,
    lifecycleStage: incoming.lifecycleStage ?? prev?.lifecycleStage,
    ts: Math.max(trackingTimestamp(prev), trackingTimestamp(incoming)) || incoming.ts || prev?.ts,
    tracking: {
      ...(prev?.tracking || {}),
      ...(incoming.tracking || {}),
      currentLocation: mergedLocation,
      location: mergedLocation,
      locationUnavailable,
      locationUpdatedAt: incFresh
        ? incoming?.tracking?.locationUpdatedAt ?? prev?.tracking?.locationUpdatedAt ?? null
        : prevFresh
          ? prev?.tracking?.locationUpdatedAt ?? incoming?.tracking?.locationUpdatedAt ?? null
          : incoming?.tracking?.locationUpdatedAt ?? prev?.tracking?.locationUpdatedAt ?? null
    },
    history:
      Array.isArray(incoming.history) && incoming.history.length > 0
        ? mergeTrackingHistory(prev?.history, incoming.history)
        : prev?.history || [],
    liveTrackingMap: {
      ...(prev?.liveTrackingMap || {}),
      ...(incoming.liveTrackingMap || {}),
      coordinates: mergedCoords
    }
  };
  return normalizeTracking(merged);
}
