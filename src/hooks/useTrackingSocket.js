import { useCallback, useEffect, useRef } from 'react';
import {
  bindTrackingReconnect,
  emitTrackingJoin,
  joinSession,
  leaveSession
} from '../utils/trackingSessionManager.js';
import { getOrCreateTraceId } from '../utils/traceContext.js';

/**
 * Join tracking room + publish lat/lng. Updates via AppContext registerTrackingHandler.
 * Uses trackingSessionManager for single join per ref per session.
 */
export function useTrackingSocket({ socket, sessionRef, aliasRefs = [], enabled = false }) {
  const primaryRef = String(sessionRef || '').trim();
  const aliases = aliasRefs.map((r) => String(r || '').trim()).filter(Boolean);
  const joinedRef = useRef(null);

  const emitJoin = useCallback(() => {
    if (!socket || !enabled || !primaryRef) return;
    emitTrackingJoin(socket, primaryRef, aliases);
  }, [socket, enabled, primaryRef, aliases]);

  useEffect(() => {
    if (!enabled || !primaryRef) {
      if (joinedRef.current) {
        leaveSession(joinedRef.current);
        joinedRef.current = null;
      }
      return undefined;
    }

    if (joinedRef.current && joinedRef.current !== primaryRef) {
      leaveSession(joinedRef.current);
    }

    joinSession(primaryRef, aliases);
    joinedRef.current = primaryRef;

    bindTrackingReconnect(socket);
    emitJoin();
    return () => {
      if (joinedRef.current) {
        leaveSession(joinedRef.current);
        joinedRef.current = null;
      }
    };
  }, [socket, enabled, primaryRef, aliases, emitJoin]);

  const publishLocation = useCallback(
    (lat, lng) => {
      if (!socket || !primaryRef || !enabled) return;
      const la = Number(lat);
      const ln = Number(lng);
      if (!Number.isFinite(la) || !Number.isFinite(ln)) return;
      socket.emit('tracking:location', {
        refKey: primaryRef,
        lat: la,
        lng: ln,
        traceId: getOrCreateTraceId()
      });
    },
    [socket, primaryRef, enabled]
  );

  return { publishLocation };
};
