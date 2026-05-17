import React, { useMemo } from 'react';
import StatsCards from '../../components/dashboard/StatsCards.jsx';
import OperationsPanel from '../../components/dashboard/OperationsPanel.jsx';
import ActivityFeed from '../../components/dashboard/ActivityFeed.jsx';
import AnalyticsChart from '../../components/dashboard/AnalyticsChart.jsx';
import LoadList from '../../components/loadboard/LoadList.jsx';
import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import ActiveShipmentPanel from '../../components/dashboard/ActiveShipmentPanel.jsx';
import { FaTruck } from 'react-icons/fa';
import { normalizeLoads } from '../../adapters/normalize.js';
import { Link } from 'react-router-dom';
import ActiveRoleBadge from '../../components/profile/ActiveRoleBadge.jsx';
import { acceptLoadAtListedFare, submitCounterOffer } from '../../services/carrierLoadOffer.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { unwrapErrorMessage } from '../../utils/unwrapApi.js';

// Dashboard view tailored for carriers.
const CarrierDashboard = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const profileComplete = user?.profileComplete === true;
  const activities = [];

  const [openLoads, setOpenLoads] = useState([]);
  const [bidSummary, setBidSummary] = useState({ accepted: 0, pending: 0 });
  const [fleetCount, setFleetCount] = useState(0);
  const [offerBusyId, setOfferBusyId] = useState(null);

  const metrics = useMemo(() => {
    const open = openLoads.length;
    const accepted = bidSummary.accepted;
    const pending = bidSummary.pending;
    return { open, accepted, pending };
  }, [openLoads, bidSummary]);

  const stats = useMemo(
    () => [
      { label: t('pages.dashboard.statOpenMarketplace'), value: metrics.open },
      { label: t('pages.dashboard.statAcceptedBids'), value: metrics.accepted },
      { label: t('pages.dashboard.statPendingBids'), value: metrics.pending },
      { label: t('pages.dashboard.statFleetVehicles'), value: fleetCount, subLabel: t('pages.dashboard.statFleetSub') }
    ],
    [metrics, fleetCount, t]
  );

  const chartData = useMemo(() => {
    const windowWeeks = 4;
    if (!metrics.accepted && !metrics.pending) return [];
    return Array.from({ length: windowWeeks }, (_, i) => ({
      name: t('pages.dashboard.chartWeekLabel', { n: i + 1 }),
      value: 0
    }));
  }, [metrics.accepted, metrics.pending, t]);

  const [trackingData] = useState(null);
  const [loadingTracking] = useState(false);
  const { request } = useApi();

  useEffect(() => {
    (async () => {
      try {
        const [loadsRaw, bidsRaw, trucksRaw] = await Promise.all([
          request({ method: 'GET', url: '/loads' }).catch(() => []),
          request({ method: 'GET', url: '/bids/mine' }).catch(() => []),
          request({ method: 'GET', url: '/trucks/mine' }).catch(() => [])
        ]);
        const loadsArr = normalizeLoads(Array.isArray(loadsRaw) ? loadsRaw : []);
        setOpenLoads(loadsArr.slice(0, 6));
        const bids = Array.isArray(bidsRaw) ? bidsRaw : [];
        setBidSummary({
          accepted: bids.filter((b) => String(b.status) === 'accepted').length,
          pending: bids.filter((b) => String(b.status) === 'pending').length
        });
        setFleetCount(Array.isArray(trucksRaw) ? trucksRaw.length : 0);
      } catch {
        setOpenLoads([]);
        setFleetCount(0);
      }
    })();
  }, [request]);

  const optimisticallyRemoveLoad = (load) => {
    setOfferBusyId(load.id);
    setOpenLoads((prev) => prev.filter((l) => String(l.id) !== String(load.id)));
    return load;
  };

  const rollbackLoad = (load) => {
    setOfferBusyId(null);
    setOpenLoads((prev) => (prev.some((l) => String(l.id) === String(load.id)) ? prev : [load, ...prev]));
  };

  const handleCarrierAccept = async (load) => {
    optimisticallyRemoveLoad(load);
    try {
      await acceptLoadAtListedFare(request, load);
      notifySuccess(t('pages.loads.carrierAcceptSuccess'));
    } catch (err) {
      rollbackLoad(load);
      notifyError(unwrapErrorMessage(err) || t('pages.loads.failedLoadDetail'));
    } finally {
      setOfferBusyId(null);
    }
  };

  const handleCarrierCounter = async (load, amount) => {
    optimisticallyRemoveLoad(load);
    try {
      await submitCounterOffer(request, load, amount);
      notifySuccess(t('pages.loads.carrierCounterSuccess'));
    } catch (err) {
      rollbackLoad(load);
      notifyError(unwrapErrorMessage(err) || t('pages.loads.failedLoadDetail'));
    } finally {
      setOfferBusyId(null);
    }
  };

  return (
    <div className="container py-3 tp-dashboard tp-dashboard--carrier">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h5 className="mb-1">{t('pages.dashboard.carrierTitle')}</h5>
          <p className="small text-muted mb-0">{t('pages.dashboard.carrierSubtitle')}</p>
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          {profileComplete ? (
            <ActiveRoleBadge />
          ) : (
            <Link to="/profile" className="btn btn-warning btn-sm rounded-lg">
              {t('pages.dashboard.incompleteProfileCta')}
            </Link>
          )}
        </div>
      </div>
      <OperationsPanel />
      <StatsCards stats={stats} />
      <div className="mt-3 row g-2">
        <div className="col-12 col-lg-6">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <div className="small text-muted">{t('pages.dashboard.monthlyView')}</div>
            <select className="form-select form-select-sm w-auto" defaultValue="this" aria-label={t('pages.dashboard.monthlyView')}>
              <option value="this">{t('pages.dashboard.monthThis')}</option>
              <option value="last">{t('pages.dashboard.monthLast')}</option>
            </select>
          </div>
          <AnalyticsChart
            data={chartData}
            label={t('pages.dashboard.chartWeeklyBidding')}
            legend={t('pages.dashboard.chartLegendAcceptedBids')}
            emptyHint={t('pages.dashboard.chartEmptyCarrier')}
          />
        </div>
        <div className="col-12 col-lg-6">
          <ActivityFeed activities={activities} />
        </div>
      </div>
      <div className="mt-3">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <h6 className="mb-0">{t('pages.dashboard.recommendedLoads')}</h6>
        </div>
        <LoadList
          loads={openLoads}
          carrierMode
          onCarrierAccept={handleCarrierAccept}
          onCarrierCounter={handleCarrierCounter}
          carrierBusyLoadId={offerBusyId}
        />
      </div>
      <div className="mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">{t('pages.dashboard.myAssignedShipments')}</h6>
        </div>
        <ActiveShipmentPanel
          trackingData={trackingData}
          loadingTracking={loadingTracking}
          emptyState={
            <div className="text-center py-5 px-3 tp-empty-state rounded-3 border border-dashed text-muted">
              <FaTruck className="fs-1 text-muted mb-3" />
              <h6 className="mb-2">{t('pages.dashboard.emptyNoAssignedShipments')}</h6>
              <p className="small mb-0">{t('pages.dashboard.emptyNoAssignedShipmentsBody')}</p>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default CarrierDashboard;
