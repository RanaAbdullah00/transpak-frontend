import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';
import { unwrapBody } from '../utils/unwrapApi.js';

export const AuthContext = createContext(null);

function mergeSession(apiData) {
  const user = apiData.user || apiData;
  const id =
    user.id || (user._id != null ? String(user._id) : null);
  const currentRole = apiData.currentRole ?? user.activeRole;
  const roles =
    Array.isArray(user.roles) && user.roles.length
      ? user.roles
      : [user.activeRole].filter(Boolean);
  const next = {
    ...user,
    id,
    roles,
    activeRole: currentRole,
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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('transpak_user');
    localStorage.removeItem('transpak_token');
  }, []);

  const login = useCallback((apiData) => {
    const normalized = mergeSession(apiData);
    setUser(normalized);
    localStorage.setItem('transpak_user', JSON.stringify(normalized));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('transpak_token');
    const storedUser = localStorage.getItem('transpak_user');

    (async () => {
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          const { role: _legacyRole, ...rest } = parsed;
          const roles =
            Array.isArray(rest.roles) && rest.roles.length
              ? rest.roles
              : [rest.activeRole].filter(Boolean);
          const activeRole = rest.activeRole || roles?.[0] || null;
          const id = rest.id || (rest._id != null ? String(rest._id) : null);
          if (!cancelled) setUser({ ...rest, id, roles, activeRole });
        } catch {
          localStorage.removeItem('transpak_user');
        }
      }

      if (token) {
        try {
          const res = await api.get('/auth/profile');
          const data = unwrapBody(res.data);
          if (!cancelled && data?.user) login(data);
        } catch (e) {
          const code = e?.response?.data?.code;
          if (e?.response?.status === 403 && code === 'EMAIL_NOT_VERIFIED') {
            if (!cancelled) logout();
          }
        }
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [login, logout]);

  const setActiveRole = async (role) => {
    if (!user) throw new Error('Not authenticated');
    const nextRole = String(role || '').trim().toLowerCase();
    if (!nextRole) throw new Error('Invalid role');

    const prev = user;
    const optimistic = { ...user, activeRole: nextRole };
    setUser(optimistic);
    localStorage.setItem('transpak_user', JSON.stringify(optimistic));

    try {
      const res = await api.patch('/auth/active-role', { activeRole: nextRole });
      const data = unwrapBody(res.data);
      if (data.token) localStorage.setItem('transpak_token', data.token);
      login(data);
    } catch (err) {
      // Revert role if the backend update fails.
      setUser(prev);
      localStorage.setItem('transpak_user', JSON.stringify(prev));
      throw err;
    }
  };

  useEffect(() => {
    const role = user?.activeRole || '';
    if (role) document.body.dataset.role = role;
    else delete document.body.dataset.role;
  }, [user?.activeRole]);

  const value = {
    user,
    loading,
    login,
    setActiveRole,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
