import { PAKISTAN_CITIES, resolveCityName } from '../data/pakistanCities.js';

/** Crash-safe default when coordinate parsing fails (never used for map center). */
export const SAFE_COORD_OBJECT = Object.freeze({ lat: 0, lng: 0 });
export const SAFE_COORD_PAIR = Object.freeze([0, 0]);

export function safeStringField(v) {
  return v != null ? String(v).trim() : '';
}

export function safeCoordPairOrNull(v) {
  return toLatLngPair(v) ?? null;
}

/** Non-null pair for arithmetic-only fallbacks — prefer safeCoordPairOrNull for map UI. */
export function safeCoordPair(v) {
  return toLatLngPair(v) ?? [...SAFE_COORD_PAIR];
}

export function safeCoordObject(v) {
  const pair = toLatLngPair(v);
  return pair ? { lat: pair[0], lng: pair[1] } : { ...SAFE_COORD_OBJECT };
}

export function isLatLngPair(v) {
  if (Array.isArray(v) && v.length >= 2) {
    return Number.isFinite(Number(v[0])) && Number.isFinite(Number(v[1]));
  }
  if (v && typeof v === 'object' && v.lat != null && v.lng != null) {
    return Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng));
  }
  return false;
}

/** @returns {[number, number]|null} */
export function toLatLngPair(v) {
  if (!isLatLngPair(v)) return null;
  if (Array.isArray(v)) return [Number(v[0]), Number(v[1])];
  return [Number(v.lat), Number(v.lng)];
}

export function normalizeCoordList(list) {
  if (!Array.isArray(list)) return [];
  try {
    return list.map(toLatLngPair).filter(Boolean);
  } catch {
    return [];
  }
}

export function findCityCoords(name) {
  const canonical = resolveCityName(name);
  if (!canonical) return null;
  const n = canonical.toLowerCase();
  const hit = PAKISTAN_CITIES.find((c) => c.name.toLowerCase() === n);
  return hit ? [hit.lat, hit.lng] : null;
}

export function routeFromCityNames(origin, destination) {
  try {
    const coords = [];
    const o = findCityCoords(safeStringField(origin));
    const d = findCityCoords(safeStringField(destination));
    if (o) coords.push(o);
    if (d && (!o || o[0] !== d[0] || o[1] !== d[1])) coords.push(d);
    return coords;
  } catch {
    return [];
  }
}
