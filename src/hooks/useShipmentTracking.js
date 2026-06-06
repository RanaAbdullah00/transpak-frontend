import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api.js';
import { normalizeTracking } from '../adapters/normalize.js';
import { AppContext } from '../context/AppContext.jsx';
import { useLiveLocation } from './useLiveLocation.js';
import { useTrackingSocket } from './useTrackingSocket.js';
import { useLanguage } from './useLanguage.js';
import { matchesTrackingPayload } from '../utils/trackingMerge.js';
import {
  hydrateTrackingFromCache,
  processTrackingPipeline
} from '../utils/trackingPipeline.js';
import {
  clearAllTrackingCaches,
  getCachedTrackingPayload
} from '../utils/trackingCache.js';
import { clearAllTrackingSequencers } from '../utils/trackingSequencer.js';
import { clearAllTrackingSmoothing } from '../utils/trackingSmoothing.js';
import { normalizeContractFields } from '../utils/contractFieldNormalizer.js';
import {
  assertIsSnapshotConsumer,
  EMPTY_UNIFIED_SNAPSHOT,
  getUnifiedShipmentSnapshot
} from '../utils/shipmentUIState.js';
import { canEmitGps, emitTrackingJoin } from '../utils/trackingSessionManager.js';
import {
  requestTrackingJoin,
  clearTrackingJoinRequest,
  clearTrackingJoinQueue,
  flushTrackingJoinQueue
} from '../utils/trackingJoinQueue.js';
import {
  sanitizeTrackingPayload,
  trackingPayloadEqual
} from '../utils/trackingPayloadSanitizer.js';
import { findActiveShipmentRow, isActiveShipmentTrackable } from '../utils/activeShipmentModel.js';
import { getActiveShipmentList } from '../utils/activeShipmentStore.js';
import {
  scheduleThrottledTrackingFetch,
  bumpTrackingFetchGeneration
} from '../utils/productionStabilityLayer.js';
import {
  getOptimisticActivation,
  getTrackingRef,
  subscribeOptimisticActivation
} from '../utils/contractActivationLayer.js';
import {
  getOptimisticShipmentStatus,
  subscribeOptimisticShipmentStatus
} from '../utils/shipmentStatusOptimistic.js';

/**
 * Coordinates + live GPS only. State gates come exclusively from GET /shipments/active row.
 */
