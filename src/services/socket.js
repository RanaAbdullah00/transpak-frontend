import { io } from 'socket.io-client';
import { getBackendOrigin } from '../utils/backendOrigin.js';

const RECONNECT_REFRESH_MIN_MS = Number(import.meta.env.VITE_SOCKET_RECONNECT_MIN_MS || 8000);
const MAX_RECONNECT_ATTEMPTS = Number(import.meta.env.VITE_SOCKET_MAX_RECONNECT || 3);

function isAuthConnectError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return /auth|jwt|unauthorized|forbidden|invalid token|not authenticated/.test(msg);
}

/**
 * Socket.io client (JWT in handshake). Server-delivered events only.
 * One instance per session — max 3 reconnect attempts, then static "connection lost".
 */
export function createSocketClient({
  token,
  workspace,
  onNotification,
  onDispatch,
  onTracking,
  onChatMessage,
  onChatSeen,
  onReconnect,
  onConnectionChange
}) {
  let url = getBackendOrigin();
  if (!url && import.meta.env.DEV) {
    url = window.location.origin;
  }

  let socket = null;
  let reconnectTimer = null;
  let lastReconnectRefreshAt = 0;
  let reconnectExhausted = false;
  const handlers = [];

  const registerHandler = (event, fn) => {
    if (!socket || !fn) return;
    socket.on(event, fn);
    handlers.push([event, fn]);
  };

  if (!token) {
    return {
      socket: null,
      disconnect: () => {},
      rejoinWorkspace: () => {}
    };
  }

  if (!url) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[socket] No backend URL — set VITE_API_URL (or VITE_SOCKET_URL) in production');
    }
    return { socket: null, disconnect: () => {}, rejoinWorkspace: () => {} };
  }

  const scheduleReconnectRefresh = () => {
    if (reconnectExhausted) return;
    const now = Date.now();
    const elapsed = now - lastReconnectRefreshAt;
    const delay = Math.max(RECONNECT_REFRESH_MIN_MS - elapsed, 0);
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      if (reconnectExhausted) return;
      lastReconnectRefreshAt = Date.now();
      onReconnect?.();
    }, delay);
  };

  const markExhausted = () => {
    if (reconnectExhausted) return;
    reconnectExhausted = true;
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    try {
      if (socket?.io) socket.io.reconnection(false);
      socket?.disconnect();
    } catch {
      /* ignore */
    }
    onConnectionChange?.(false, { exhausted: true });
  };

  try {
    const ws =
      workspace === 'shipper' || workspace === 'carrier' || workspace === 'admin'
        ? workspace
        : null;
    socket = io(url, {
      auth: { token, ...(ws ? { workspace: ws } : {}) },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 5000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.4,
      timeout: 20000
    });

    let lastWorkspaceJoin = null;
    const emitWorkspaceJoin = () => {
      if (ws && socket?.connected && lastWorkspaceJoin !== ws) {
        lastWorkspaceJoin = ws;
        socket.emit('workspace:join', { workspace: ws });
      }
    };

    const onConnect = () => {
      reconnectExhausted = false;
      emitWorkspaceJoin();
      onConnectionChange?.(true);
    };

    const onIoReconnect = () => {
      if (reconnectExhausted) return;
      onConnectionChange?.(true);
      emitWorkspaceJoin();
      scheduleReconnectRefresh();
    };

    const onDisconnect = (reason) => {
      if (reconnectExhausted) return;
      onConnectionChange?.(false, { reconnecting: reason !== 'io client disconnect' });
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info('[socket] disconnected:', reason);
      }
    };

    const onConnectError = (err) => {
      if (isAuthConnectError(err)) {
        markExhausted();
        return;
      }
      if (!reconnectExhausted) {
        onConnectionChange?.(false, { reconnecting: true });
      }
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[socket] connect_error:', err?.message || err);
      }
    };

    const onReconnectFailed = () => {
      markExhausted();
    };

    registerHandler('connect', onConnect);
    socket.io.on('reconnect', onIoReconnect);
    handlers.push(['__io_reconnect', onIoReconnect]);
    socket.io.on('reconnect_failed', onReconnectFailed);
    handlers.push(['__io_reconnect_failed', onReconnectFailed]);

    registerHandler('disconnect', onDisconnect);
    registerHandler('connect_error', onConnectError);

    registerHandler('dispatch:event', (d) => onDispatch?.(d));
    registerHandler('notification:new', (n) => onNotification?.(n));
    registerHandler('notifications:batch', (payload) => {
      const items = Array.isArray(payload?.items) ? payload.items : [];
      items.forEach((n) => onNotification?.(n));
    });
    registerHandler('tracking:update', (p) => onTracking?.(p));
    registerHandler('chat:message', (m) => onChatMessage?.(m));
    registerHandler('chat:seen', (p) => onChatSeen?.(p));
  } catch {
    socket = null;
  }

  let lastRejoinWorkspace = null;
  const rejoinWorkspace = (nextWorkspace) => {
    const w =
      nextWorkspace === 'shipper' || nextWorkspace === 'carrier' || nextWorkspace === 'admin'
        ? nextWorkspace
        : null;
    if (w && socket?.connected && lastRejoinWorkspace !== w) {
      lastRejoinWorkspace = w;
      socket.emit('workspace:join', { workspace: w });
    }
  };

  return {
    socket,
    rejoinWorkspace,
    disconnect: () => {
      reconnectExhausted = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        if (socket) {
          handlers.forEach(([event, fn]) => {
            if (event === '__io_reconnect') {
              socket.io?.off('reconnect', fn);
            } else if (event === '__io_reconnect_failed') {
              socket.io?.off('reconnect_failed', fn);
            } else {
              socket.off(event, fn);
            }
          });
          socket.io?.off('reconnect');
          socket.io?.off('reconnect_failed');
          socket.removeAllListeners();
          if (socket.io?.removeAllListeners) socket.io.removeAllListeners();
          socket.disconnect();
        }
      } catch {
        // ignore
      }
      handlers.length = 0;
      socket = null;
    }
  };
};
