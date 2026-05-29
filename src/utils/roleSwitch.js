/** Role switching disabled — workspace is fixed from DB at login. */

import { getUserRolesFromSession } from './authSession.js';

export function getUserRoles(user) {
  return getUserRolesFromSession(user);
}

export function resolveCommercialSwitchTarget() {
  return null;
}

export function emitRoleSwitchComplete(role) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('tp:role-switched', { detail: { role } }));
  window.dispatchEvent(new CustomEvent('tp:realtime-refresh', { detail: { scope: 'all' } }));
}

export function resolveWorkspaceSwitchTarget() {
  return null;
}

export function resolveNavRoleAction() {
  return { mode: 'none' };
}
