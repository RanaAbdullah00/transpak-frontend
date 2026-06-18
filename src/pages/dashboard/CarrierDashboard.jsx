import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import DashboardShipmentTabs from '../../components/dashboard/DashboardShipmentTabs.jsx';
import { normalizeLoads } from '../../adapters/normalize.js';
import { filterOpenLoads } from '../../utils/loadBidding.js';
import { ensureArray } from '../../utils/unwrapApi.js';
import ActiveRoleBadge from '../../components/profile/ActiveRoleBadge.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { acceptLoadAtListedFare, rejectLoadForCarrier } from '../../services/carrierLoadOffer.js';
import { notifyApiError, notifySystem, SystemNotifyType } from '../../utils/notifySystem.js';
import { isActiveBidStatus, normalizeBidStatus } from '../../utils/bidStatus.js';
const CarrierDashboard = () => {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const activeRole = user?.activeRole ?? user?.roles?.[0];
  const profileComplete = user?.profileComplete === true;
  const { ops, loadingOps, activities } = useDashboardMetrics();
  const [openLoads, setOpenLoads] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [fleetCount, setFleetCount] = useState(0);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [offerBusyId, setOfferBusyId] = useState(null);
  const { request } = useApi();

  const refreshBoard = useCallback(async () => {
    setLoadingBoard(true);
    try {
      const [loadsRaw, bidsRaw, trucksRaw] = await Promise.all([
        request({ method: 'GET', url: '/loads', skipGlobalErrorToast: true }).catch(() => []),
        request({ method: 'GET', url: '/bids/mine', skipGlobalErrorToast: true }).catch(() => []),
        request({ method: 'GET', url: '/trucks/mine', skipGlobalErrorToast: true }).catch(() => [])
      ]);
      setOpenLoads(filterOpenLoads(normalizeLoads(ensureArray(loadsRaw))).slice(0, 6));
      setMyBids(ensureArray(bidsRaw));
      setFleetCount(normalizeTrucksResponse(trucksRaw).length);
    } catch {
      setOpenLoads([]);
      setFleetCount(0);
    } finally {
      setLoadingBoard(false);
    }
  }, [request]);

  useEffect(() => {
    refreshBoard();
  }, [refreshBoard, user?.activeRole]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'loads' && scope !== 'bids' && scope !== 'shipments' && scope !== 'space') return;
      refreshBoard().catch(() => {});
    };
    const onContractActivated = () => {
      refreshBoard().catch(() => {});
    };
    const onShipmentsRefresh = () => {
      refreshBoard().catch(() => {});
    };
    const onLoadBooked = (e) => {
      const loadId = e?.detail?.loadId;
      if (loadId) {
        setOpenLoads((prev) => prev.filter((l) => String(l.id) !== String(loadId)));
      }
      refreshBoard().catch(() => {});
    };
    const onStatusUpdated = () => {
      refreshBoard().catch(() => {});
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    window.addEventListener('tp:contract-activated', onContractActivated);
    window.addEventListener('tp:shipments-refresh', onShipmentsRefresh);
    window.addEventListener('tp:load-booked', onLoadBooked);
    window.addEventListener('tp:shipment-status-updated', onStatusUpdated);
    return () => {
      window.removeEventListener('tp:realtime-refresh', onRefresh);
      window.removeEventListener('tp:contract-activated', onContractActivated);
      window.removeEventListener('tp:shipments-refresh', onShipmentsRefresh);
      window.removeEventListener('tp:load-booked', onLoadBooked);
      window.removeEventListener('tp:shipment-status-updated', onStatusUpdated);
    };
  }, [refreshBoard]);

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

  const handleCarrierAccept = async (load) => {
    setOfferBusyId(load.id);
    try {
      await acceptLoadAtListedFare(request, load, {
        t,
        notifyWarn: (msg) => notifySystem(SystemNotifyType.WARNING, msg)
      });
      notifySystem(SystemNotifyType.SUCCESS, t('pages.loads.carrierAcceptSuccess'));
      await refreshBoard();
    } catch (err) {
      notifyApiError(err);
    } finally {
      setOfferBusyId(null);
    }
  };

  const handleCarrierReject = async (load) => {
    setOfferBusyId(load.id);
    try {
      await rejectLoadForCarrier(request, load);
      notifySystem(SystemNotifyType.SUCCESS, t('pages.loads.carrierRejectSuccess'));
      await refreshBoard();
    } catch (err) {
      notifyApiError(err);
    } finally {
      setOfferBusyId(null);
    }
  };

  if (authLoading || !user?.id || !activeRole) {
    return (
      <div className="container py-3 text-center">
        <Loader />
      </div>
    );
  }

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
            <Link to="/loads/manage?tab=marketplace&sub=loads" className="btn btn-outline-primary btn-sm rounded-lg">
            {t('loadsHub.marketplaceTitle')}
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
            <h6 className="mb-2">{t('pages.dashboard.recommendedLoads')}</h6>
            <p className="small text-muted mb-3">{t('pages.dashboard.marketplaceBrowseHint')}</p>
            <Link to="/loads/manage?tab=marketplace&sub=loads" className="btn btn-outline-primary btn-sm rounded-lg">
              {t('loadsHub.marketplaceTitle')}
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
          carrierMode
          ops={ops}
          opsReady={!loadingOps}
          activeEmptyState={
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
