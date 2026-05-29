import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.js';
import { canAccessAdminRoutes } from '../utils/authSession.js';

/**
 * When an admin account opens /admin/*, persist workspace as admin (no UI toggle).
 */
export function useAdminSessionBootstrap() {
  const { user, setActiveRole } = useAuth();
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
    setActiveRole('admin').catch(() => {
      bootstrappedRef.current = false;
    });
  }, [user?.id, user?.activeRole, location.pathname, setActiveRole]);
}
