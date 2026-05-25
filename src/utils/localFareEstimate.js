import { PAKISTAN_CITIES, resolveCityName } from '../data/pakistanCities.js';

function findCity(name) {
  const canonical = resolveCityName(name);
  if (!canonical) return null;
  const n = canonical.toLowerCase();
  return PAKISTAN_CITIES.find((c) => c.name.toLowerCase() === n) || null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Client-side fare estimate when /fare/estimate is unavailable (mirrors backend defaults). */
export function estimateLocalFare(origin, destination, vehicleType = 'Truck') {
  const o = findCity(origin);
  const d = findCity(destination);
  if (!o || !d) return null;

  let km = haversineKm(o.lat, o.lng, d.lat, d.lng);
  km = Math.round(km * 100) / 100;
  if (km <= 0) km = 1;

  const mult =
    {
      truck: 1,
      trailer: 1.15,
      container: 1.25,
      mazda: 0.55,
      pickup: 0.45
    }[String(vehicleType || 'truck').toLowerCase()] || 1;

  const litersPerKm = 0.35;
  const dieselRate = 280;
  const marginPkR = 500;
  const marginPct = 10;
  const fuelCost = Math.round(km * litersPerKm * dieselRate * mult);
  const platformMargin = Math.round(marginPkR + (fuelCost * marginPct) / 100);
  const suggestedFare = Math.max(0, fuelCost + platformMargin);
  const avgKmh = 55;
  const estimatedTravelHours = Math.max(0.5, Math.round((km / avgKmh) * 10) / 10);
  const estimatedTravelMinutes = Math.round(estimatedTravelHours * 60);

  return {
    origin: o.name,
    destination: d.name,
    vehicleType: vehicleType || 'Truck',
    distanceKm: km,
    fuelCost,
    platformMargin,
    suggestedFare,
    minimumFare: suggestedFare,
    estimatedTravelHours,
    estimatedTravelMinutes,
    localFallback: true
  };
}
