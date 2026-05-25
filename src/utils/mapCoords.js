import { PAKISTAN_CITIES, resolveCityName } from '../data/pakistanCities.js';

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
  return list.map(toLatLngPair).filter(Boolean);
}

export function findCityCoords(name) {
  const canonical = resolveCityName(name);
  if (!canonical) return null;
  const n = canonical.toLowerCase();
  const hit = PAKISTAN_CITIES.find((c) => c.name.toLowerCase() === n);
  return hit ? [hit.lat, hit.lng] : null;
}

export function routeFromCityNames(origin, destination) {
  const coords = [];
  const o = findCityCoords(origin);
  const d = findCityCoords(destination);
  if (o) coords.push(o);
  if (d && (!o || o[0] !== d[0] || o[1] !== d[1])) coords.push(d);
  return coords;
}
