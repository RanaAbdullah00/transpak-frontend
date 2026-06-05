import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TrackingMap from '../../components/shipment/TrackingMap.jsx';
import RouteInfo from '../../components/shipment/RouteInfo.jsx';
import ShipmentCard from '../../components/shipment/ShipmentCard.jsx';
import StatusTimeline from '../../components/shipment/StatusTimeline.jsx';
import ShipmentProgressBox from '../../components/shipment/ShipmentProgressBox.jsx';
import LifecycleBadge from '../../components/shipment/LifecycleBadge.jsx';
import StatusBadge from '../../components/shipment/StatusBadge.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useApi } from '../../hooks/useApi.js';
import { estimateLocalFare } from '../../utils/localFareEstimate.js';
import { useShipmentTracking } from '../../hooks/useShipmentTracking.js';
import { advanceStatusLabelKey } from '../../utils/shipmentAdvance.js';
import { isValidShipmentTrackRef } from '../../utils/shipmentStatus.js';
import { withShipmentUILabels } from '../../utils/shipmentUIState.js';
import { fetchActiveShipmentRow, findActiveShipmentRow } from '../../utils/activeShipmentModel.js';
import {
  getActiveShipmentList,
  subscribeActiveShipmentStore
} from '../../utils/activeShipmentStore.js';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';
import { triggerStatusActivationSync } from '../../utils/contractActivation.js';
import {
  buildOptimisticTrackingRow,
  hasOptimisticActivation,
  subscribeOptimisticActivation,
  shouldSuppressStaleRestRow
} from '../../utils/contractActivationLayer.js';
import { ingestFlowNotification } from '../../utils/notificationPipeline.js';
import { NOTIFICATION_KIND } from '../../utils/notificationEngine.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import TranslatedText from '../../components/ui/TranslatedText.jsx';
import Loader from '../../components/ui/Loader.jsx';

