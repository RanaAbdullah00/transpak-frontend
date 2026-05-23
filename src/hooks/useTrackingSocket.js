import { useCallback, useEffect } from 'react';

/**
 * Join tracking room + publish lat/lng. Updates are delivered via AppContext registerTrackingHandler.
 */
export function useTrackingSocket({ socket, refKey, alternateRef, enabled = false }) {
  const key = String(refKey || '').trim();
  const alt = String(alternateRef || '').trim();
  const joinRef = key || alt;

  const emitJoin = useCallback(() => {
    if (!socket || !enabled || !joinRef) return;
    socket.emit('tracking:join', { refKey: joinRef });
    if (key && alt && alt !== key) socket.emit('tracking:join', { refKey: alt });
    if (key && alt && key !== joinRef) socket.emit('tracking:join', { refKey: key });
  }, [socket, enabled, joinRef, key, alt]);

  useEffect(() => {
    if (!socket || !enabled || !joinRef) return undefined;
    emitJoin();
    socket.on('connect', emitJoin);
    return () => {
      socket.off('connect', emitJoin);
    };
  }, [socket, enabled, joinRef, emitJoin]);

  const publishLocation = useCallback(
    (lat, lng) => {
      if (!socket || !joinRef) return;
      const la = Number(lat);
      const ln = Number(lng);
      if (!Number.isFinite(la) || !Number.isFinite(ln)) return;
      socket.emit('tracking:location', { refKey: joinRef, lat: la, lng: ln });
    },
    [socket, joinRef]
  );

  return { publishLocation };
}
