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
import { resolveContractConsistency } from '../utils/contractConsistencyResolver.js';
import { normalizeContractFields } from '../utils/contractFieldNormalizer.js';
import { getTrackingRef } from '../utils/trackingRefResolver.js';
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
import { isActiveShipmentTrackable } from '../utils/activeShipmentModel.js';
import {
  scheduleThrottledTrackingFetch,
  bumpTrackingFetchGeneration
} from '../utils/productionStabilityLayer.js';
import {
  getOptimisticActivation,
  mergeOptimisticContractInput,
  subscribeOptimisticActivation
} from '../utils/contractActivationLayer.js';

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

  const safeShipment = useMemo(() => {
    const merged = mergeOptimisticContractInput({
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
    });
    return normalizeContractFields(merged);
  }, [trackRef, assignedCarrierId, shipmentStatus, flowType, effectiveRole, optimistic?.ts]);

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

  const contractActivated = Boolean(optimistic?.contractActivated);
  const effectiveShipmentStatus = shipmentStatus ?? optimistic?.shipmentStatus ?? null;
  const effectiveTrackingEnabled = trackingEnabled || contractActivated;
  const hasActiveRow = effectiveShipmentStatus != null || contractActivated;

  const uiState = useMemo(() => {
    const isCarrier = String(effectiveRole || '').toLowerCase() === 'carrier';
    const resolved = resolveContractConsistency({
      restShipment: safeShipment,
      trackingPayload: null,
      role: effectiveRole
    });
    const unified = resolved.uiState.unifiedContract;
    const contractTrackable = Boolean(unified?.trackingEnabled) || contractActivated;
    const restTrackable = isActiveShipmentTrackable({
      shipmentStatus: effectiveShipmentStatus,
      trackingEnabled: effectiveTrackingEnabled
    });
    const gate =
      enabled && (contractActivated || (hasActiveRow && (restTrackable || contractTrackable)));
    const trackLive = gate || Boolean(resolved.uiState.canTrack) || contractActivated;
    const {
      canUpdateStatus,
      showCarrierAdvance,
      upcomingStatus,
      unifiedContract,
      contractActivated: uiContractActivated,
      shipmentActive,
      statusEngineUnlocked,
      ...trackingNeutralUi
    } = resolved.uiState;
    const permissionUnlocked =
      canUpdateStatus ||
      (contractActivated &&
        isCarrier &&
        Boolean(String(unified?.ref || trackRef || '').trim()));
    return {
      ...trackingNeutralUi,
      status: effectiveShipmentStatus || resolved.uiState.status,
      canUpdateStatus: permissionUnlocked,
      showCarrierAdvance: permissionUnlocked,
      upcomingStatus,
      unifiedContract,
      contractActivated: uiContractActivated || contractActivated,
      shipmentActive: shipmentActive || contractActivated,
      statusEngineUnlocked: statusEngineUnlocked || contractActivated,
      trackingEnabled: effectiveTrackingEnabled || Boolean(resolved.uiState.trackingEnabled),
      canTrack: trackLive,
      trackingActive: trackLive,
      contractActive: trackLive || resolved.uiState.contractActive || contractActivated,
      isActive: trackLive || contractActivated,
      showLiveMap: trackLive,
      showLiveDriver: trackLive,
      allowSocketJoin: trackLive,
      allowGpsPublish: trackLive && isCarrier
    };
  }, [
    effectiveRole,
    safeShipment,
    hasActiveRow,
    enabled,
    effectiveShipmentStatus,
    effectiveTrackingEnabled,
    contractActivated,
    optimistic?.ts,
    trackRef
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
        setPayload(null);
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
    const onRefresh = (e) => {
      if (e?.detail?.scope !== 'shipments') return;
      if (e?.detail?.atomicSync) return;
      runThrottledFetch();
    };
    const onContractSync = (e) => {
      const ref = String(e?.detail?.ref || '').trim();
      if (!ref || (ref !== localRef && ref !== socketKey)) return;
      runThrottledFetch({ reconnectSnapshot: e?.detail?.source === 'fallback' });
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    window.addEventListener('tp:contract-sync', onContractSync);
    return () => {
      window.removeEventListener('tp:realtime-refresh', onRefresh);
      window.removeEventListener('tp:contract-sync', onContractSync);
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
    if (payload) return payload;
    if (!contractActivated || !localRef) return null;
    const cached = getCachedTrackingPayload(localRef);
    if (cached) return cached;
    return {
      refKey: localRef,
      origin: '',
      destination: '',
      tracking: {
        status: effectiveShipmentStatus || 'booked',
        locationUnavailable: true
      },
      liveTrackingMap: { coordinates: [] }
    };
  }, [payload, contractActivated, localRef, effectiveShipmentStatus]);

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
