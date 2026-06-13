import { useEffect, useRef, useState } from 'react';
import { toLatLngPair } from '../utils/mapCoords.js';

const MIN_MOVE_DEG = 0.00005;
const GPS_FALLBACK_MS = 2000;

function movedEnough(prev, next) {
  if (!prev || !next) return true;
  return (
    Math.abs(prev[0] - next[0]) > MIN_MOVE_DEG || Math.abs(prev[1] - next[1]) > MIN_MOVE_DEG
  );
}

/**
 * Browser geolocation watch for live driver position.
 * Falls back to lastKnownCoords after timeoutMs when GPS is unavailable.
 * @param {boolean} enabled
 * @param {{ fallbackCoords?: [number,number]|null, timeoutMs?: number }} [opts]
 */
export function useLiveLocation(enabled = false, opts = {}) {
  const { fallbackCoords = null, timeoutMs = GPS_FALLBACK_MS } = opts;
  const [position, setPosition] = useState(() =>
    enabled && fallbackCoords ? toLatLngPair(fallbackCoords) : null
  );
  const [error, setError] = useState(null);
  const [gpsTimedOut, setGpsTimedOut] = useState(false);
  const lastPairRef = useRef(null);
  const gotGpsRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setPosition(null);
      setError(null);
      setGpsTimedOut(false);
      lastPairRef.current = null;
      gotGpsRef.current = false;
      return undefined;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation not supported');
      const fallback = toLatLngPair(fallbackCoords);
      if (fallback) setPosition(fallback);
      return undefined;
    }

    gotGpsRef.current = false;
    setGpsTimedOut(false);
    const fallback = toLatLngPair(fallbackCoords);
    if (fallback) {
      lastPairRef.current = fallback;
      setPosition(fallback);
    }

    const fallbackTimer = window.setTimeout(() => {
      if (gotGpsRef.current) return;
      setGpsTimedOut(true);
      const fb = toLatLngPair(fallbackCoords);
      if (fb) {
        lastPairRef.current = fb;
        setPosition(fb);
      }
    }, timeoutMs);

    let watchId = null;
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const pair = toLatLngPair([pos.coords.latitude, pos.coords.longitude]);
        if (pair && movedEnough(lastPairRef.current, pair)) {
          gotGpsRef.current = true;
          lastPairRef.current = pair;
          setPosition(pair);
          setError(null);
          setGpsTimedOut(false);
        }
      },
      (err) => {
        setError(err?.message || 'Location unavailable');
        if (!gotGpsRef.current) {
          const fb = toLatLngPair(fallbackCoords);
          if (fb) {
            lastPairRef.current = fb;
            setPosition(fb);
          }
        }
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }
    );

    return () => {
      window.clearTimeout(fallbackTimer);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      lastPairRef.current = null;
      gotGpsRef.current = false;
    };
  }, [enabled, fallbackCoords, timeoutMs]);

  return { position, error, gpsTimedOut };
}
