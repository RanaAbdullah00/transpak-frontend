import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from './useApi.js';
import { useAuth } from './useAuth.js';

/** Single operations snapshot + server-backed 24h activity feed for dashboards. */
export function useDashboardMetrics() {
  const { user } = useAuth();
  const { request } = useApi();
  const activeRole = user?.activeRole ?? user?.roles?.[0];
  const [ops, setOps] = useState(null);
  const [loadingOps, setLoadingOps] = useState(true);
  const [activities, setActivities] = useState([]);

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

  const refreshActivity = useCallback(async () => {
    if (!user?.id) {
      setActivities([]);
      return;
    }
    try {
      const rows = await request({
        url: '/operations/activity',
        params: { since: '24h', limit: 3 },
        skipGlobalErrorToast: true
      });
      const list = Array.isArray(rows) ? rows : [];
      setActivities(
        list.map((n) => ({
          id: n.id,
          message: n.message || n.title || '',
          time: n.createdAt ? new Date(n.createdAt).toLocaleString() : ''
        }))
      );
    } catch {
      setActivities([]);
    }
  }, [request, user?.id]);

  useEffect(() => {
    setOps(null);
    setLoadingOps(true);
    refreshOps();
    refreshActivity();
  }, [refreshOps, refreshActivity, activeRole]);

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
      refreshActivity();
    };
    const onStatusUpdated = () => {
      refreshOps();
      refreshActivity();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    window.addEventListener('tp:shipment-status-updated', onStatusUpdated);
    return () => {
      window.removeEventListener('tp:realtime-refresh', onRefresh);
      window.removeEventListener('tp:shipment-status-updated', onStatusUpdated);
    };
  }, [refreshOps, refreshActivity]);

  const activityRows = useMemo(() => activities, [activities]);

  return { ops, loadingOps, activities: activityRows, activeRole, refreshOps };
}
