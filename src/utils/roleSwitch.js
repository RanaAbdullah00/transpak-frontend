/** Role switching — add second commercial role or switch between shipper/carrier. */

import { getUserRolesFromSession } from './authSession.js';

export function getUserRoles(user) {
  return getUserRolesFromSession(user);
}

const COMMERCIAL = ['shipper', 'carrier'];

function commercialRoles(user) {
  return getUserRoles(user).filter((r) => COMMERCIAL.includes(r));
}

export function resolveCommercialSwitchTarget(user) {
  const roles = commercialRoles(user);
  if (roles.length < 2) return null;
  const active = String(user?.activeRole || roles[0] || '')
    .trim()
    .toLowerCase();
  return roles.find((r) => r !== active) || null;
}

export function emitRoleSwitchComplete(role) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('tp:role-switched', { detail: { role } }));
  window.dispatchEvent(new CustomEvent('tp:realtime-refresh', { detail: { scope: 'all' } }));
}

export function resolveWorkspaceSwitchTarget(user) {
  return resolveCommercialSwitchTarget(user);
}

/** Navbar action: switch workspace or add missing commercial role (single commercial role only). */
export function resolveNavRoleAction(user) {
  if (!user) return { mode: 'none' };
  const commercial = commercialRoles(user);
  const allRoles = getUserRoles(user);
  if (allRoles.includes('admin') && !commercial.length) {
    return { mode: 'none' };
  }
  if (commercial.length >= 2) {
    const target = resolveCommercialSwitchTarget(user);
    return target ? { mode: 'switch', target } : { mode: 'none' };
  }
  const missing = COMMERCIAL.find((r) => !commercial.includes(r));
  if (missing && commercial.length < 2) {
    return { mode: 'add', target: missing };
  }
  return { mode: 'none' };
}
