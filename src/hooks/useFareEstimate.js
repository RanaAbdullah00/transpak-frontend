import { useEffect, useState } from 'react';
import { useApi } from './useApi.js';
import { useDebouncedValue } from './useDebouncedValue.js';

export function useFareEstimate({ origin, destination, vehicleType, enabled = true }) {
  const { request } = useApi();
  const debouncedOrigin = useDebouncedValue(origin, 400);
  const debouncedDest = useDebouncedValue(destination, 400);
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !debouncedOrigin?.trim() || !debouncedDest?.trim()) {
      setEstimate(null);
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
        if (!cancelled) setEstimate(data);
      } catch {
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedOrigin, debouncedDest, vehicleType, enabled, request]);

  return { estimate, loading };
}
