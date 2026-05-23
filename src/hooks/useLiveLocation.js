import { useEffect, useState } from 'react';
import { toLatLngPair } from '../utils/mapCoords.js';

/**
 * Browser geolocation watch for live driver position.
 * @param {boolean} enabled
 */
export function useLiveLocation(enabled = false) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setPosition(null);
      setError(null);
      return undefined;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation not supported');
      return undefined;
    }

    let watchId = null;
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const pair = toLatLngPair([pos.coords.latitude, pos.coords.longitude]);
        if (pair) {
          setPosition(pair);
          setError(null);
        }
      },
      (err) => setError(err?.message || 'Location unavailable'),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );

    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled]);

  return { position, error };
}
