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
import { getNextAllowedActions } from '../../utils/stateNormalizationEngine.js';
import { isValidShipmentTrackRef } from '../../utils/shipmentStatus.js';
import {
  commitOptimisticStatusAdvance,
  emitShipmentStatusUpdated,
  getOptimisticStatusTimeline,
  resolveEffectiveShipmentStatus,
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
import { resolveMapDisplayFields } from '../../utils/trackingActiveGate.js';
import { getLastKnownCoordinates } from '../../utils/trackingCache.js';
import { normalizeCoordList } from '../../utils/mapCoords.js';
import { useTrackingActive } from '../../hooks/useTrackingActive.js';
import { ingestFlowNotification } from '../../utils/notificationPipeline.js';
import { NOTIFICATION_KIND } from '../../utils/notificationEngine.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import TranslatedText from '../../components/ui/TranslatedText.jsx';
import Loader from '../../components/ui/Loader.jsx';
import TrackingSafeBoundary from '../../components/tracking/TrackingSafeBoundary.jsx';

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
      if (!scope || scope === 'all' || scope === 'shipments' || scope === 'tracking') {
        refreshActiveRow({ silent: true });
      }
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
  const isHydrating = (activeLoading || backgroundHydrating) && !hasOptimistic;

  const {
    trackingActive,
    storeRow,
    shipmentRow,
    pageSnapshot: reactivePageSnapshot
  } = useTrackingActive({
    trackRef: id,
    restRow: activeRow,
    role: workspaceRole,
    userId: user?.id ?? null
  });

  const pageSnapshot = reactivePageSnapshot ?? EMPTY_UNIFIED_SNAPSHOT;

  const rowForTracking = useMemo(() => {
    if (!id || !isValidShipmentTrackRef(id)) return null;
    return (
      pageSnapshot.activeRow ||
      shipmentRow ||
      buildOptimisticTrackingRow(id, { userId: user?.id ?? null, role: workspaceRole }) ||
      null
    );
  }, [pageSnapshot, shipmentRow, id, workspaceRole, user?.id, hasOptimistic]);

  const { trackingData: payload, uiState, loading, error, livePos, geoError } = useShipmentTracking({
    trackRef: id,
    shipmentStatus: pageSnapshot.shipmentStatus ?? rowForTracking?.shipmentStatus ?? null,
    trackingEnabled: trackingActive,
    assignedCarrierId:
      pageSnapshot.activeRow?.assignedCarrierId ??
      pageSnapshot.contractFields?.assignedCarrierId ??
      null,
    shareLive,
    enabled: Boolean(isValidShipmentTrackRef(id) && trackingActive),
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
  const advanceActions = useMemo(
    () =>
      workspaceRole === 'carrier'
        ? getNextAllowedActions(effectiveStatus, { role: 'carrier' })
        : [],
    [workspaceRole, effectiveStatus]
  );
  const primaryAction = advanceActions[0] ?? null;
  const canRenderAdvanceButton =
    workspaceRole === 'carrier' && isValidShipmentTrackRef(id) && trackingActive;
  const canEnableButton = canRenderAdvanceButton && primaryAction != null;

  const handleAdvanceStatus = useCallback(async () => {
    const upcomingStatus = primaryAction?.nextBackendStatus;
    if (!upcomingStatus || !id || !canEnableButton) return;
    const label = t(primaryAction.labelKey);
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
  }, [id, primaryAction, canEnableButton, request, t, workspaceRole]);

  const tracking = payload?.tracking;
  const mapFields = useMemo(() => {
    try {
      return resolveMapDisplayFields({
        livePayload: payload ?? null,
        livePos: shareLive && trackingActive ? livePos ?? null : null,
        lastKnownLocation: getLastKnownCoordinates(id) ?? null,
        shipmentRow: rowForTracking ?? null,
        storeRow: storeRow ?? null,
        status: effectiveStatus || 'booked',
        refKey: id
      });
    } catch {
      return resolveMapDisplayFields({ refKey: id, status: 'booked' });
    }
  }, [payload, livePos, rowForTracking, storeRow, effectiveStatus, id, shareLive, trackingActive]);
  const originName = mapFields.origin;
  const destinationName = mapFields.destination;

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

  const coords = useMemo(
    () => normalizeCoordList(payload?.liveTrackingMap?.coordinates),
    [payload?.liveTrackingMap?.coordinates]
  );

  const currentLocation = trackingActive ? mapFields.currentLocation : null;

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
    try {
      const h = Array.isArray(payload?.history) ? payload.history : [];
      const optimisticLog = getOptimisticStatusTimeline(id);
      const merged = [...h, ...optimisticLog].filter((ev) => ev && typeof ev === 'object');
      if (!merged.length) return [];
      return merged.map((ev) => ({
        label: ev.event || ev.label || t('pages.tracking.timelineUpdate'),
        time: ev.time || '',
        done: true,
        note: ev.location ?? null
      }));
    } catch {
      return [];
    }
  }, [payload?.history, id, effectiveStatus, t]);

  const checkpoints = useMemo(() => {
    const originLabel = originName?.trim() || '';
    const destLabel = destinationName?.trim() || '';
    if (originLabel && destLabel) {
      return [t('pages.tracking.originCity') + `: ${originLabel}`, t('pages.tracking.destinationCity') + `: ${destLabel}`];
    }
    if (coords.length >= 2) {
      return [
        originLabel || t('pages.tracking.originCity'),
        destLabel || t('pages.tracking.destinationCity')
      ];
    }
    if (coords.length === 1) return [t('pages.tracking.lastReportedPosition')];
    return [];
  }, [coords, originName, destinationName, t]);

  const trackingDataForMap = useMemo(
    () => ({
      ...mapFields.trackingData,
      origin: originName,
      destination: destinationName,
      tracking: {
        ...mapFields.trackingData?.tracking,
        status: effectiveStatus,
        eta: tracking?.eta,
        currentLocation,
        locationUnavailable: !currentLocation && trackingActive
      },
      liveTrackingMap:
        mapFields.trackingData?.liveTrackingMap || payload?.liveTrackingMap || { coordinates: coords }
    }),
    [
      mapFields.trackingData,
      tracking,
      currentLocation,
      payload,
      coords,
      originName,
      destinationName,
      trackingActive,
      effectiveStatus
    ]
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

  if (activeLoading && !trackingActive) {
    return (
      <div className="container py-3 tp-tracking-page">
        <h5 className="mb-3">{t('pages.tracking.title')}</h5>
        <div className="text-center py-4">
          <Loader />
        </div>
      </div>
    );
  }

  if (!trackingActive) {
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

  const userError = error ? formatUserError({ message: error }, t, { fallback: t('pages.tracking.loadFailed') }) : '';

  if (error && !payload && !trackingActive) {
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
    <TrackingSafeBoundary trackRef={id} role={workspaceRole}>
    <div className="container-fluid px-2 px-md-3 py-3 tp-tracking-page tp-tracking-page--live">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h5 className="mb-0">{t('pages.tracking.title')}</h5>
        <LifecycleBadge stage={payload?.lifecycleStage || ui.status} size="lg" />
        <StatusBadge uiState={{ ...ui, status: effectiveStatus }} size="lg" />
      </div>
      {ui.showShipperAcceptedBanner ? (
        <p className="small text-primary mb-2 fw-semibold">{ui.label}</p>
      ) : null}
      {loading && !payload ? (
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
      <div className="tp-tracking-map tp-tracking-map--fullscreen mb-3 overflow-hidden rounded-3 border">
        <TrackingMap
          trackingData={trackingDataForMap}
          currentLocation={currentLocation}
          originName={originName}
          destinationName={destinationName}
          liveDriver={Boolean(shareLive && (livePos || trackingActive))}
          geoError={geoError}
          trackingActive={trackingActive}
        />
      </div>
      <StatusTimeline
        uiState={{ ...ui, status: effectiveStatus }}
        currentStatus={effectiveStatus}
        events={timelineEvents}
      />
      {workspaceRole === 'carrier' && trackingActive ? (
        <div className="mt-3 mb-3">
          <h6 className="mb-2">{t('pages.tracking.updateStatus')}</h6>
          <Button
            variant="primary"
            className="tp-touch-target"
            disabled={!canEnableButton || advancing}
            onClick={handleAdvanceStatus}
          >
            {advancing
              ? t('common.loading')
              : primaryAction
                ? t(primaryAction.labelKey)
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
    </TrackingSafeBoundary>
  );
};

export default ShipmentTracking;
