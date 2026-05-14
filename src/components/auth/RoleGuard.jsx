import React from 'react';
import { useAuth } from '../../hooks/useAuth.js';

/**
 * Renders children only when activeRole is in `roles`. Otherwise renders `fallback` (default null).
 */
const RoleGuard = ({ roles, children, fallback = null }) => {
  const { user } = useAuth();
  const active = user?.activeRole ?? user?.roles?.[0];
  if (!Array.isArray(roles) || roles.length === 0) return children;
  if (roles.includes(active)) return children;
  return fallback;
};

export default RoleGuard;
