import { useEffect, useState } from 'react';
import { fetchRouteByCities } from '../services/mapRoute.js';
import { normalizeCoordList, routeFromCityNames } from '../utils/mapCoords.js';
import { logApiFailure } from '../utils/apiDevLog.js';

/**
 * Load OSM/ORS route polyline for two Pakistan cities (authenticated API proxy).
 */
export function useMapRoute({ origin, destination, enabled = true }) {
  const [coordinates, setCoordinates] = useState([]);
  const [distanceKm, setDistanceKm] = useState(null);
  const [durationSeconds, setDurationSeconds] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    const o = String(origin || '').trim();
    const d = String(destination || '').trim();
    if (!enabled || !o || !d) {
      setCoordinates([]);
      setDistanceKm(null);
      setDurationSeconds(null);
      setError(null);
      setUsedFallback(false);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const straight = routeFromCityNames(o, d);

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRouteByCities({ origin: o, destination: d });
        if (cancelled) return;
      const coords = normalizeCoordList(data?.coordinates);
      setCoordinates(coords.length >= 2 ? coords : straight);
      setDistanceKm(data?.distanceKm != null ? Number(data.distanceKm) : null);
      setDurationSeconds(
        data?.durationSeconds != null ? Number(data.durationSeconds) : null
      );
      setUsedFallback(Boolean(data?.fallback) || data?.source === 'haversine');
        if (data?.fallback && import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.info('[map] ORS fallback route used', { origin: o, destination: d, source: data?.source });
        }
      } catch (err) {
        if (cancelled) return;
        logApiFailure(err, { method: 'GET', url: '/maps/route', data: { origin: o, destination: d } });
        const status = err?.response?.status;
        const code = err?.response?.data?.code || err?.response?.data?.error;
        if (status === 401 || status === 403 || code === 'ADMIN_COMMERCIAL_FORBIDDEN') {
          setCoordinates([]);
          setUsedFallback(false);
          setError(err);
          return;
        }
        setCoordinates(straight);
        setUsedFallback(true);
        setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [origin, destination, enabled]);

  return {
    coordinates,
    distanceKm,
    durationSeconds,
    loading,
    error,
    usedFallback
  };
}
