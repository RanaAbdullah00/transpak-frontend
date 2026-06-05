import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import LoadingScreen from '../components/ui/LoadingScreen.jsx';
import { dashboardPathForRole } from '../utils/dashboardPath.js';
import { canAccessAdminRoutes, shouldUseAdminShell } from '../utils/rbac.js';

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const activeRole = user.activeRole ?? user.roles?.[0];
  if (!activeRole) return <Navigate to="/role" replace state={{ from: location.pathname }} />;

  if (
    shouldUseAdminShell(user) &&
    allowedRoles &&
    !allowedRoles.includes('admin') &&
    !canAccessAdminRoutes(user)
  ) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const path = location.pathname;
  const adminExtras = ['/profile', '/settings', '/support', '/feedback', '/about', '/contact'];
  const adminPathOk =
    path.startsWith('/admin') ||
    adminExtras.some((p) => path === p || path.startsWith(`${p}/`));
  if (shouldUseAdminShell(user) && !adminPathOk) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const accountRoles = Array.isArray(user.roles) ? user.roles : [];
  if (allowedRoles?.includes('admin') && !canAccessAdminRoutes(user)) {
    return <Navigate to={dashboardPathForRole(activeRole === 'admin' ? 'shipper' : activeRole)} replace />;
  }
  if (allowedRoles && !allowedRoles.some((r) => accountRoles.includes(r))) {
    const fallback =
      allowedRoles.includes('admin') && accountRoles.includes('admin')
        ? 'admin'
        : activeRole;
    return <Navigate to={dashboardPathForRole(fallback)} replace />;
  }

  return children;
}

export function RoleDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  const activeRole = user.activeRole ?? user.roles?.[0];
  if (!activeRole) return <Navigate to="/role" replace state={{ from: location.pathname }} />;
  return <Navigate to={dashboardPathForRole(activeRole)} replace />;
}
