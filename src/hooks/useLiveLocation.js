import { useEffect, useRef, useState } from 'react';
import { toLatLngPair } from '../utils/mapCoords.js';

const MIN_MOVE_DEG = 0.00005;

function movedEnough(prev, next) {
  if (!prev || !next) return true;
  return (
    Math.abs(prev[0] - next[0]) > MIN_MOVE_DEG || Math.abs(prev[1] - next[1]) > MIN_MOVE_DEG
  );
}

/**
 * Browser geolocation watch for live driver position.
 * @param {boolean} enabled
 */
export function useLiveLocation(enabled = false) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const lastPairRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setPosition(null);
      setError(null);
      lastPairRef.current = null;
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
        if (pair && movedEnough(lastPairRef.current, pair)) {
          lastPairRef.current = pair;
          setPosition(pair);
          setError(null);
        }
      },
      (err) => setError(err?.message || 'Location unavailable'),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );

    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      lastPairRef.current = null;
    };
  }, [enabled]);

  return { position, error };
}
