/** Client session helpers — API profile is authoritative for roles + active workspace. */

import { clearAuthToken, getAuthToken, setAuthToken } from './authTokenStorage.js';
import { persistWorkspaceContext, clearWorkspaceContext } from './workspaceContext.js';

export function isDemoAdminEmail(email) {
  const norm = String(email || '')
    .trim()
    .toLowerCase();
  const fromEnv = String(import.meta.env.VITE_DEMO_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  return Boolean(fromEnv && norm === fromEnv);
}

export function resolveActiveRole(user, apiData = {}) {
  const fromUser =
    user?.activeRole != null && String(user.activeRole).trim()
      ? String(user.activeRole).trim().toLowerCase()
      : '';
  if (fromUser) return fromUser;
  const fromApi =
    apiData?.currentRole != null && String(apiData.currentRole).trim()
      ? String(apiData.currentRole).trim().toLowerCase()
      : '';
  return fromApi || null;
}

export function getUserRolesFromSession(user) {
  if (!user) return [];
  return Array.isArray(user.roles) && user.roles.length
    ? user.roles.map((r) => String(r).trim().toLowerCase()).filter(Boolean)
    : [];
}

/** Admin routes/API UI — account must include admin in roles[] (not activeRole). */
export function canAccessAdminRoutes(user) {
  if (!user) return false;
  return getUserRolesFromSession(user).includes('admin');
}

export function hasCommercialRole(user) {
  const roles = getUserRolesFromSession(user);
  return roles.includes('shipper') || roles.includes('carrier');
}

export function applyDemoAdminSession(session, email) {
  if (!session || !isDemoAdminEmail(email)) return session;
  return session;
}

export function clearAuthStorage() {
  clearAuthToken();
  clearWorkspaceContext();
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('transpak_session_owner');
    localStorage.removeItem('transpak_user');
    localStorage.removeItem('transpak_active_role');
  }
}

export function mergeAuthUser(apiData) {
  if (!apiData || typeof apiData !== 'object') return null;
  const user = apiData.user || apiData;
  if (!user || typeof user !== 'object') return null;

  const activeRole = resolveActiveRole(user, apiData);
  const id = user.id || (user._id != null ? String(user._id) : null);

  let roles = Array.isArray(user.roles)
    ? user.roles.map((r) => String(r).trim().toLowerCase()).filter(Boolean)
    : [];

  if (!roles.length && Array.isArray(apiData.roles) && apiData.roles.length) {
    roles = apiData.roles.map((r) => String(r).trim().toLowerCase()).filter(Boolean);
  }

  if (!roles.length && activeRole) {
    roles = [activeRole];
  }

  if (roles.includes('admin') && activeRole && !roles.includes(activeRole)) {
    roles = [...new Set([...roles, activeRole])];
  }

  const next = {
    ...user,
    id,
    roles,
    activeRole,
    profileImage: user.profileImage || user.profile_image || '',
    fullName: user.fullName || user.full_name || '',
    profileComplete: Boolean(
      user.profileComplete ?? user.isProfileComplete ?? user.is_profile_complete
    ),
    verified: Boolean(user.verified)
  };
  next.name = next.fullName || user.name || user.email || 'User';
  delete next.role;
  const hasShipper = roles.includes('shipper');
  const hasCarrier = roles.includes('carrier');
  next.hasShipper = Boolean(apiData.roles?.hasShipper ?? hasShipper);
  next.hasCarrier = Boolean(apiData.roles?.hasCarrier ?? hasCarrier);
  return next;
}

/**
 * Apply auth API payload (login, profile, role switch, profile update) to session storage.
 * @returns {{ token: string|null, user: object|null }}
 */
export function applyAuthSessionFromApi(apiData) {
  if (!apiData || typeof apiData !== 'object') return { token: null, user: null };
  const normalized = mergeAuthUser(apiData);
  const token = apiData.token || null;
  if (token) setAuthToken(token);
  if (normalized && typeof window !== 'undefined') {
    sessionStorage.setItem('transpak_session_owner', String(normalized.id || ''));
    persistWorkspaceContext(normalized);
  }
  return { token, user: normalized };
}

export { getAuthToken, setAuthToken, clearAuthToken };
