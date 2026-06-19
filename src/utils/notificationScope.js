function normalizeRole(roleType) {
  if (roleType == null || String(roleType).trim() === '') return null;
  const r = String(roleType).toLowerCase().trim();
  if (r === 'shipper' || r === 'carrier' || r === 'admin') return r;
  return null;
}

export function userHasDualCommercialRoles(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.includes('shipper') && roles.includes('carrier');
}

export function notificationsForWorkspace(notifications, user) {
  if (!Array.isArray(notifications)) return [];
  if (!user?.id) return [];

  const roles = Array.isArray(user.roles) ? user.roles : [];
  const commercial = roles.filter((r) => r === 'shipper' || r === 'carrier');
  const active = String(user.activeRole || '').trim().toLowerCase();
  const adminOnly = roles.includes('admin') && commercial.length === 0;
  const workspace = active === 'shipper' || active === 'carrier' ? active : null;

  return notifications.filter((n) => {
    const rt = normalizeRole(n.roleType);
    if (!rt) return true;
    if (adminOnly || active === 'admin') return rt === 'admin';
    if (workspace) return rt === workspace || rt === 'admin';
    if (commercial.includes(rt)) return true;
    return false;
  });
}

export function notificationsForRelatedRole(notifications, user) {
  if (!Array.isArray(notifications) || !user?.id) return [];
  if (!userHasDualCommercialRoles(user)) return [];
  const active = String(user.activeRole || '').trim().toLowerCase();
  const other = active === 'shipper' ? 'carrier' : active === 'carrier' ? 'shipper' : null;
  if (!other) return [];
  return notifications.filter((n) => normalizeRole(n.roleType) === other);
}

/** @deprecated use notificationsForWorkspace */
export function notificationsForUser(notifications, user) {
  return notificationsForWorkspace(notifications, user);
}
