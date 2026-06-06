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
import {
  commitOptimisticStatusAdvance,
  emitShipmentStatusUpdated,
  getOptimisticStatusTimeline,
  resolveEffectiveShipmentStatus,
  resolveUpcomingShipmentStatus,
  subscribeOptimisticShipmentStatus
} from '../../utils/shipmentStatusOptimistic.js';
import {
  assertIsSnapshotConsumer,
  EMPTY_UNIFIED_SNAPSHOT,
  getUnifiedShipmentSnapshot,
  withShipmentUILabels
} from '../../utils/shipmentUIState.js';
import { fetchActiveShipmentRow, findActiveShipmentRow } from '../../utils/activeShipmentModel.js';
import {
  getActiveShipmentList,
  subscribeActiveShipmentStore
} from '../../utils/activeShipmentStore.js';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';
import { triggerStatusActivationSync } from '../../utils/contractActivation.js';
import { FLOW_TYPE } from '../../utils/flowSession.js';
import {
  buildOptimisticTrackingRow,
  hasOptimisticActivation,
  subscribeOptimisticActivation
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
      if (row) {
        setActiveRow((prev) => {
          const snapshot =
            getUnifiedShipmentSnapshot({
              restRow: row,
              ref: id,
              userId: user?.id ?? null,
              role: workspaceRole
            }) ?? EMPTY_UNIFIED_SNAPSHOT;
          return snapshot.activeRow ?? prev;
        });
      }
    } catch {
      if (!hasOptimisticActivation(id)) setActiveRow(null);
    } finally {
      if (silent) setBackgroundHydrating(false);
      else setActiveLoading(false);
    }
  }, [id, request, user?.id, workspaceRole]);

  useEffect(() => {
    refreshActiveRow();
  }, [refreshActiveRow]);

  useEffect(() => {
    const onShipmentsRefresh = () => refreshActiveRow({ silent: true });
    const onTrackingRefresh = () => refreshActiveRow({ silent: true });
    const onLegacyRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope === 'all' || !scope) return;
      if (scope === 'shipments' || scope === 'tracking') refreshActiveRow({ silent: true });
    };
    const onHydrate = (e) => {
      const tick = ++hydrateTickRef.current;
      const rows = e?.detail?.rows;
      if (Array.isArray(rows) && rows.length && id) {
        const matched = findActiveShipmentRow(rows, id);
        if (matched) {
          setActiveRow((prev) => {
            const snapshot = assertIsSnapshotConsumer(
              getUnifiedShipmentSnapshot({
                restRow: matched,
                ref: id,
                userId: user?.id ?? null,
                role: workspaceRole
              }),
              'ShipmentTracking.onHydrate'
            );
            return snapshot.activeRow ?? prev;
          });
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
    window.addEventListener('tp:shipments-refresh', onShipmentsRefresh);
    window.addEventListener('tp:tracking-refresh', onTrackingRefresh);
    window.addEventListener('tp:realtime-refresh', onLegacyRefresh);
    window.addEventListener('tp:active-shipments-hydrate', onHydrate);
    window.addEventListener('tp:contract-sync', onContractSync);
    return () => {
      window.removeEventListener('tp:shipments-refresh', onShipmentsRefresh);
      window.removeEventListener('tp:tracking-refresh', onTrackingRefresh);
      window.removeEventListener('tp:realtime-refresh', onLegacyRefresh);
      window.removeEventListener('tp:active-shipments-hydrate', onHydrate);
      window.removeEventListener('tp:contract-sync', onContractSync);
    };
  }, [refreshActiveRow, id, user?.id, workspaceRole]);

  useEffect(() => {
    if (!id) return undefined;
    return subscribeActiveShipmentStore((rows) => {
      const matched = findActiveShipmentRow(rows, id);
      if (matched) {
        setActiveRow((prev) => {
          const snapshot = assertIsSnapshotConsumer(
            getUnifiedShipmentSnapshot({
              restRow: matched,
              ref: id,
              userId: user?.id ?? null,
              role: workspaceRole
            }),
            'ShipmentTracking.storeSubscribe'
          );
          return snapshot.activeRow ?? prev;
        });
      }
    });
  }, [id, user?.id, workspaceRole]);

  useEffect(() => subscribeOptimisticActivation(() => bumpOptimistic((n) => n + 1)), []);

  useEffect(() => subscribeOptimisticShipmentStatus(() => bumpOptimistic((n) => n + 1)), []);

  useEffect(() => {
    const onActivated = (e) => {
      const ref = String(e?.detail?.ref || '').trim();
      if (ref && ref === id) {
        bumpOptimistic((n) => n + 1);
        refreshActiveRow({ silent: true });
      }
    };
    const onStatusUpdated = (e) => {
      const ref = String(e?.detail?.ref || '').trim();
      if (ref && ref === id) {
        bumpOptimistic((n) => n + 1);
        refreshActiveRow({ silent: true });
      }
    };
    window.addEventListener('tp:contract-activated', onActivated);
    window.addEventListener('tp:shipment-status-updated', onStatusUpdated);
    return () => {
      window.removeEventListener('tp:contract-activated', onActivated);
      window.removeEventListener('tp:shipment-status-updated', onStatusUpdated);
    };
  }, [id, refreshActiveRow]);

  const hasOptimistic = hasOptimisticActivation(id);
  const storeRow = useMemo(
    () => (id ? findActiveShipmentRow(getActiveShipmentList(), id) : null),
    [id, activeRow, hasOptimistic]
  );
  const isHydrating = (activeLoading || backgroundHydrating) && !hasOptimistic;

  const pageSnapshot = useMemo(() => {
    if (!id || !isValidShipmentTrackRef(id)) return EMPTY_UNIFIED_SNAPSHOT;
    const fromStore = findActiveShipmentRow(getActiveShipmentList(), id);
    const candidate = activeRow || fromStore;
    return assertIsSnapshotConsumer(
      getUnifiedShipmentSnapshot({
        restRow: candidate,
        storeRow: fromStore,
        ref: id,
        userId: user?.id ?? null,
        role: workspaceRole
      }),
      'ShipmentTracking.pageSnapshot'
    );
  }, [activeRow, id, workspaceRole, user?.id, hasOptimistic]);

  const rowForTracking = useMemo(() => {
    if (!id || !isValidShipmentTrackRef(id)) return null;
    return (
      pageSnapshot.activeRow ||
      buildOptimisticTrackingRow(id, { userId: user?.id ?? null, role: workspaceRole }) ||
      null
    );
  }, [pageSnapshot, id, workspaceRole, user?.id, hasOptimistic]);

  const trackingEnabled = Boolean(pageSnapshot.tracking?.enabled) || hasOptimistic;

  const { trackingData: payload, uiState, loading, error, livePos, geoError } = useShipmentTracking({
    trackRef: id,
    shipmentStatus: pageSnapshot.shipmentStatus ?? rowForTracking?.shipmentStatus ?? null,
    trackingEnabled,
    assignedCarrierId:
      pageSnapshot.activeRow?.assignedCarrierId ??
      pageSnapshot.contractFields?.assignedCarrierId ??
      null,
    shareLive,
    enabled: Boolean(id && (rowForTracking || hasOptimistic)),
    role: workspaceRole,
    flowType:
      pageSnapshot.activeRow?.flowType ?? pageSnapshot.contractFields?.flowType ?? FLOW_TYPE.BID
  });

  const ui = useMemo(
    () => withShipmentUILabels(pageSnapshot.uiState ?? uiState ?? {}, t),
    [pageSnapshot.uiState, uiState, t]
  );

  const baseShipmentStatus =
    payload?.tracking?.status ??
    rowForTracking?.shipmentStatus ??
    pageSnapshot.shipmentStatus ??
    'booked';
  const effectiveStatus = resolveEffectiveShipmentStatus(id, baseShipmentStatus);
  const upcomingStatus =
    workspaceRole === 'carrier'
      ? resolveUpcomingShipmentStatus(id, baseShipmentStatus)
      : ui.upcomingStatus;
  const canRenderAdvanceButton =
    workspaceRole === 'carrier' &&
    isValidShipmentTrackRef(id) &&
    (Boolean(pageSnapshot.contractActivated) ||
      hasOptimistic ||
      Boolean(pageSnapshot.permissions?.canUpdateStatus ?? ui.canUpdateStatus));
  const canEnableButton = canRenderAdvanceButton && upcomingStatus != null;

  const handleAdvanceStatus = useCallback(async () => {
    if (!upcomingStatus || !id || !canEnableButton) return;
    const label = t(advanceStatusLabelKey(upcomingStatus));
    commitOptimisticStatusAdvance(id, upcomingStatus, { label });
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
      emitShipmentStatusUpdated(id, upcomingStatus, { source: 'api' });
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.tracking.loadFailed') }));
    } finally {
      setAdvancing(false);
    }
  }, [id, upcomingStatus, canEnableButton, request, t, workspaceRole]);

  const tracking = payload?.tracking;
  const originName =
    payload?.origin ||
    activeRow?.origin ||
    storeRow?.origin ||
    rowForTracking?.origin ||
    pageSnapshot.activeRow?.origin ||
    '';
  const destinationName =
    payload?.destination ||
    activeRow?.destination ||
    storeRow?.destination ||
    rowForTracking?.destination ||
    pageSnapshot.activeRow?.destination ||
    '';

  const routeEstimate = useMemo(() => {
    if (!originName || !destinationName) return null;
    return estimateLocalFare(originName, destinationName);
  }, [originName, destinationName]);

  const routeDistanceKm = useMemo(() => {
    const fromApi = payload?.distanceKm;
    if (Number(fromApi) > 0) return Number(fromApi);
    if (routeEstimate?.distanceKm > 0) return routeEstimate.distanceKm;
    if (!originName || !destinationName) return null;
    return null;
  }, [payload?.distanceKm, routeEstimate?.distanceKm, originName, destinationName]);

  const estimatedTravelHours = useMemo(() => {
    if (routeEstimate?.estimatedTravelHours > 0) return routeEstimate.estimatedTravelHours;
    if (routeDistanceKm > 0) {
      return Math.max(0.5, Math.round((routeDistanceKm / 65) * 10) / 10);
    }
    return null;
  }, [routeEstimate?.estimatedTravelHours, routeDistanceKm]);

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
    hasOptimistic ||
      pageSnapshot.contractActivated ||
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
      status: effectiveStatus,
      driverName: t('common.emDash'),
      vehicleReg: t('common.emDash'),
      eta: tracking?.eta || t('common.emDash'),
      lastUpdate: tracking?.locationUpdatedAt || payload?.history?.[0]?.time || t('common.emDash')
    }),
    [id, payload?.refKey, tracking, payload?.history, originName, destinationName, effectiveStatus, t]
  );

  const timelineEvents = useMemo(() => {
    const h = Array.isArray(payload?.history) ? payload.history : [];
    const optimisticLog = getOptimisticStatusTimeline(id);
    const merged = [...h, ...optimisticLog];
    if (!merged.length) return [];
    return merged.map((ev) => ({
      label: ev.event || ev.label || t('pages.tracking.timelineUpdate'),
      time: ev.time || '',
      done: true,
      note: ev.location
    }));
  }, [payload?.history, id, effectiveStatus, t]);

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
        status: effectiveStatus,
        eta: tracking?.eta,
        currentLocation,
        locationUnavailable: !currentLocation && !loading && !ui.contractActivated && !hasOptimistic
      },
      liveTrackingMap: payload?.liveTrackingMap || { coordinates: coords }
    }),
    [tracking, currentLocation, payload, coords, originName, destinationName, loading, ui.contractActivated, hasOptimistic, effectiveStatus]
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

  const shellReady =
    hasOptimistic ||
    Boolean(pageSnapshot.contractActivated) ||
    Boolean(pageSnapshot.tracking?.showShell) ||
    Boolean(rowForTracking);

  if (activeLoading && !shellReady) {
    return (
      <div className="container py-3 tp-tracking-page">
        <h5 className="mb-3">{t('pages.tracking.title')}</h5>
        <div className="text-center py-4">
          <Loader />
        </div>
      </div>
    );
  }

  if (!shellReady) {
    if (isHydrating) {
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

  const renderShellReady =
    shellReady || Boolean(ui?.contractActivated) || Boolean(rowForTracking);
  const showTrackingSkeleton = loading && !payload && !renderShellReady;

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
            liveDriver={Boolean(shareLive && (livePos || hasOptimistic))}
            geoError={geoError}
          />
        </div>
      ) : null}
      <StatusTimeline uiState={{ ...ui, status: effectiveStatus }} events={timelineEvents} />
      {workspaceRole === 'carrier' &&
      (rowForTracking || hasOptimistic || pageSnapshot.contractActivated) ? (
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
      <RouteInfo
        distance={routeDistanceKm}
        estimatedHours={estimatedTravelHours}
        checkpoints={checkpoints}
      />
    </div>
  );
};

export default ShipmentTracking;
