/**
 * Client UI helpers — server enforces permissions from DB roles[].
 * Contract: transpak-backend/docs/RBAC.md
 * - roles[] = route access
 * - activeRole = UI workspace only (see workspaceApi.js for ?viewAs= on list APIs)
 */



import { canAccessAdminRoutes, getUserRolesFromSession } from './authSession.js';



export function getUserRoles(user) {

  return getUserRolesFromSession(user);

}



export function hasAdminRole(user) {

  return getUserRoles(user).includes('admin');

}



/** Admin workspace shell when active_role is admin (commercial UI). */

export function isAdminSession(user) {

  return user?.activeRole === 'admin';

}



export function isCommercialSession(user) {

  const role = user?.activeRole;

  return role === 'shipper' || role === 'carrier';

}



export function shouldUseAdminShell(user) {

  return isAdminSession(user);

}



/** Admin layout on /admin/* even when workspace is shipper/carrier. */

export function isAdminRoutePath(pathname) {

  return String(pathname || '').startsWith('/admin');

}



export function resolveAdminShell(user, pathname) {

  if (!user) return false;

  if (isAdminRoutePath(pathname) && canAccessAdminRoutes(user)) return true;

  return shouldUseAdminShell(user);

}



export { canAccessAdminRoutes };

