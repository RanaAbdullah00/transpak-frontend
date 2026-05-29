/** Shared helpers for dual-role (shipper ↔ carrier) account switching. */

import { getUserRolesFromSession } from './authSession.js';

export function getUserRoles(user) {
  return getUserRolesFromSession(user);
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

/** Commercial shipper ↔ carrier only (never crosses accounts). */
export function resolveWorkspaceSwitchTarget(user) {
  if (!user) return null;
  const roles = getUserRoles(user);
  if (roles.includes('admin') && user.activeRole === 'admin') return null;
  return resolveCommercialSwitchTarget(user);
}

/** Show "Add role" when account has one commercial role; "Switch" when both. */
export function resolveNavRoleAction(user) {
  if (!user) return { mode: 'none' };
  const roles = getUserRoles(user).filter((r) => r === 'shipper' || r === 'carrier');
  if (roles.includes('admin') && !roles.includes('shipper') && !roles.includes('carrier')) {
    return { mode: 'none' };
  }
  if (roles.includes('admin') && user.activeRole === 'admin') return { mode: 'none' };
  const hasBoth = roles.includes('shipper') && roles.includes('carrier');
  if (hasBoth) {
    const target = resolveCommercialSwitchTarget(user);
    return target ? { mode: 'switch', target } : { mode: 'none' };
  }
  if (roles.length === 1) {
    const missing = roles.includes('shipper') ? 'carrier' : 'shipper';
    return { mode: 'add', target: missing };
  }
  return { mode: 'none' };
}
