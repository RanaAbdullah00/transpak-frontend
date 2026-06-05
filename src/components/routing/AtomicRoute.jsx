import React, { Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import ErrorBoundary from '../ui/ErrorBoundary.jsx';
import AdminErrorBoundary from '../admin/AdminErrorBoundary.jsx';
import LoadingScreen from '../ui/LoadingScreen.jsx';

/**
 * Per-route crash isolation — each route owns ErrorBoundary + Suspense.
 */
export default function AtomicRoute({ name, admin = false, children }) {
  const location = useLocation();
  const { user, sessionVersion } = useAuth();
  const pathname = location.pathname;
  const search = location.search;
  const userId = user?.id ?? 'guest';
  const activeRole = user?.activeRole ?? user?.roles?.[0] ?? 'none';
  const roleRemountKey = user?.id && user?.activeRole ? `${user.id}:${user.activeRole}` : 'guest';

  const resetKey = `${pathname}${search}`;
  const instanceKey = [
    name,
    pathname,
    search,
    userId,
    activeRole,
    String(sessionVersion ?? 0),
    roleRemountKey
  ].join('|');

  const suspenseKey = `${instanceKey}-suspense`;
  const Boundary = admin ? AdminErrorBoundary : ErrorBoundary;

  return (
    <Boundary key={instanceKey} resetKey={resetKey}>
      <Suspense fallback={<LoadingScreen />} key={suspenseKey}>
        {children}
      </Suspense>
    </Boundary>
  );
}
