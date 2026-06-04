/** Coordinate jitter filter + light EMA smoothing per shipment ref. */

const smoothByRef = new Map();

const MIN_MOVE_M = Number(import.meta.env.VITE_TRACKING_MIN_MOVE_M || 7);
const EMA_ALPHA = Number(import.meta.env.VITE_TRACKING_EMA_ALPHA || 0.35);

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function distanceMeters(a, b) {
  const lat1 = Number(a?.lat ?? a?.[0]);
  const lng1 = Number(a?.lng ?? a?.[1]);
  const lat2 = Number(b?.lat ?? b?.[0]);
  const lng2 = Number(b?.lng ?? b?.[1]);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function refKey(ref) {
  return String(ref || '').trim();
}

/**
 * @param {string} shipmentRef
 * @param {[number, number]} coords
 * @returns {[number, number]|null} smoothed coords, or null if below movement threshold
 */
export function smoothTrackingCoordinates(shipmentRef, coords) {
  const key = refKey(shipmentRef);
  const lat = Number(coords?.[0]);
  const lng = Number(coords?.[1]);
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const prev = smoothByRef.get(key);
  if (!prev) {
    smoothByRef.set(key, { lat, lng });
    return [lat, lng];
  }

  const dist = distanceMeters(prev, { lat, lng });
  if (dist < MIN_MOVE_M) return null;

  const outLat = prev.lat + EMA_ALPHA * (lat - prev.lat);
  const outLng = prev.lng + EMA_ALPHA * (lng - prev.lng);
  smoothByRef.set(key, { lat: outLat, lng: outLng });
  return [outLat, outLng];
}

export function resetTrackingSmoothing(shipmentRef) {
  const key = refKey(shipmentRef);
  if (key) smoothByRef.delete(key);
}

export function clearAllTrackingSmoothing() {
  smoothByRef.clear();
}
