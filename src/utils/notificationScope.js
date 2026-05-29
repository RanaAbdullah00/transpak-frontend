/**
 * Client-side workspace filter — must match server notificationScopeClause.
 * Server always scopes by receiver_id; this prevents stale cross-workspace rows in memory.
 */

function normalizeRole(roleType) {
  if (roleType == null || String(roleType).trim() === '') return null;
  const r = String(roleType).toLowerCase().trim();
  if (r === 'shipper' || r === 'carrier' || r === 'admin') return r;
  return null;
}

export function notificationsForWorkspace(notifications, user) {
  if (!Array.isArray(notifications)) return [];
  if (!user?.id) return [];

  const roles = Array.isArray(user.roles) ? user.roles : [];
  const commercial = roles.filter((r) => r === 'shipper' || r === 'carrier');
  const active = String(user.activeRole || '').trim().toLowerCase();
  const adminOnly = roles.includes('admin') && commercial.length === 0;

  return notifications.filter((n) => {
    const rt = normalizeRole(n.roleType);
    if (!rt) return true;
    if (adminOnly || active === 'admin') return rt === 'admin';
    if (active === 'shipper') return rt === 'shipper';
    if (active === 'carrier') return rt === 'carrier';
    if (commercial.includes(rt)) return true;
    return false;
  });
}

/** @deprecated use notificationsForWorkspace */
export function notificationsForUser(notifications, user) {
  return notificationsForWorkspace(notifications, user);
}
