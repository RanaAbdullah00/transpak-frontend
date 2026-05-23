import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../services/api.js';
import { normalizeTracking } from '../adapters/normalize.js';
import { AppContext } from '../context/AppContext.jsx';
import { useLiveLocation } from './useLiveLocation.js';
import { useTrackingSocket } from './useTrackingSocket.js';
import { mergeTrackingPayload, matchesTrackingPayload } from '../utils/trackingMerge.js';

const SHIPPER_POLL_MS = 60000;

/**
 * Shared REST + socket tracking for dashboards and tracking page.
 * @param {{ trackRef?: string|null, shareLive?: boolean, enabled?: boolean }}
 */
export function useShipmentTracking({ trackRef, shareLive = false, enabled = true }) {
  const localRef = String(trackRef || '').trim();
  const { registerTrackingHandler, getSocket } = useContext(AppContext) || {};
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const lastPostedRef = useRef(0);
  const socketKey = payload?.refKey || localRef;

  const { position: livePos, error: geoError } = useLiveLocation(shareLive && Boolean(socketKey));

  const fetchTrack = useCallback(async ({ silent = false } = {}) => {
    if (!enabled || !localRef) {
      setPayload(null);
      setLoading(false);
      setError('');
      return;
    }
    if (!silent) setLoading(true);
    if (!silent) setError('');
    try {
      const res = await api.get(`/shipments/track/${encodeURIComponent(localRef)}`);
      const normalized = normalizeTracking(res?.data) || null;
      setPayload((prev) => {
        if (!prev || !normalized) return normalized;
        return mergeTrackingPayload(prev, normalized);
      });
    } catch (e) {
      if (!silent) {
        setError(e?.message || 'Failed to load tracking');
        setPayload(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [enabled, localRef]);

  useEffect(() => {
    if (!enabled || !localRef) {
      setPayload(null);
      return;
    }
    setPayload(null);
    lastPostedRef.current = 0;
    fetchTrack();
  }, [fetchTrack, enabled, localRef]);

  useEffect(() => {
    if (!enabled || !localRef || shareLive) return undefined;
    const id = setInterval(() => {
      fetchTrack({ silent: true });
    }, SHIPPER_POLL_MS);
    return () => clearInterval(id);
  }, [enabled, localRef, shareLive, fetchTrack]);

  const applyUpdate = useCallback(
    (incoming) => {
      if (!incoming) return;
      setPayload((prev) => {
        if (!matchesTrackingPayload(incoming, localRef, socketKey, prev?.refKey, prev?.loadId)) {
          return prev;
        }
        return mergeTrackingPayload(prev, incoming);
      });
    },
    [localRef, socketKey]
  );

  useEffect(() => {
    if (!registerTrackingHandler || !enabled || !localRef) return undefined;
    return registerTrackingHandler(applyUpdate);
  }, [registerTrackingHandler, applyUpdate, enabled, localRef]);

  const socket = getSocket?.() || null;
  const { publishLocation } = useTrackingSocket({
    socket,
    refKey: socketKey,
    alternateRef: localRef,
    enabled: enabled && Boolean(socketKey || localRef)
  });

  const liveLat = livePos?.[0];
  const liveLng = livePos?.[1];

  useEffect(() => {
    const postRef = socketKey || localRef;
    if (!shareLive || liveLat == null || liveLng == null || !postRef) return;
    const now = Date.now();
    if (now - lastPostedRef.current < 12000) return;
    lastPostedRef.current = now;
    publishLocation(liveLat, liveLng);
    api
      .put(`/shipments/${encodeURIComponent(postRef)}/location`, { lat: liveLat, lng: liveLng }, { skipGlobalErrorToast: true })
      .then((res) => {
        if (res?.data) applyUpdate(res.data);
      })
      .catch(() => {});
  }, [shareLive, liveLat, liveLng, socketKey, localRef, publishLocation, applyUpdate]);

  return {
    trackingData: payload,
    loading,
    error,
    geoError,
    livePos,
    refetch: fetchTrack,
    trackKey: socketKey
  };
}
