import { useEffect, useMemo, useState } from 'react';
import { useApi } from './useApi.js';
import { useDebouncedValue } from './useDebouncedValue.js';
import { estimateLocalFare } from '../utils/localFareEstimate.js';
import { isKnownCity, resolveCityName } from '../data/pakistanCities.js';

export function useFareEstimate({ origin, destination, vehicleType, enabled = true }) {
  const { request } = useApi();
  const debouncedOrigin = useDebouncedValue(origin, 400);
  const debouncedDest = useDebouncedValue(destination, 400);
  const [apiEstimate, setApiEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  const localEstimate = useMemo(() => {
    if (!enabled) return null;
    const o = resolveCityName(debouncedOrigin);
    const d = resolveCityName(debouncedDest);
    if (!o || !d || !isKnownCity(o) || !isKnownCity(d)) return null;
    return estimateLocalFare(o, d, vehicleType);
  }, [debouncedOrigin, debouncedDest, vehicleType, enabled]);

  useEffect(() => {
    if (!enabled || !debouncedOrigin?.trim() || !debouncedDest?.trim()) {
      setApiEstimate(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await request({
          method: 'POST',
          url: '/fare/estimate',
          data: {
            origin: debouncedOrigin.trim(),
            destination: debouncedDest.trim(),
            vehicleType: vehicleType || 'Truck'
          }
        });
        if (!cancelled) setApiEstimate(data);
      } catch {
        if (!cancelled) setApiEstimate(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedOrigin, debouncedDest, vehicleType, enabled, request]);

  const estimate = apiEstimate ?? localEstimate;
  const usedLocalFallback = Boolean(!apiEstimate && localEstimate);

  return { estimate, loading: loading && !estimate, usedLocalFallback };
}
