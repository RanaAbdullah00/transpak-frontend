import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaTruck } from 'react-icons/fa';
import StatsCards from '../../components/dashboard/StatsCards.jsx';
import ActivityFeed from '../../components/dashboard/ActivityFeed.jsx';
import LoadList from '../../components/loadboard/LoadList.jsx';
import { useApi } from '../../hooks/useApi.js';
import { normalizeTrucksResponse } from '../../utils/fleetApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useDashboardMetrics } from '../../hooks/useDashboardMetrics.js';
import ActiveShipmentPanel from '../../components/dashboard/ActiveShipmentPanel.jsx';
import ActiveTripBanner from '../../components/dashboard/ActiveTripBanner.jsx';
import { normalizeLoads } from '../../adapters/normalize.js';
import { filterOpenLoads } from '../../utils/loadBidding.js';
import ActiveRoleBadge from '../../components/profile/ActiveRoleBadge.jsx';
import { acceptLoadAtListedFare, submitCounterOffer } from '../../services/carrierLoadOffer.js';
import { notifyApiError, notifySystem, SystemNotifyType } from '../../utils/notifySystem.js';
import { isActiveBidStatus, normalizeBidStatus } from '../../utils/bidStatus.js';
import { useShipmentTracking } from '../../hooks/useShipmentTracking.js';
import Loader from '../../components/ui/Loader.jsx';

const CarrierDashboard = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const profileComplete = user?.profileComplete === true;
  const { ops, loadingOps, activities } = useDashboardMetrics();
  const [openLoads, setOpenLoads] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [fleetCount, setFleetCount] = useState(0);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [offerBusyId, setOfferBusyId] = useState(null);
  const { request } = useApi();

  useEffect(() => {
    let cancelled = false;
    setLoadingBoard(true);
    setOpenLoads([]);
    setMyBids([]);
    setFleetCount(0);
    (async () => {
      try {
        const [loadsRaw, bidsRaw, trucksRaw] = await Promise.all([
          request({ method: 'GET', url: '/loads', skipGlobalErrorToast: true }).catch(() => []),
          request({ method: 'GET', url: '/bids/mine', skipGlobalErrorToast: true }).catch(() => []),
          request({ method: 'GET', url: '/trucks/mine', skipGlobalErrorToast: true }).catch(() => [])
        ]);
        if (cancelled) return;
        setOpenLoads(filterOpenLoads(normalizeLoads(Array.isArray(loadsRaw) ? loadsRaw : [])).slice(0, 6));
        setMyBids(Array.isArray(bidsRaw) ? bidsRaw : []);
        setFleetCount(normalizeTrucksResponse(trucksRaw).length);
      } catch {
        if (!cancelled) {
          setOpenLoads([]);
          setFleetCount(0);
        }
      } finally {
        if (!cancelled) setLoadingBoard(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request, user?.activeRole]);

  const stats = useMemo(() => {
    const c = ops?.carrier;
    const pending = c?.activeBids ?? myBids.filter((b) => isActiveBidStatus(b.status)).length;
    const accepted = c?.wonBids ?? myBids.filter((b) => normalizeBidStatus(b.status) === 'accepted').length;
    return [
      { label: t('pages.dashboard.statPendingBids'), value: pending },
      { label: t('pages.dashboard.statAcceptedBids'), value: accepted },
      { label: t('pages.dashboard.statFleetVehicles'), value: fleetCount, subLabel: t('pages.dashboard.statFleetSub') },
      { label: t('pages.dashboard.statOpenMarketplace'), value: openLoads.length }
    ];
  }, [ops?.carrier, myBids, fleetCount, openLoads.length, t]);

  const activeTrackRef = useMemo(() => {
    const won = myBids.find((b) => normalizeBidStatus(b.status) === 'accepted');
    return won?.loadCode || won?.loadId || null;
  }, [myBids]);

  const { trackingData, loading: loadingTracking, livePos, geoError } = useShipmentTracking({
    trackRef: activeTrackRef,
    shareLive: true,
    enabled: Boolean(activeTrackRef)
  });

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
      notifySystem(SystemNotifyType.SUCCESS, t('pages.loads.carrierAcceptSuccess'));
    } catch (err) {
      rollbackLoad(load);
      notifyApiError(err);
    } finally {
      setOfferBusyId(null);
    }
  };

  const handleCarrierCounter = async (load, amount) => {
    optimisticallyRemoveLoad(load);
    try {
      await submitCounterOffer(request, load, amount);
      notifySystem(SystemNotifyType.SUCCESS, t('pages.loads.carrierCounterSuccess'));
    } catch (err) {
      rollbackLoad(load);
      notifyApiError(err);
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
          <Link to="/loads" className="btn btn-outline-primary btn-sm rounded-lg">
            {t('pages.dashboard.statOpenMarketplace')}
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
            <h6 className="mb-0">{t('pages.dashboard.recommendedLoads')}</h6>
            <Link to="/loads" className="small text-decoration-none">
              {t('common.viewAll')}
            </Link>
          </div>
          {loadingBoard ? (
            <div className="text-center py-4">
              <Loader />
            </div>
          ) : (
            <LoadList
              loads={openLoads}
              carrierMode
              onCarrierAccept={handleCarrierAccept}
              onCarrierCounter={handleCarrierCounter}
              carrierBusyLoadId={offerBusyId}
            />
          )}
        </div>
        <div className="col-12 col-lg-5">
          <ActivityFeed activities={activities} />
        </div>
      </div>

      <div className="mt-4">
        <h6 className="mb-3">{t('pages.dashboard.myAssignedShipments')}</h6>
        {activeTrackRef ? <ActiveTripBanner trackingData={trackingData} trackRef={activeTrackRef} /> : null}
        <ActiveShipmentPanel
          trackingData={trackingData}
          loadingTracking={loadingTracking}
          liveDriver={Boolean(activeTrackRef)}
          liveLocation={livePos}
          geoError={geoError}
          trackHref={
            activeTrackRef ? `/shipments/tracking/${encodeURIComponent(activeTrackRef)}` : null
          }
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