export function useShipmentTracking({
  trackRef,
  shareLive = false,
  enabled = true,
  role = null,
  assignedCarrierId = null,
  /** Required — status from GET /shipments/active */
  shipmentStatus = null,
  /** Required — trackingEnabled from GET /shipments/active row only */
  trackingEnabled = false,
  flowType = null
}) {
  const { t } = useLanguage();
  const { registerTrackingHandler, getSocket, socketStatus } = useContext(AppContext) || {};
  const stableRoleRef = useRef(role);
  if (role && stableRoleRef.current == null) stableRoleRef.current = role;
  const effectiveRole = stableRoleRef.current ?? role;

  const optimistic = useMemo(
    () => (trackRef ? getOptimisticActivation(trackRef) : null),
    [trackRef]
  );

  const [, bumpOptimistic] = useState(0);
  useEffect(() => subscribeOptimisticActivation(() => bumpOptimistic((n) => n + 1)), []);
  useEffect(() => subscribeOptimisticShipmentStatus(() => bumpOptimistic((n) => n + 1)), []);

  const unifiedSnapshot = useMemo(
    () =>
      assertIsSnapshotConsumer(
        getUnifiedShipmentSnapshot({
          ref: trackRef,
          code: trackRef,
          trackRef,
          loadCode: trackRef,
          assignedCarrierId,
          assigned_carrier_id: assignedCarrierId,
          status: shipmentStatus,
          shipmentStatus,
          flowType,
          role: effectiveRole
        }),
        'useShipmentTracking'
      ),
    [trackRef, assignedCarrierId, shipmentStatus, flowType, effectiveRole, optimistic?.ts]
  );

  const safeShipment = useMemo(
    () => normalizeContractFields(unifiedSnapshot.contractFields ?? {}),
    [unifiedSnapshot]
  );

  const localRef = useMemo(
    () => getTrackingRef(safeShipment) || getTrackingRef({ trackRef, code: trackRef }),
    [safeShipment, trackRef]
  );

  const [payload, setPayload] = useState(() =>
    localRef ? getCachedTrackingPayload(localRef) : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fetchGenerationRef = useRef(0);
  const fetchTrackRef = useRef(null);
  const socketKey = payload?.refKey || localRef;

  const contractActivated = Boolean(unifiedSnapshot.contractActivated);
  const trackingFlags = unifiedSnapshot.tracking ?? EMPTY_UNIFIED_SNAPSHOT.tracking;
  const permissions = unifiedSnapshot.permissions ?? EMPTY_UNIFIED_SNAPSHOT.permissions;
  const effectiveShipmentStatus =
    getOptimisticShipmentStatus(localRef) ??
    shipmentStatus ??
    unifiedSnapshot.shipmentStatus ??
    optimistic?.shipmentStatus ??
    null;
  const effectiveTrackingEnabled = Boolean(trackingFlags.enabled) || trackingEnabled;
  const hasActiveRow = Boolean(trackingFlags.isHydrated);

  const uiState = useMemo(() => {
    const isCarrier = String(effectiveRole || '').toLowerCase() === 'carrier';
    const base = unifiedSnapshot.uiState ?? EMPTY_UNIFIED_SNAPSHOT.uiState;
    const restTrackable = isActiveShipmentTrackable({
      shipmentStatus: effectiveShipmentStatus,
      trackingEnabled: effectiveTrackingEnabled
    });
    const gate =
      enabled &&
      (contractActivated ||
        (hasActiveRow && (restTrackable || Boolean(trackingFlags.enabled))));
    const trackLive = gate || Boolean(base.canTrack) || contractActivated;
    return {
      ...base,
      status: effectiveShipmentStatus || base.status || 'posted',
      canUpdateStatus: Boolean(permissions.canUpdateStatus),
      showCarrierAdvance: Boolean(permissions.showCarrierAdvance),
      contractActivated: Boolean(base.contractActivated) || contractActivated,
      shipmentActive: Boolean(base.shipmentActive) || contractActivated,
      statusEngineUnlocked: Boolean(base.statusEngineUnlocked) || contractActivated,
      trackingEnabled: effectiveTrackingEnabled || Boolean(base.trackingEnabled),
      canTrack: trackLive,
      trackingActive: trackLive,
      contractActive: trackLive || Boolean(base.contractActive) || contractActivated,
      isActive: trackLive || contractActivated,
      showLiveMap: trackLive,
      showLiveDriver: trackLive,
      allowSocketJoin: trackLive,
      allowGpsPublish: trackLive && isCarrier
    };
  }, [
    unifiedSnapshot,
    permissions,
    trackingFlags,
    effectiveRole,
    hasActiveRow,
    enabled,
    effectiveShipmentStatus,
    effectiveTrackingEnabled,
    contractActivated
  ]);

  const trackingGate =
    enabled &&
    (contractActivated ||
      (hasActiveRow &&
        (isActiveShipmentTrackable({
          shipmentStatus: effectiveShipmentStatus,
          trackingEnabled: effectiveTrackingEnabled
        }) ||
          Boolean(uiState.unifiedContract?.trackingEnabled))));
  const gpsAllowed = shareLive && trackingGate && uiState.allowGpsPublish;

  const { position: livePos, error: geoError } = useLiveLocation(gpsAllowed && Boolean(localRef));

  const applyPipeline = useCallback(
    (prev, incoming, source, allowCatchUp = false) => {
      if (!incoming) return prev;
      const out = processTrackingPipeline(localRef, prev, incoming, { source, allowCatchUp });
      return out.payload ?? prev ?? getCachedTrackingPayload(localRef);
    },
    [localRef]
  );

  const fetchTrack = useCallback(
    async ({ silent = false, reconnectSnapshot = false } = {}) => {
      if (!enabled || !localRef) {
        if (!getOptimisticActivation(localRef)?.contractActivated) {
          setPayload(null);
        }
        setLoading(false);
        setError('');
        return;
      }
      const generation = fetchGenerationRef.current;
      if (!silent) setLoading(true);
      if (!silent) setError('');
      try {
        const res = await api.get(`/shipments/track/${encodeURIComponent(localRef)}`, {
          skipGlobalErrorToast: true
        });
        if (generation !== fetchGenerationRef.current) return;
        const normalized = sanitizeTrackingPayload(normalizeTracking(res?.data) || res?.data);
        setPayload((prev) => {
          const base = hydrateTrackingFromCache(localRef, prev);
          const next = applyPipeline(base, normalized, 'rest', reconnectSnapshot);
          return trackingPayloadEqual(prev, next) ? prev : next;
        });
      } catch (e) {
        if (generation !== fetchGenerationRef.current) return;
        if (!silent) {
          setError(e?.message || t('pages.tracking.loadFailed'));
        }
        setPayload((prev) => prev || getCachedTrackingPayload(localRef));
      } finally {
        if (generation === fetchGenerationRef.current && !silent) setLoading(false);
      }
    },
    [enabled, localRef, t, applyPipeline]
  );

  fetchTrackRef.current = fetchTrack;

  useEffect(() => {
    const reset = () => {
      bumpTrackingFetchGeneration(localRef);
      fetchGenerationRef.current += 1;
      setPayload(null);
      setError('');
      setLoading(false);
      clearAllTrackingCaches();
      clearAllTrackingSequencers();
      clearAllTrackingSmoothing();
      clearTrackingJoinQueue();
    };
    window.addEventListener('tp:role-switched', reset);
    window.addEventListener('tp:session-cleared', reset);
    return () => {
      window.removeEventListener('tp:role-switched', reset);
      window.removeEventListener('tp:session-cleared', reset);
    };
  }, []);

  useEffect(() => {
    if (!hasActiveRow || !enabled || !localRef) {
      if (!contractActivated) {
        setPayload(null);
      }
      setError('');
      setLoading(false);
      return undefined;
    }

    fetchGenerationRef.current += 1;
    setError('');
    setPayload((prev) => hydrateTrackingFromCache(localRef, prev));
    fetchTrack({ silent: contractActivated });

    return () => {
      fetchGenerationRef.current += 1;
    };
  }, [fetchTrack, enabled, localRef, hasActiveRow, contractActivated]);

  const applyUpdate = useCallback(
    (incoming) => {
      if (!incoming) return;
      setPayload((prev) => {
        if (!matchesTrackingPayload(incoming, localRef, socketKey, prev?.refKey, prev?.loadId)) {
          return prev;
        }
        const next = applyPipeline(prev, incoming, 'socket', false);
        return trackingPayloadEqual(prev, next) ? prev : next;
      });
    },
    [localRef, socketKey, applyPipeline]
  );

  useEffect(() => {
    if (!registerTrackingHandler || !enabled || !localRef) return undefined;
    return registerTrackingHandler(applyUpdate);
  }, [registerTrackingHandler, applyUpdate, enabled, localRef]);

  useEffect(() => {
    if (!enabled || !localRef) return undefined;
    const runThrottledFetch = (opts = {}) => {
      scheduleThrottledTrackingFetch(localRef, () =>
        fetchTrackRef.current?.({ silent: true, ...opts })
      );
    };
    const onTrackingRefresh = (e) => {
      const ref = String(e?.detail?.ref || '').trim();
      if (ref && ref !== localRef && ref !== socketKey) return;
      runThrottledFetch();
    };
    const onLegacyRefresh = (e) => {
      if (e?.detail?.scope === 'all' || !e?.detail?.scope) return;
      if (e?.detail?.scope !== 'shipments' && e?.detail?.scope !== 'tracking') return;
      if (e?.detail?.atomicSync) return;
      runThrottledFetch();
    };
    const onContractSync = (e) => {
      const ref = String(e?.detail?.ref || '').trim();
      if (!ref || (ref !== localRef && ref !== socketKey)) return;
      runThrottledFetch({ reconnectSnapshot: e?.detail?.source === 'fallback' });
    };
    const onStatusUpdated = (e) => {
      const ref = String(e?.detail?.ref || '').trim();
      if (!ref || (ref !== localRef && ref !== socketKey)) return;
      runThrottledFetch();
    };
    window.addEventListener('tp:tracking-refresh', onTrackingRefresh);
    window.addEventListener('tp:shipments-refresh', onTrackingRefresh);
    window.addEventListener('tp:realtime-refresh', onLegacyRefresh);
    window.addEventListener('tp:contract-sync', onContractSync);
    window.addEventListener('tp:shipment-status-updated', onStatusUpdated);
    return () => {
      window.removeEventListener('tp:tracking-refresh', onTrackingRefresh);
      window.removeEventListener('tp:shipments-refresh', onTrackingRefresh);
      window.removeEventListener('tp:realtime-refresh', onLegacyRefresh);
      window.removeEventListener('tp:contract-sync', onContractSync);
      window.removeEventListener('tp:shipment-status-updated', onStatusUpdated);
    };
  }, [enabled, localRef, socketKey, fetchTrack]);

  useEffect(() => {
    if (!enabled || !localRef) return undefined;
    const onReconnectSnapshot = (e) => {
      const ref = String(e.detail?.ref || '').trim();
      if (ref !== localRef && ref !== socketKey) return;
      scheduleThrottledTrackingFetch(localRef, () =>
        fetchTrackRef.current?.({ silent: true, reconnectSnapshot: true })
      );
    };
    window.addEventListener('tp:tracking-snapshot', onReconnectSnapshot);
    return () => window.removeEventListener('tp:tracking-snapshot', onReconnectSnapshot);
  }, [enabled, localRef, socketKey, fetchTrack]);

  const socket = getSocket?.() || null;
  const socketConnected = socketStatus === 'connected' || Boolean(socket?.connected);
  const { publishLocation } = useTrackingSocket({
    socket,
    sessionRef: localRef,
    aliasRefs: [socketKey],
    enabled: trackingGate && Boolean(localRef)
  });

  useEffect(() => {
    if (!trackingGate || !localRef) {
      clearTrackingJoinRequest(localRef);
      return undefined;
    }

    let retry = null;
    const aliasRefs = [socketKey].filter(Boolean);
    requestTrackingJoin(localRef, aliasRefs);

    const tryJoin = () => {
      const activeSocket = getSocket?.();
      if (!activeSocket?.connected) return false;
      emitTrackingJoin(activeSocket, localRef, aliasRefs);
      flushTrackingJoinQueue(activeSocket, emitTrackingJoin);
      return true;
    };

    if (!tryJoin()) {
      retry = setTimeout(() => tryJoin(), 1000);
    }

    return () => {
      if (retry) clearTimeout(retry);
    };
  }, [trackingGate, localRef, socketKey, socketConnected, getSocket]);

  useEffect(() => {
    if (!trackingGate || !localRef) return undefined;
    const activeSocket = getSocket?.();
    if (!activeSocket || !socketConnected) return undefined;

    const onConnected = () => {
      const sock = getSocket?.();
      if (!sock?.connected) return;
      flushTrackingJoinQueue(sock, emitTrackingJoin, { delayRetryMs: 1000 });
      emitTrackingJoin(sock, localRef, [socketKey].filter(Boolean));
    };

    activeSocket.on('connect', onConnected);
    return () => {
      try {
        activeSocket.off('connect', onConnected);
      } catch {
        /* ignore */
      }
    };
  }, [trackingGate, localRef, socketKey, socketConnected, getSocket]);

  const liveLat = livePos?.[0];
  const liveLng = livePos?.[1];

  useEffect(() => {
    const postRef = localRef;
    if (!gpsAllowed || liveLat == null || liveLng == null || !postRef) return;
    if (!canEmitGps(postRef)) return;

    publishLocation(liveLat, liveLng);
    api
      .put(`/shipments/${encodeURIComponent(postRef)}/location`, { lat: liveLat, lng: liveLng }, {
        skipGlobalErrorToast: true
      })
      .then((res) => {
        if (res?.data) applyUpdate(res.data);
      })
      .catch(() => {});
  }, [gpsAllowed, liveLat, liveLng, localRef, publishLocation, applyUpdate]);

  const displayPayload = useMemo(() => {
    const storeRow = localRef ? findActiveShipmentRow(getActiveShipmentList(), localRef) : null;
    const shellOrigin = storeRow?.origin || '';
    const shellDestination = storeRow?.destination || '';
    const base =
      payload ||
      (contractActivated && localRef ? getCachedTrackingPayload(localRef) : null);
    if (base) {
      const enriched = {
        ...base,
        origin: base.origin || shellOrigin,
        destination: base.destination || shellDestination
      };
      if (
        contractActivated &&
        livePos &&
        !enriched?.tracking?.currentLocation &&
        !enriched?.tracking?.location
      ) {
        return {
          ...enriched,
          tracking: {
            ...(enriched.tracking || {}),
            status: enriched.tracking?.status || effectiveShipmentStatus || 'booked',
            currentLocation: livePos
          }
        };
      }
      return enriched;
    }
    if (!contractActivated || !localRef) return null;
    return {
      refKey: localRef,
      origin: shellOrigin,
      destination: shellDestination,
      tracking: {
        status: effectiveShipmentStatus || 'booked',
        currentLocation: livePos || undefined,
        locationUnavailable: !livePos
      },
      liveTrackingMap: { coordinates: livePos ? [livePos] : [] }
    };
  }, [payload, contractActivated, localRef, effectiveShipmentStatus, livePos]);

  return {
    trackingData: displayPayload,
    uiState,
    loading,
    error,
    geoError,
    livePos,
    refetch: fetchTrack,
    trackKey: socketKey
  };
}
