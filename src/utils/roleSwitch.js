/** Shared helpers for dual-role (shipper ↔ carrier) account switching. */

export function getUserRoles(user) {
  if (!user) return [];
  return Array.isArray(user.roles) && user.roles.length
    ? user.roles
    : [user.activeRole].filter(Boolean);
}

/** Next commercial role when user has both shipper and carrier. */
export function resolveCommercialSwitchTarget(user) {
  const roles = getUserRoles(user);
  if (!roles.includes('shipper') || !roles.includes('carrier')) return null;

  const active = user?.activeRole;
  let current =
    active === 'shipper' || active === 'carrier'
      ? active
      : roles.includes('shipper')
        ? 'shipper'
        : 'carrier';

  const target = current === 'shipper' ? 'carrier' : 'shipper';
  return roles.includes(target) ? target : null;
}

export function emitRoleSwitchComplete(role) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('tp:role-switched', { detail: { role } }));
  window.dispatchEvent(new CustomEvent('tp:realtime-refresh', { detail: { scope: 'all' } }));
}

/** Next workspace role: admin ↔ commercial (shipper/carrier). */
export function resolveWorkspaceSwitchTarget(user) {
  if (!user) return null;
  const roles = getUserRoles(user);
  const active = user.activeRole ?? roles[0];

  if (active === 'admin') {
    if (roles.includes('shipper')) return 'shipper';
    if (roles.includes('carrier')) return 'carrier';
    return null;
  }

  if (roles.includes('admin')) return 'admin';

  return resolveCommercialSwitchTarget(user);
}
