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
import { canTrackShipment } from '../utils/shipmentUIState.js';

const TRACK_POLL_MS = Number(import.meta.env.VITE_TRACK_POLL_MS || 8000);

/**
 * Shared REST + socket tracking. canTrack and socket join are driven by API state only.
 */
export function useShipmentTracking({
  trackRef,
  shareLive = false,
  enabled = true,
  role = null,
  assignedCarrierId = null
}) {
  const { t } = useLanguage();
  const { registerTrackingHandler, getSocket, socketStatus } = useContext(AppContext) || {};

  const safeShipment = useMemo(
    () =>
      normalizeContractFields({
        ref: trackRef,
        code: trackRef,
        trackRef,
        loadCode: trackRef,
        assignedCarrierId,
        assigned_carrier_id: assignedCarrierId,
        status: null,
        shipmentStatus: null
      }),
    [trackRef, assignedCarrierId]
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
  const socketKey = payload?.refKey || localRef;

  const uiState = useMemo(() => {
    const resolved = resolveContractConsistency({
      restShipment: safeShipment,
      trackingPayload: payload,
      role
    });
    return resolved.uiState;
  }, [payload, role, safeShipment]);

  const canTrack = uiState.canTrack;
  const gpsAllowed = shareLive && uiState.allowGpsPublish && canTrack;

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

  useEffect(() => {
    const reset = () => {
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
    if (!enabled || !localRef) {
      setPayload(null);
      setError('');
      setLoading(false);
      return undefined;
    }

    fetchGenerationRef.current += 1;
    setError('');
    setPayload((prev) => hydrateTrackingFromCache(localRef, prev));
    fetchTrack();

    return () => {
      fetchGenerationRef.current += 1;
    };
  }, [fetchTrack, enabled, localRef]);

  useEffect(() => {
    if (!enabled || !localRef) return undefined;
    if (socketStatus === 'connected') return undefined;
    const id = setInterval(() => {
      fetchTrack({ silent: true });
    }, TRACK_POLL_MS);
    return () => clearInterval(id);
  }, [enabled, localRef, fetchTrack, socketStatus]);

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
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (
        scope &&
        scope !== 'all' &&
        scope !== 'shipments' &&
        scope !== 'bids' &&
        scope !== 'loads' &&
        scope !== 'space'
      ) {
        return;
      }
      fetchTrack({ silent: true });
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [enabled, localRef, fetchTrack]);

  useEffect(() => {
    if (!enabled || !localRef) return undefined;
    const onReconnectSnapshot = (e) => {
      const ref = String(e.detail?.ref || '').trim();
      if (ref !== localRef && ref !== socketKey) return;
      fetchTrack({ silent: true, reconnectSnapshot: true });
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
    enabled: enabled && canTrack && Boolean(localRef) && uiState?.canTrack
  });

  useEffect(() => {
    if (!enabled || !uiState?.canTrack || !localRef) {
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
  }, [uiState?.canTrack, localRef, socketKey, socketConnected, enabled, getSocket]);

  useEffect(() => {
    if (!enabled || !uiState?.canTrack || !localRef) return undefined;
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
  }, [enabled, uiState?.canTrack, localRef, socketKey, socketConnected, getSocket]);

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

  return {
    trackingData: payload,
    uiState,
    loading,
    error,
    geoError,
    livePos,
    refetch: fetchTrack,
    trackKey: socketKey
  };
}
