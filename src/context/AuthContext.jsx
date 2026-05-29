import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchProfileApi, patchActiveRoleApi } from '../services/authService.js';
import { safeUnwrapAuthResponse } from '../utils/authApiSafe.js';
import { emitRoleSwitchComplete, getUserRoles } from '../utils/roleSwitch.js';
import {
  applyAuthSessionFromApi,
  canAccessAdminRoutes,
  clearAuthStorage,
  mergeAuthUser,
  setAuthToken
} from '../utils/authSession.js';
import { refreshAuthSessionFromServer } from '../utils/authRefresh.js';
import { clearEntireSession, prepareWorkspaceSwitch } from '../utils/sessionCleanup.js';
import { getAuthToken } from '../utils/authTokenStorage.js';
import { isAdminRoutePath } from '../utils/rbac.js';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleSwitching, setRoleSwitching] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const userRef = useRef(null);
  const switchLockRef = useRef(false);

  userRef.current = user;

  const logout = useCallback(() => {
    const uid = userRef.current?.id;
    clearEntireSession({ userId: uid });
    setUser(null);
    setSessionVersion((v) => v + 1);
  }, []);

  const login = useCallback((apiData, { clearPrevious = true } = {}) => {
    if (clearPrevious) {
      clearEntireSession({ userId: userRef.current?.id });
    }
    const { user: normalized } = applyAuthSessionFromApi(apiData);
    if (!normalized) return;
    setUser(normalized);
    setSessionVersion((v) => v + 1);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tp:session-established', { detail: { userId: normalized.id } }));
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const result = await refreshAuthSessionFromServer();
    if (result?.user) {
      setUser(result.user);
      setSessionVersion((v) => v + 1);
    }
    return result;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = getAuthToken();

    if (!token) {
      clearAuthStorage();
      setUser(null);
      setLoading(false);
      return undefined;
    }

    (async () => {
      try {
        const res = await fetchProfileApi();
        const data = safeUnwrapAuthResponse(res);
        if (!cancelled && data?.user) {
          const owner = sessionStorage.getItem('transpak_session_owner');
          const nextId = String(data.user.id || '');
          if (owner && nextId && owner !== nextId) {
            logout();
            return;
          }
          login({ ...data, token: data.token || token || undefined });

          if (
            canAccessAdminRoutes(mergeAuthUser(data)) &&
            isAdminRoutePath(location.pathname) &&
            data.user.activeRole !== 'admin'
          ) {
            try {
              await patchActiveRoleApi('admin');
              const again = await fetchProfileApi();
              const refreshed = safeUnwrapAuthResponse(again);
              if (!cancelled && refreshed?.user) {
                login({ ...refreshed, token: refreshed.token || token });
              }
            } catch {
              /* admin bootstrap optional */
            }
          }
        } else if (!cancelled) {
          logout();
        }
      } catch (err) {
        const status = err?.response?.status;
        if (!cancelled) {
          if (status === 401) {
            logout();
          } else {
            clearEntireSession();
            setUser(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [login, logout, location.pathname]);

  useEffect(() => {
    const onTokenChanged = () => {
      const token = getAuthToken();
      if (!token) {
        logout();
        return;
      }
      refreshSession().catch(() => logout());
    };
    const onStorage = (e) => {
      if (e.key === 'transpak_token' && e.storageArea === sessionStorage) {
        onTokenChanged();
      }
    };
    window.addEventListener('tp:auth-token-changed', onTokenChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('tp:auth-token-changed', onTokenChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [logout, refreshSession]);

  const setActiveRole = useCallback(async (role) => {
    const current = userRef.current;
    if (!current) throw new Error('Not authenticated');
    if (switchLockRef.current) return;

    const nextRole = String(role || '').trim().toLowerCase();
    if (!nextRole) throw new Error('Invalid role');

    const roles = getUserRoles(current);
    if (!roles.includes(nextRole)) throw new Error('Role not available for this account');
    if (current.activeRole === nextRole) return;

    switchLockRef.current = true;
    setRoleSwitching(true);
    const commercial = (r) => r === 'shipper' || r === 'carrier';
    const abortInflight =
      commercial(current.activeRole) && commercial(nextRole) && current.activeRole !== nextRole;
    prepareWorkspaceSwitch(current.id, { abortInflight });
    try {
      const res = await patchActiveRoleApi(nextRole);
      const data = safeUnwrapAuthResponse(res);
      if (!data?.token) throw new Error('Role switch failed — no session token');
      setAuthToken(data.token);

      let session = data;
      try {
        const profRes = await fetchProfileApi();
        const prof = safeUnwrapAuthResponse(profRes);
        if (prof?.user) {
          session = { ...prof, token: data.token };
        }
      } catch (profErr) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[auth] profile after role switch failed', profErr?.message || profErr);
        }
      }

      login(session, { clearPrevious: false });
      emitRoleSwitchComplete(nextRole);
    } finally {
      switchLockRef.current = false;
      setRoleSwitching(false);
    }
  }, [login]);

  useEffect(() => {
    const onUnauthorized = async () => {
      try {
        await refreshSession();
      } catch {
        logout();
      }
    };
    const onRefreshed = (e) => {
      const next = e?.detail?.user;
      if (next) setUser(next);
    };
    window.addEventListener('tp:auth-unauthorized', onUnauthorized);
    window.addEventListener('tp:auth-refreshed', onRefreshed);
    return () => {
      window.removeEventListener('tp:auth-unauthorized', onUnauthorized);
      window.removeEventListener('tp:auth-refreshed', onRefreshed);
    };
  }, [refreshSession, logout]);

  useEffect(() => {
    const role = user?.activeRole || '';
    if (role) document.body.dataset.role = role;
    else delete document.body.dataset.role;
    document.body.classList.remove('tp-role-shipper', 'tp-role-carrier', 'tp-role-admin');
    if (role === 'shipper') document.body.classList.add('tp-role-shipper');
    else if (role === 'carrier') document.body.classList.add('tp-role-carrier');
    else if (role === 'admin') document.body.classList.add('tp-role-admin');
  }, [user?.activeRole]);

  const value = {
    user,
    loading,
    roleSwitching,
    sessionVersion,
    login,
    refreshSession,
    setActiveRole,
    logout
  };

  if (loading) {
    return <AuthContext.Provider value={value}>{null}</AuthContext.Provider>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