const ShipmentTracking = () => {
  const { trackId } = useParams();
  const id = trackId?.trim() || '';
  const { user } = useAuth();
  const { t } = useLanguage();
  const { request } = useApi();
  const [advancing, setAdvancing] = useState(false);
  const [activeRow, setActiveRow] = useState(null);
  const [activeLoading, setActiveLoading] = useState(true);
  const [backgroundHydrating, setBackgroundHydrating] = useState(false);
  const [, bumpOptimistic] = useState(0);
  const hydrateTickRef = useRef(0);
  const isCarrier =
    user?.activeRole === 'carrier' || (user?.roles || []).includes('carrier');
  const stableRoleRef = useRef(null);
  if (stableRoleRef.current == null) {
    stableRoleRef.current = isCarrier ? 'carrier' : 'shipper';
  }
  const workspaceRole = stableRoleRef.current;
  const shareLive = workspaceRole === 'carrier' && Boolean(id);

  const refreshActiveRow = useCallback(async ({ silent = false } = {}) => {
    if (!id) {
      setActiveRow(null);
      setActiveLoading(false);
      setBackgroundHydrating(false);
      return;
    }
    const optimisticNow = hasOptimisticActivation(id);
    if (silent) setBackgroundHydrating(true);
    else if (!optimisticNow) setActiveLoading(true);
    try {
      const row = await fetchActiveShipmentRow(request, id);
      if (row) setActiveRow(row);
    } catch {
      if (!hasOptimisticActivation(id)) setActiveRow(null);
    } finally {
      if (silent) setBackgroundHydrating(false);
      else setActiveLoading(false);
    }
  }, [id, request]);

  useEffect(() => {
    refreshActiveRow();
  }, [refreshActiveRow]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (!scope || scope === 'all' || scope === 'shipments') refreshActiveRow({ silent: true });
    };
    const onHydrate = (e) => {
      const tick = ++hydrateTickRef.current;
      const rows = e?.detail?.rows;
      if (Array.isArray(rows) && rows.length && id) {
        const matched = findActiveShipmentRow(rows, id);
        if (matched && !shouldSuppressStaleRestRow(matched, id)) {
          setActiveRow((prev) => prev ?? matched);
        }
      }
      requestAnimationFrame(() => {
        if (hydrateTickRef.current !== tick) return;
        if (!hasOptimisticActivation(id)) refreshActiveRow({ silent: true });
      });
    };
    const onContractSync = (e) => {
      const ref = String(e?.detail?.ref || '').trim();
      if (ref && ref === id) refreshActiveRow({ silent: true });
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    window.addEventListener('tp:active-shipments-hydrate', onHydrate);
    window.addEventListener('tp:contract-sync', onContractSync);
    return () => {
      window.removeEventListener('tp:realtime-refresh', onRefresh);
      window.removeEventListener('tp:active-shipments-hydrate', onHydrate);
      window.removeEventListener('tp:contract-sync', onContractSync);
    };
  }, [refreshActiveRow, id]);

  useEffect(() => {
    if (!id) return undefined;
    return subscribeActiveShipmentStore((rows) => {
      const matched = findActiveShipmentRow(rows, id);
      if (matched && !shouldSuppressStaleRestRow(matched, id)) {
        setActiveRow((prev) => prev ?? matched);
      }
    });
  }, [id]);

  useEffect(() => subscribeOptimisticActivation(() => bumpOptimistic((n) => n + 1)), []);

  useEffect(() => {
    const onActivated = (e) => {
      const ref = String(e?.detail?.ref || '').trim();
      if (ref && ref === id) bumpOptimistic((n) => n + 1);
    };
    window.addEventListener('tp:contract-activated', onActivated);
    return () => window.removeEventListener('tp:contract-activated', onActivated);
  }, [id]);

  const hasOptimistic = hasOptimisticActivation(id);
  const isHydrating = (activeLoading || backgroundHydrating) && !hasOptimistic;

  const rowForTracking = useMemo(() => {
    if (!id || !isValidShipmentTrackRef(id)) return null;
    const optimistic = buildOptimisticTrackingRow(id, {
      userId: user?.id ?? null,
      role: workspaceRole
    });
    const fromStore = findActiveShipmentRow(getActiveShipmentList(), id);
    const candidate = activeRow || fromStore;
    if (optimistic) {
      if (!candidate) return optimistic;
      const stale =
        !candidate.trackingEnabled ||
        !candidate.shipmentStatus ||
        String(candidate.shipmentStatus || candidate.status || '').toLowerCase() === 'posted';
      if (stale || candidate.contractActivated !== true) {
        return {
          ...candidate,
          ...optimistic,
          shipmentStatus: optimistic.shipmentStatus,
          status: optimistic.status,
          trackingEnabled: true,
          contractActivated: true,
          assignedCarrierId:
            candidate.assignedCarrierId ?? optimistic.assignedCarrierId ?? null
        };
      }
    }
    return candidate || optimistic;
  }, [activeRow, id, workspaceRole, user?.id, hasOptimistic]);

  const trackingEnabled = Boolean(rowForTracking?.trackingEnabled) || hasOptimistic;

  const { trackingData: payload, uiState, loading, error, livePos, geoError } = useShipmentTracking({
    trackRef: id,
    shipmentStatus: rowForTracking?.shipmentStatus ?? null,
    trackingEnabled,
    assignedCarrierId: rowForTracking?.assignedCarrierId ?? null,
    shareLive,
    enabled: Boolean(id && (rowForTracking || hasOptimistic)),
    role: workspaceRole,
    flowType: rowForTracking?.flowType ?? null
  });

  const ui = useMemo(() => withShipmentUILabels(uiState || {}, t), [uiState, t]);
  const upcomingStatus = ui.upcomingStatus;
  const canRenderAdvanceButton =
    workspaceRole === 'carrier' && isValidShipmentTrackRef(id) && ui.canUpdateStatus;
  const canEnableButton = canRenderAdvanceButton && upcomingStatus != null;

  const handleAdvanceStatus = useCallback(async () => {
    if (!upcomingStatus || !id || !canEnableButton) return;
    setAdvancing(true);
    try {
      await request({
        method: 'PUT',
        url: `/shipments/${encodeURIComponent(id)}/status`,
        data: { status: upcomingStatus }
      });
      notifySuccess(t('pages.tracking.statusUpdated'));
      ingestFlowNotification({
        kind: NOTIFICATION_KIND.STATUS_UPDATE,
        dispatchType: 'STATUS_UPDATED',
        title: t('pages.tracking.statusUpdated'),
        message: `${id}: ${upcomingStatus}`,
        shipmentRef: id,
        roleType: workspaceRole,
        soundType: 'status',
        priority: 'medium',
      });
      await triggerStatusActivationSync(id);
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.tracking.loadFailed') }));
    } finally {
      setAdvancing(false);
    }
  }, [id, upcomingStatus, canEnableButton, request, t, workspaceRole]);

  const tracking = payload?.tracking;
  const originName = payload?.origin || '';
  const destinationName = payload?.destination || '';

  const routeDistanceKm = useMemo(() => {
    const fromApi = payload?.distanceKm;
    if (Number(fromApi) > 0) return Number(fromApi);
    if (!originName || !destinationName) return null;
    const est = estimateLocalFare(originName, destinationName);
    return est?.distanceKm > 0 ? est.distanceKm : null;
  }, [payload?.distanceKm, originName, destinationName]);

  const coords = useMemo(() => {
    const raw = payload?.liveTrackingMap?.coordinates || [];
    return raw
      .filter(
        (c) =>
          Array.isArray(c) &&
          c.length >= 2 &&
          Number.isFinite(Number(c[0])) &&
          Number.isFinite(Number(c[1]))
      )
      .map((c) => [Number(c[0]), Number(c[1])]);
  }, [payload?.liveTrackingMap?.coordinates]);

  const showTracking = Boolean(
    ui.contractActivated ||
      ui.trackingEnabled ||
      ui.unifiedContract?.trackingEnabled ||
      trackingEnabled
  );

  const currentLocation = useMemo(() => {
    if (!showTracking) return null;
    if (showTracking && shareLive && livePos) return livePos;
    const direct = tracking?.currentLocation ?? tracking?.location;
    if (
      Array.isArray(direct) &&
      direct.length >= 2 &&
      Number.isFinite(Number(direct[0])) &&
      Number.isFinite(Number(direct[1]))
    ) {
      return [Number(direct[0]), Number(direct[1])];
    }
    return null;
  }, [showTracking, tracking?.currentLocation, tracking?.location, shareLive, livePos]);

  const shipment = useMemo(
    () => ({
      code: payload?.refKey ? `#${payload.refKey}` : `#${id}`,
      origin: originName || t('common.emDash'),
      destination: destinationName || t('common.emDash'),
      status: tracking?.status || rowForTracking?.shipmentStatus || 'booked',
      driverName: t('common.emDash'),
      vehicleReg: t('common.emDash'),
      eta: tracking?.eta || t('common.emDash'),
      lastUpdate: tracking?.locationUpdatedAt || payload?.history?.[0]?.time || t('common.emDash')
    }),
    [id, payload?.refKey, tracking, payload?.history, originName, destinationName, t]
  );

  const timelineEvents = useMemo(() => {
    const h = payload?.history || [];
    return h.map((ev) => ({
      label: ev.event || ev.label || t('pages.tracking.timelineUpdate'),
      time: ev.time || '',
      done: true,
      note: ev.location
    }));
  }, [payload?.history, t]);

  const checkpoints = useMemo(() => {
    if (coords.length >= 2)
      return coords.map((_, i) => t('pages.tracking.mapPoint', { n: String(i + 1) }));
    if (coords.length === 1) return [t('pages.tracking.lastReportedPosition')];
    return [];
  }, [coords, t]);

  const trackingDataForMap = useMemo(
    () => ({
      ...payload,
      origin: originName,
      destination: destinationName,
      tracking: {
        ...tracking,
        status: tracking?.status,
        eta: tracking?.eta,
        currentLocation,
        locationUnavailable: !currentLocation && !loading && !ui.contractActivated
      },
      liveTrackingMap: payload?.liveTrackingMap || { coordinates: coords }
    }),
    [tracking, currentLocation, payload, coords, originName, destinationName, loading, ui.contractActivated]
  );

  if (!id || !isValidShipmentTrackRef(id)) {
    return (
      <div className="container py-4 tp-tracking-page">
        <h5 className="mb-3 text-body">{t('pages.tracking.title')}</h5>
        <div className="tp-empty-state rounded-3 border border-dashed p-4 text-center">
          <p className="small tp-support-muted mb-3">{t('pages.tracking.noIdHint')}</p>
          <Link to="/loads" className="btn btn-primary btn-sm">
            {t('pages.tracking.trackByCodeCta')}
          </Link>
        </div>
      </div>
    );
  }

  if (activeLoading && !hasOptimistic && !rowForTracking) {
    return (
      <div className="container py-3 tp-tracking-page">
        <h5 className="mb-3">{t('pages.tracking.title')}</h5>
        <div className="text-center py-4">
          <Loader />
        </div>
      </div>
    );
  }

  if (!rowForTracking) {
    if (isHydrating && !hasOptimistic) {
      return (
        <div className="container py-4 tp-tracking-page">
          <h5 className="mb-3 text-body">{t('pages.tracking.title')}</h5>
          <div className="text-center py-4">
            <Loader />
            <p className="small tp-support-muted mt-3 mb-0">{t('pages.tracking.waitingForData')}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="container py-4 tp-tracking-page">
        <h5 className="mb-3 text-body">{t('pages.tracking.title')}</h5>
        <div className="tp-empty-state rounded-3 border border-dashed p-4 text-center">
          <p className="small tp-support-muted mb-3">{t('pages.tracking.trackingNotActiveYet')}</p>
          <Link to={dashboardPathForRole(user?.activeRole)} className="btn btn-primary btn-sm">
            {t('pages.dashboard.myActiveShipments')}
          </Link>
        </div>
      </div>
    );
  }

  const shellReady = hasOptimistic || ui.contractActivated || Boolean(rowForTracking);
  const showTrackingSkeleton = loading && !payload && !shellReady;

  if (showTrackingSkeleton) {
    return (
      <div className="container py-3 tp-tracking-page">
        <h5 className="mb-3">{t('pages.tracking.title')}</h5>
        <div className="tp-tracking-skeleton rounded-3 border p-3 mb-3">
          <div className="placeholder-glow mb-2">
            <span className="placeholder col-5 rounded" />
          </div>
          <div className="placeholder-glow" style={{ minHeight: 320 }}>
            <span className="placeholder col-12 rounded d-block h-100" style={{ minHeight: 320 }} />
          </div>
        </div>
        <Loader />
      </div>
    );
  }

  const userError = error ? formatUserError({ message: error }, t, { fallback: t('pages.tracking.loadFailed') }) : '';

  if (error && !payload && !shellReady) {
    return (
      <div className="container py-3 tp-tracking-page">
        <h5 className="mb-3">{t('pages.tracking.title')}</h5>
        <p className="text-danger small">
          <TranslatedText text={userError} as="span" />
        </p>
        <Link to="/loads" className="btn btn-outline-primary btn-sm">
          {t('pages.tracking.trackByCodeCta')}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-fluid px-2 px-md-3 py-3 tp-tracking-page tp-tracking-page--live">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h5 className="mb-0">{t('pages.tracking.title')}</h5>
        <LifecycleBadge stage={payload?.lifecycleStage || ui.status} size="lg" />
        <StatusBadge uiState={ui} size="lg" />
      </div>
      {ui.showShipperAcceptedBanner ? (
        <p className="small text-primary mb-2 fw-semibold">{ui.label}</p>
      ) : null}
      {!showTracking && !loading ? (
        <p className="small text-muted mb-2">{t('pages.tracking.waitingForData')}</p>
      ) : null}
      {userError ? (
        <p className="text-warning small mb-2">
          <TranslatedText text={userError} as="span" />
        </p>
      ) : null}
      <ShipmentCard shipment={shipment} uiState={ui} />
      <div className="tp-tracking-progress mb-3">
        <ShipmentProgressBox uiState={ui} eta={shipment.eta} />
      </div>
      {showTracking ? (
        <div className="tp-tracking-map tp-tracking-map--fullscreen mb-3 overflow-hidden rounded-3 border">
          <TrackingMap
            trackingData={trackingDataForMap}
            currentLocation={currentLocation}
            originName={originName}
            destinationName={destinationName}
            liveDriver={Boolean(shareLive && livePos)}
            geoError={geoError}
          />
        </div>
      ) : null}
      <StatusTimeline uiState={ui} events={timelineEvents} />
      {workspaceRole === 'carrier' && rowForTracking ? (
        <div className="mt-3 mb-3">
          <h6 className="mb-2">{t('pages.tracking.updateStatus')}</h6>
          {!canRenderAdvanceButton ? (
            <p className="small text-muted mb-2">{t('pages.tracking.waitingForData')}</p>
          ) : null}
          <Button
            variant="primary"
            className="tp-touch-target"
            disabled={!canEnableButton || advancing}
            onClick={handleAdvanceStatus}
          >
            {advancing
              ? t('common.loading')
              : upcomingStatus
                ? t(advanceStatusLabelKey(upcomingStatus))
                : t('pages.tracking.updateStatus')}
          </Button>
        </div>
      ) : null}
      <RouteInfo distance={routeDistanceKm} duration={null} checkpoints={checkpoints} />
    </div>
  );
};

export default ShipmentTracking;
