/**
 * Resolve in-app navigation target from unified notification shape.
 */
export function resolveNotificationPath(notification, { activeRole } = {}) {
  const title = String(notification?.title || notification?.type || '')
    .trim()
    .toUpperCase();
  const role = String(notification?.roleType || activeRole || '').toLowerCase();
  const ref = String(
    notification?.shipmentRef || notification?.ref || notification?.refKey || ''
  ).trim();
  const kind = String(notification?.kind || '').toUpperCase();

  if (kind === 'SUGGEST' || kind === 'REJECT') {
    if (role === 'shipper') return '/bids/manage';
    if (role === 'carrier') return '/bids/mine';
    return '/bids/manage';
  }

  if (
    title.includes('COUNTER') ||
    title.includes('CONFIRMATION') ||
    title.includes('BID_CREATED') ||
    title.includes('BID_RECEIVED') ||
    title.includes('BID_REJECTED')
  ) {
    if (role === 'shipper') return '/bids/manage';
    if (role === 'carrier') return '/bids/mine';
    return '/bids/manage';
  }

  if (
    kind === 'CONTRACT' ||
    title.includes('CONTRACT_STARTED') ||
    title.includes('BID_ACCEPTED') ||
    title.includes('SPACE_ACCEPTED') ||
    title.includes('CAPACITY_ACCEPTED')
  ) {
    if (ref) return `/shipments/tracking/${encodeURIComponent(ref)}`;
    if (role === 'carrier') return '/dashboard/carrier';
    if (role === 'shipper') return '/dashboard/shipper';
    return '/loads/manage';
  }

  if (kind === 'STATUS_UPDATE') {
    if (ref) return `/shipments/tracking/${encodeURIComponent(ref)}`;
    return role === 'carrier' ? '/dashboard/carrier' : '/dashboard/shipper';
  }

  if (title.includes('BID')) {
    if (role === 'shipper') return '/bids/manage';
    if (role === 'carrier') return '/bids/mine';
    return '/bids/manage';
  }

  if (title.includes('LOAD')) {
    if (role === 'carrier') return '/loads';
    return '/loads/manage';
  }

  if (title.includes('SPACE') || title.includes('CAPACITY')) {
    if (role === 'carrier') return '/loads/manage?tab=marketplace&sub=capacity';
    if (role === 'shipper') return '/loads/manage?tab=market';
    return '/loads/manage';
  }

  if (
    ref &&
    (title.includes('SHIPMENT') ||
      title.includes('TRACK') ||
      title.includes('DELIVERY') ||
      title.includes('PICKED') ||
      title.includes('TRANSIT'))
  ) {
    return `/shipments/tracking/${encodeURIComponent(ref)}`;
  }

  if (title.includes('TRUCK') || title.includes('FLEET')) {
    if (role === 'admin') return '/admin/fleet';
    return '/carrier/truck-details';
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
