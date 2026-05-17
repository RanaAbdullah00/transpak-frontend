import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isActiveRoute } from '../../config/activeRoutes.js';

/** Warn when navigating to a route outside the canonical map (dev aid). */
const RouteVerifier = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!isActiveRoute(pathname)) {
      // eslint-disable-next-line no-console
      console.warn('[TransPak routes] Path is not in ACTIVE_ROUTE_MAP:', pathname);
    }
  }, [pathname]);

  return null;
};

export default RouteVerifier;
