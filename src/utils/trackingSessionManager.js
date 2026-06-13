import {
  flushTrackingJoinQueue,
  clearTrackingJoinQueue
} from './trackingJoinQueue.js';
import { isTrackingSocketReady } from './trackingSocketReady.js';

/**
 * In-memory tracking session registry (per browser tab).
 * Ensures one socket join + controlled GPS cadence per shipment ref.
 */

const sessions = new Map();let reconnectHandler = null;
let reconnectSocketId = null;
const reconnectSnapshotAt = new Map();

const GPS_MIN_INTERVAL_MS = Number(import.meta.env.VITE_TRACKING_GPS_MIN_MS || 10000);
const GPS_MIN_MOVE_METERS = Number(import.meta.env.VITE_TRACKING_GPS_MIN_MOVE_M || 35);

function movedEnoughMeters(prev, next) {
  if (!prev || !next) return true;
  const lat1 = Number(prev[0]);
  const lng1 = Number(prev[1]);
  const lat2 = Number(next[0]);
  const lng2 = Number(next[1]);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return true;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const meters = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return meters >= GPS_MIN_MOVE_METERS;
}

function primaryKey(ref) {
  return String(ref || '').trim();
}

/**
 * @param {string} primaryRef
 * @param {string[]} aliasRefs
 */
export function joinSession(primaryRef, aliasRefs = []) {
  const key = primaryKey(primaryRef);
  if (!key) return { key: '', isFirstConsumer: false, refs: [] };

  let row = sessions.get(key);
  if (!row) {
    row = {
      refs: new Set(),
      consumers: 0,
      socketJoined: false,
      lastGpsEmitAt: 0,
      lastGpsCoords: null
    };
    sessions.set(key, row);
  }

  row.consumers += 1;
  row.refs.add(key);
  aliasRefs.forEach((r) => {
    const a = primaryKey(r);
    if (a) row.refs.add(a);
  });

  return {
    key,
    isFirstConsumer: row.consumers === 1,
    refs: [...row.refs]
  };
}

/**
 * @param {string} primaryRef
 */
export function leaveSession(primaryRef) {
  const key = primaryKey(primaryRef);
  if (!key) return { released: false, refs: [] };

  const row = sessions.get(key);
  if (!row) return { released: false, refs: [] };

  row.consumers = Math.max(0, row.consumers - 1);
  if (row.consumers > 0) {
    return { released: false, refs: [...row.refs] };
  }

  const refs = [...row.refs];
  sessions.delete(key);
  return { released: true, refs };
}

export function isSessionActive(primaryRef) {
  const key = primaryKey(primaryRef);
  return key ? sessions.has(key) : false;
}

export function shouldSocketJoin(primaryRef) {
  const row = sessions.get(primaryKey(primaryRef));
  return Boolean(row && !row.socketJoined);
}

export function markSocketJoined(primaryRef) {
  const row = sessions.get(primaryKey(primaryRef));
  if (row) row.socketJoined = true;
}

export function resetAllSocketJoinFlags() {
  sessions.forEach((row) => {
    row.socketJoined = false;
  });
}

export function canEmitGps(primaryRef, minMs = GPS_MIN_INTERVAL_MS, coords = null) {
  const row = sessions.get(primaryKey(primaryRef));
  if (!row) return false;
  const now = Date.now();
  if (now - row.lastGpsEmitAt < minMs) return false;
  if (coords && row.lastGpsCoords && !movedEnoughMeters(row.lastGpsCoords, coords)) {
    return false;
  }
  row.lastGpsEmitAt = now;
  if (coords) row.lastGpsCoords = coords;
  return true;
}

export function getActiveSessions() {
  return [...sessions.entries()]
    .filter(([, row]) => row.consumers > 0)
    .map(([key, row]) => ({ key, refs: [...row.refs] }));
}

/**
 * Re-join all active tracking rooms once after socket reconnect (global, single listener).
 * @param {import('socket.io-client').Socket|null} socket
 */
export function bindTrackingReconnect(socket) {
  if (!socket) return;

  const socketId = socket.id || 'pending';
  if (reconnectHandler && reconnectSocketId === socketId) return;

  if (reconnectHandler) {
    try {
      socket.off('connect', reconnectHandler);
      socket.io?.off('reconnect', reconnectHandler);
    } catch {
      /* ignore */
    }
  }

  reconnectHandler = () => {
    resetAllSocketJoinFlags();
    flushTrackingJoinQueue(socket, emitTrackingJoin, { delayRetryMs: 1000 });
    getActiveSessions().forEach(({ key, refs }) => {
      refs.forEach((ref) => {
        socket.emit('tracking:join', { refKey: ref });
      });
      markSocketJoined(key);
      const now = Date.now();
      const last = reconnectSnapshotAt.get(key) || 0;
      if (now - last >= 4000) {
        reconnectSnapshotAt.set(key, now);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('tp:tracking-snapshot', { detail: { ref: key } })
          );
        }
      }
    });
  };
  socket.on('connect', reconnectHandler);
  socket.io?.on('reconnect', reconnectHandler);
  reconnectSocketId = socketId;
}

export function clearTrackingSessions() {
  sessions.clear();
  reconnectSnapshotAt.clear();
  clearTrackingJoinQueue();
}

export function emitTrackingJoin(socket, primaryRef, aliasRefs = [], { socketStatus = 'connected' } = {}) {
  if (!socket || !primaryRef || !isTrackingSocketReady(socketStatus, socket)) return;
  const key = primaryKey(primaryRef);
  if (!shouldSocketJoin(key)) return;

  const row = sessions.get(key);
  const refs = row ? [...row.refs] : [key, ...aliasRefs.map(primaryKey).filter(Boolean)];
  const unique = [...new Set(refs.length ? refs : [key, ...aliasRefs])];
  unique.forEach((ref) => {
    socket.emit('tracking:join', { refKey: ref });
  });
  markSocketJoined(key);
}
