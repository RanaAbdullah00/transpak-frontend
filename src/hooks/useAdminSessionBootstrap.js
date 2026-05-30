import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.js';
import { canAccessAdminRoutes } from '../utils/authSession.js';
import { patchActiveRoleApi, fetchProfileApi } from '../services/authService.js';
import { safeUnwrapAuthResponse } from '../utils/authApiSafe.js';
import { applyAuthSessionFromApi } from '../utils/authSession.js';

/**
 * When an admin account opens /admin/*, sync workspace to admin via API (not UI role switch).
 */
export function useAdminSessionBootstrap() {
  const { user, login } = useAuth();
  const location = useLocation();
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    bootstrappedRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !canAccessAdminRoutes(user)) return;
    if (!location.pathname.startsWith('/admin')) return;
    if (user.activeRole === 'admin') return;
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    (async () => {
      try {
        const res = await patchActiveRoleApi('admin');
        const data = safeUnwrapAuthResponse(res);
        if (data?.user) {
          applyAuthSessionFromApi(data);
          login(data, { clearPrevious: false });
          return;
        }
        const prof = await fetchProfileApi();
        const fresh = safeUnwrapAuthResponse(prof);
        if (fresh?.user) {
          applyAuthSessionFromApi(fresh);
          login(fresh, { clearPrevious: false });
        }
      } catch {
        bootstrappedRef.current = false;
      }
    })();
  }, [user?.id, user?.activeRole, location.pathname, login]);
}
