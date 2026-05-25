import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useDashboardMetrics } from '../../hooks/useDashboardMetrics.js';
import StatsCards from '../../components/dashboard/StatsCards.jsx';
import ActivityFeed from '../../components/dashboard/ActivityFeed.jsx';
import LoadList from '../../components/loadboard/LoadList.jsx';
import ActiveShipmentPanel from '../../components/dashboard/ActiveShipmentPanel.jsx';
import { normalizeLoads } from '../../adapters/normalize.js';
import ActiveRoleBadge from '../../components/profile/ActiveRoleBadge.jsx';
import { useShipmentTracking } from '../../hooks/useShipmentTracking.js';
import Loader from '../../components/ui/Loader.jsx';

const ShipperDashboard = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const profileComplete = user?.profileComplete === true;
  const { ops, loadingOps, activities } = useDashboardMetrics();
  const [mineLoads, setMineLoads] = useState([]);
  const [loadingLoads, setLoadingLoads] = useState(true);
  const { request } = useApi();

  useEffect(() => {
    let cancelled = false;
    setLoadingLoads(true);
    setMineLoads([]);
    (async () => {
      try {
        const data = await request({ url: '/loads/mine', skipGlobalErrorToast: true });
        if (!cancelled) setMineLoads(normalizeLoads(Array.isArray(data) ? data : []));
      } catch {
        if (!cancelled) setMineLoads([]);
      } finally {
        if (!cancelled) setLoadingLoads(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request, user?.activeRole]);

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

  const activeTrackRef = useMemo(() => {
    const active = mineLoads.find((l) => String(l.status || '').toLowerCase() === 'booked');
    return active ? active.code || active.id : null;
  }, [mineLoads]);

  const { trackingData, loading: loadingTracking } = useShipmentTracking({
    trackRef: activeTrackRef,
    shareLive: false,
    enabled: Boolean(activeTrackRef)
  });

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
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0">{t('pages.dashboard.openLoads')}</h6>
            <Link to="/loads/manage" className="small text-decoration-none">
              {t('common.viewAll')}
            </Link>
          </div>
          {loadingLoads ? (
            <div className="text-center py-4">
              <Loader />
            </div>
          ) : (
            <LoadList loads={openLoads.length ? openLoads : mineLoads.slice(0, 5)} />
          )}
        </div>
        <div className="col-12 col-lg-5">
          <ActivityFeed activities={activities} />
        </div>
      </div>

      <div className="mt-4">
        <h6 className="mb-3">{t('pages.dashboard.myActiveShipments')}</h6>
        <ActiveShipmentPanel
          trackingData={trackingData}
          loadingTracking={loadingTracking}
          trackHref={
            activeTrackRef ? `/shipments/tracking/${encodeURIComponent(activeTrackRef)}` : null
          }
          emptyState={
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
