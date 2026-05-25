/** Client session helpers — backend `user.activeRole` is authoritative. */

const QUICK_DEMO_EMAIL = 'mrrajpoot.327@gmail.com';

export function isDemoAdminEmail(email) {
  const norm = String(email || '')
    .trim()
    .toLowerCase();
  const fromEnv = String(import.meta.env.VITE_DEMO_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  if (fromEnv && norm === fromEnv) return true;
  return norm === QUICK_DEMO_EMAIL;
}

/** Prefer API user.activeRole over wrapper currentRole (avoids stale cache). */
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

/** Align session aliases with backend `user.activeRole` (no client-side role override). */
export function applyDemoAdminSession(session, email) {
  if (!session || !isDemoAdminEmail(email)) return session;
  const user = session.user;
  if (!user || typeof user !== 'object') return session;
  const activeRole = resolveActiveRole(user, session) || user.activeRole || 'admin';
  return {
    ...session,
    currentRole: activeRole,
    user: { ...user, activeRole }
  };
}

export function clearAuthStorage() {
  localStorage.removeItem('transpak_token');
  localStorage.removeItem('transpak_user');
  localStorage.removeItem('transpak_active_role');
}

export function mergeAuthUser(apiData) {
  if (!apiData || typeof apiData !== 'object') return null;
  const user = apiData.user || apiData;
  if (!user || typeof user !== 'object') return null;

  const activeRole = resolveActiveRole(user, apiData);
  const id = user.id || (user._id != null ? String(user._id) : null);
  const roles =
    Array.isArray(user.roles) && user.roles.length
      ? user.roles
      : [activeRole].filter(Boolean);

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
