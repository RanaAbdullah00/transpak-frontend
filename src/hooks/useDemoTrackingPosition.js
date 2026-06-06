import { useEffect, useState } from 'react';
import { resolveDemoDriverPosition, shouldUseDemoTracking } from '../utils/demoTrackingFallback.js';

/**
 * Animates a demo driver marker along the route when GPS is unavailable.
 * Disabled automatically when real driver coordinates are present.
 */
export function useDemoTrackingPosition({
  enabled = false,
  refKey = '',
  routeCoords = [],
  status = 'booked',
  hasLiveDriver = false
} = {}) {
  const [position, setPosition] = useState(null);

  useEffect(() => {
    const useDemo = shouldUseDemoTracking({
      trackingActive: enabled,
      hasLiveDriver,
      routeCoords
    });
    if (!useDemo) {
      setPosition(null);
      return undefined;
    }

    const tick = () => {
      try {
        setPosition(
          resolveDemoDriverPosition({
            refKey,
            routeCoords: Array.isArray(routeCoords) ? routeCoords : [],
            status,
            animate: true
          })
        );
      } catch {
        setPosition(null);
      }
    };

    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, [enabled, refKey, status, hasLiveDriver, routeCoords]);

  return position;
}
