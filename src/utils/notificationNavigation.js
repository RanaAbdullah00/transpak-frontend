/**
 * Resolve in-app navigation target from notification title/type + role.
 */
export function resolveNotificationPath(notification, { activeRole } = {}) {
  const title = String(notification?.title || notification?.type || '')
    .trim()
    .toUpperCase();
  const role = String(notification?.roleType || activeRole || '').toLowerCase();

  if (title.includes('BID')) {
    if (role === 'shipper') return '/bids/manage';
    if (role === 'carrier') return '/bids/mine';
    return '/bids/manage';
  }
  if (title.includes('LOAD')) {
    if (role === 'carrier') return '/loads';
    return '/loads/manage';
  }
  if (
    title.includes('SPACE') ||
    title.includes('CAPACITY') ||
    title === 'CONTRACT_STARTED'
  ) {
    if (role === 'carrier') return '/loads/manage?tab=capacity';
    if (role === 'shipper') return '/loads/manage?tab=market';
    return '/loads/manage';
  }
  if (title.includes('SHIPMENT') || title.includes('TRACK') || title.includes('DELIVERY')) {
    return '/shipments/history';
  }
  if (title.includes('CONTRACT')) {
    return role === 'carrier' ? '/loads/manage?tab=capacity' : '/loads/manage?tab=market';
  }
  if (title.includes('TRUCK') || title.includes('FLEET')) {
    return '/truck-details';
  }
  if (title.includes('DISPUTE')) {
    return role === 'admin' ? '/admin/disputes' : '/shipments/history';
  }
  if (title.includes('VERIFY') || title.includes('PROFILE')) {
    return '/profile';
  }
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'carrier') return '/dashboard/carrier';
  if (role === 'shipper') return '/dashboard/shipper';
  return '/notifications';
}
