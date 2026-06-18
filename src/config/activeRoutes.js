/**
 * Canonical routes — warn in dev when navigation hits an unlisted path (typos / dead links).
 */
export const ACTIVE_ROUTE_MAP = new Set([
  '/',
  '/login',
  '/register',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/splash',
  '/about',
  '/contact',
  '/role',
  '/dashboard',
  '/dashboard/shipper',
  '/dashboard/carrier',
  '/dashboard/admin',
  '/admin/dashboard',
  '/admin/users',
  '/admin/roles',
  '/admin/loads',
  '/admin/fleet',
  '/admin/disputes',
  '/admin/bids',
  '/admin/notifications',
  '/admin/shipments',
  '/loads/post',
  '/loads/manage',
  '/loads',
  '/loads/accepted',
  '/carrier/space/post',
  '/carrier/truck-details',
  '/carrier/verification',
  '/bids',
  '/bids/mine',
  '/bids/place',
  '/fleet',
  '/fleet/add',
  '/shipments/active',
  '/shipments/tracking',
  '/shipments/history',
  '/profile',
  '/settings',
  '/support',
  '/feedback',
  '/notifications'
]);

/** Match dynamic segments like /loads/:id */
export function isActiveRoute(pathname) {
  if (ACTIVE_ROUTE_MAP.has(pathname)) return true;
  if (/^\/loads\/[^/]+$/.test(pathname)) return true;
  if (/^\/loads\/[^/]+\/edit$/.test(pathname)) return true;
  if (/^\/profile\/u\/[^/]+$/.test(pathname)) return true;
  if (/^\/shipments\/tracking(\/[^/]+)?$/.test(pathname)) return true;
  return false;
}
