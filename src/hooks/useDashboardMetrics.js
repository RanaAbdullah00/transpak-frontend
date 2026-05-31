import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { useApi } from './useApi.js';
import { useAuth } from './useAuth.js';

/** Single operations snapshot + recent notifications for dashboards. */
export function useDashboardMetrics() {
  const { user } = useAuth();
  const { request } = useApi();
  const app = useContext(AppContext);
  const activeRole = user?.activeRole ?? user?.roles?.[0];
  const [ops, setOps] = useState(null);
  const [loadingOps, setLoadingOps] = useState(true);

  const refreshOps = useCallback(async () => {
    try {
      const data = await request({ url: '/operations/snapshot', skipGlobalErrorToast: true });
      setOps(data || null);
    } catch {
      setOps(null);
    } finally {
      setLoadingOps(false);
    }
  }, [request]);

  useEffect(() => {
    setOps(null);
    setLoadingOps(true);
    refreshOps();
  }, [refreshOps, activeRole]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (
        scope &&
        scope !== 'all' &&
        scope !== 'loads' &&
        scope !== 'bids' &&
        scope !== 'shipments' &&
        scope !== 'space'
      ) {
        return;
      }
      refreshOps();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [refreshOps]);

  const activities = useMemo(() => {
    const rows = Array.isArray(app?.notifications) ? app.notifications : [];
    return rows.slice(0, 8).map((n) => ({
      id: n.id,
      message: n.message || n.title || '',
      time: n.createdAt ? new Date(n.createdAt).toLocaleString() : ''
    }));
  }, [app?.notifications]);

  return { ops, loadingOps, activities, activeRole, refreshOps };
}
