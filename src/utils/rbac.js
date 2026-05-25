/** Role-based access helpers (client-side guards; server remains authoritative). */

export function getUserRoles(user) {
  if (!user) return [];
  return Array.isArray(user.roles) && user.roles.length
    ? user.roles
    : [user.activeRole].filter(Boolean);
}

export function isAdminSession(user) {
  return user?.activeRole === 'admin';
}

export function isCommercialSession(user) {
  const role = user?.activeRole;
  return role === 'shipper' || role === 'carrier';
}

/** Platform admin moderation — no shipper/carrier commercial UI. */
export function shouldUseAdminShell(user) {
  return isAdminSession(user);
}
