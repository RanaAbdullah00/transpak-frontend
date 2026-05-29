import React, { useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';
import { canAccessAdminRoutes } from '../../utils/authSession.js';

/** Admin and single-role users bypass selection; role switching is disabled platform-wide. */
const RoleSelection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const roles = useMemo(() => {
    if (!user) return [];
    return Array.isArray(user.roles) && user.roles.length
      ? user.roles
      : [user.activeRole].filter(Boolean);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (roles.length === 0) {
      navigate('/register', {
        replace: true,
        state: {
          prefill: {
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || '',
            cnic: user.cnic || ''
          }
        }
      });
      return;
    }
    if (canAccessAdminRoutes(user)) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }
    const commercial = roles.filter((r) => r === 'shipper' || r === 'carrier');
    const ar =
      user.activeRole && commercial.includes(user.activeRole)
        ? user.activeRole
        : commercial[0] || roles[0];
    const from = location.state?.from;
    if (typeof from === 'string' && from.startsWith('/') && from !== '/role') {
      navigate(from, { replace: true });
      return;
    }
    if (ar) navigate(dashboardPathForRole(ar), { replace: true });
  }, [user, roles, navigate, location.state]);

  return null;
};

export default RoleSelection;
