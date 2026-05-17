import React, { useCallback, useEffect, useState } from 'react';
import Card from '../ui/Card.jsx';
import { SkeletonCard } from '../ui/Skeleton.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';

const OperationsPanel = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { request, loading } = useApi();
  const [snap, setSnap] = useState(null);
  const activeRole = user?.activeRole ?? user?.roles?.[0];

  const refresh = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/operations/snapshot' });
      setSnap(data || null);
    } catch {
      setSnap(null);
    }
  }, [request]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onRefresh = () => refresh();
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [refresh]);

  const shipper = snap?.shipper;
  const carrier = snap?.carrier;

  const metrics =
    activeRole === 'carrier' && carrier
      ? [
          { label: t('pages.dashboard.opsActiveBids'), value: carrier.activeBids },
          { label: t('pages.dashboard.opsWonBids'), value: carrier.wonBids },
          { label: t('pages.dashboard.opsSpaceListings'), value: carrier.spaceListings },
          { label: t('pages.dashboard.opsPendingSpace'), value: carrier.pendingSpaceRequests },
          {
            label: t('pages.dashboard.opsRemainingKg'),
            value: Math.round(Number(carrier.remainingCapacityKg || 0)).toLocaleString()
          }
        ]
      : shipper
      ? [
          { label: t('pages.dashboard.opsOpenLoads'), value: shipper.openLoads },
          { label: t('pages.dashboard.opsActiveShipments'), value: shipper.activeShipments },
          { label: t('pages.dashboard.opsPendingBids'), value: shipper.pendingBids },
          { label: t('pages.dashboard.opsCompleted'), value: shipper.completedDeliveries }
        ]
      : [];

  if (!metrics.length && !loading) return null;

  return (
    <Card className="p-3 mb-3 tp-operations-panel">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">{t('pages.dashboard.operationsTitle')}</h6>
        <span className="small text-muted">{t('pages.dashboard.operationsLive')}</span>
      </div>
      {loading && !snap ? (
        <div className="row g-2">
          {[1, 2, 3, 4].map((k) => (
            <div key={k} className="col-6 col-md-3">
              <SkeletonCard />
            </div>
          ))}
        </div>
      ) : (
        <div className="row g-2">
          {metrics.map((m) => (
            <div key={m.label} className="col-6 col-md-3">
              <div className="tp-kpi-tile rounded-3 p-2 h-100">
                <div className="tp-kpi-tile__label small text-muted">{m.label}</div>
                <div className="tp-kpi-tile__value fw-bold fs-5">{m.value ?? 0}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default OperationsPanel;
