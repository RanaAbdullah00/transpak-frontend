import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useDashboardMetrics } from '../../hooks/useDashboardMetrics.js';
import StatsCards from '../../components/dashboard/StatsCards.jsx';
import ActivityFeed from '../../components/dashboard/ActivityFeed.jsx';
import LoadList from '../../components/loadboard/LoadList.jsx';
import DashboardShipmentTabs from '../../components/dashboard/DashboardShipmentTabs.jsx';
import { normalizeLoads } from '../../adapters/normalize.js';
import ActiveRoleBadge from '../../components/profile/ActiveRoleBadge.jsx';
import Loader from '../../components/ui/Loader.jsx';
const ShipperDashboard = () => {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const activeRole = user?.activeRole ?? user?.roles?.[0];
  const profileComplete = user?.profileComplete === true;
  const { ops, loadingOps, activities, refreshOps } = useDashboardMetrics();
  const [mineLoads, setMineLoads] = useState([]);
  const [loadingLoads, setLoadingLoads] = useState(true);
  const { request } = useApi();

  const refreshLoads = useCallback(async () => {
    setLoadingLoads(true);
    try {
      const data = await request({ url: '/loads/mine', skipGlobalErrorToast: true });
      setMineLoads(normalizeLoads(Array.isArray(data) ? data : []));
    } catch {
      setMineLoads([]);
    } finally {
      setLoadingLoads(false);
    }
  }, [request]);

  const refreshBids = refreshOps;

  useEffect(() => {
    refreshLoads();
  }, [refreshLoads, user?.activeRole]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (!scope || scope === 'all' || scope === 'loads' || scope === 'shipments') {
        refreshLoads();
      }
      if (!scope || scope === 'all' || scope === 'bids') {
        refreshBids();
      }
    };
    const onContractActivated = () => {
      refreshBids();
    };
    const onShipmentsRefresh = () => {
      refreshBids();
    };
    const onStatusUpdated = () => {
      refreshLoads();
      refreshBids();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    window.addEventListener('tp:contract-activated', onContractActivated);
    window.addEventListener('tp:shipments-refresh', onShipmentsRefresh);
    window.addEventListener('tp:shipment-status-updated', onStatusUpdated);
    return () => {
      window.removeEventListener('tp:realtime-refresh', onRefresh);
      window.removeEventListener('tp:contract-activated', onContractActivated);
      window.removeEventListener('tp:shipments-refresh', onShipmentsRefresh);
      window.removeEventListener('tp:shipment-status-updated', onStatusUpdated);
    };
  }, [refreshLoads, refreshBids]);

  const earnings = useMemo(
    () =>
      mineLoads
        .filter((l) => String(l.status || '').toLowerCase() === 'closed')
        .reduce((s, l) => s + Number(l.expectedPrice || 0), 0),
    [mineLoads]
  );

  const stats = useMemo(() => {
    const s = ops?.shipper;
    return [
      { label: t('pages.dashboard.statActiveShipments'), value: s?.activeShipments ?? 0 },
      { label: t('pages.dashboard.statCompletedDeliveries'), value: s?.completedDeliveries ?? 0 },
      { label: t('pages.dashboard.statPendingBids'), value: s?.pendingBids ?? 0 },
      {
        label: t('pages.dashboard.statDeliveredValue'),
        value: earnings ? earnings.toLocaleString() : '0',
        subLabel: t('pages.dashboard.statDeliveredValueSub')
      }
    ];
  }, [ops?.shipper, earnings, t]);

  const openLoads = useMemo(() => mineLoads.filter((l) => l.status === 'open'), [mineLoads]);

  if (authLoading || !user?.id || !activeRole) {
    return (
      <div className="container py-3 text-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="container py-3 tp-dashboard tp-dashboard--shipper">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h5 className="mb-1">{t('pages.dashboard.shipperTitle')}</h5>
          <p className="small text-muted mb-0">{t('pages.dashboard.shipperSubtitle')}</p>
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          {profileComplete ? (
            <ActiveRoleBadge />
          ) : (
            <Link to="/profile" className="btn btn-warning btn-sm rounded-lg">
              {t('pages.dashboard.incompleteProfileCta')}
            </Link>
          )}
          <Link to="/loads/post" className="btn btn-primary btn-sm rounded-lg">
            {t('pages.loads.postLoadCta')}
          </Link>
        </div>
      </div>

      {loadingOps ? (
        <div className="text-center py-3">
          <Loader />
        </div>
      ) : (
        <StatsCards stats={stats} />
      )}

      <div className="mt-3 row g-3">
        <div className="col-12 col-lg-7">
          <div className="rounded-3 border border-dashed p-4 text-center tp-empty-state">
            <h6 className="mb-2">{t('pages.dashboard.openLoads')}</h6>
            <p className="small text-muted mb-3">{t('pages.dashboard.loadsHubHint')}</p>
            <Link to="/loads/manage" className="btn btn-outline-primary btn-sm rounded-lg">
              {t('loadsHub.title')}
            </Link>
          </div>
        </div>
        <div className="col-12 col-lg-5">
          <ActivityFeed activities={activities} />
        </div>
      </div>

      <div className="mt-4">
        <h6 className="mb-3">{t('loadsHub.title')}</h6>
        <DashboardShipmentTabs
          ops={ops}
          opsReady={!loadingOps}
          activeEmptyState={
            <div className="text-muted text-center py-5 px-3 tp-empty-state rounded-3 border border-dashed">
              <div className="fw-semibold mb-1">{t('pages.dashboard.emptyNoActiveShipments')}</div>
              <div className="small">{t('pages.dashboard.emptyNoActiveShipmentsBody')}</div>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default ShipperDashboard;
