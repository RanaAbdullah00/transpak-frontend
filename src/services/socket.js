import { io } from 'socket.io-client';
import { getBackendOrigin } from '../utils/backendOrigin.js';

const RECONNECT_REFRESH_MIN_MS = Number(import.meta.env.VITE_SOCKET_RECONNECT_MIN_MS || 2200);
const PROD_MAX_RECONNECT_ATTEMPTS = Number(import.meta.env.VITE_SOCKET_MAX_RECONNECT || 30);

/**
 * Socket.io client (JWT in handshake). Server-delivered events only.
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
  const explicitSocket = typeof import.meta.env.VITE_SOCKET_URL === 'string' ? import.meta.env.VITE_SOCKET_URL.trim() : '';
  let url = explicitSocket;
  if (!url) {
    if (import.meta.env.DEV && !import.meta.env.VITE_API_URL?.trim()) {
      url = window.location.origin;
    } else {
      url = getBackendOrigin() || window.location.origin;
    }
  }

  let socket = null;
  let reconnectTimer = null;
  let lastReconnectRefreshAt = 0;
  const handlers = [];

  const registerHandler = (event, fn) => {
    if (!socket || !fn) return;
    socket.on(event, fn);
    handlers.push([event, fn]);
  };

  if (!token) {
    return {
      socket: null,
      disconnect: () => {}
    };
  }

  if (!url) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[socket] No backend URL — set VITE_API_URL (or VITE_SOCKET_URL) in production');
    }
    return { socket: null, disconnect: () => {} };
  }

  const scheduleReconnectRefresh = () => {
    const now = Date.now();
    const elapsed = now - lastReconnectRefreshAt;
    const delay = Math.max(RECONNECT_REFRESH_MIN_MS - elapsed, 0);
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      lastReconnectRefreshAt = Date.now();
      onReconnect?.();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tp:realtime-refresh'));
      }
    }, delay);
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
      reconnectionAttempts: import.meta.env.PROD ? PROD_MAX_RECONNECT_ATTEMPTS : Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.4,
      timeout: 20000
    });

    let hadConnected = false;
    const emitWorkspaceJoin = () => {
      if (ws && socket?.connected) {
        socket.emit('workspace:join', { workspace: ws });
      }
    };

    const onConnect = () => {
      emitWorkspaceJoin();
      onConnectionChange?.(true);
      if (hadConnected) scheduleReconnectRefresh();
      hadConnected = true;
    };

    const onIoReconnect = () => {
      onConnectionChange?.(true);
      emitWorkspaceJoin();
      scheduleReconnectRefresh();
    };

    const onDisconnect = (reason) => {
      onConnectionChange?.(false);
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info('[socket] disconnected:', reason);
      }
    };

    const onConnectError = (err) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[socket] connect_error:', err?.message || err);
      }
    };

    registerHandler('connect', onConnect);
    socket.io.on('reconnect', onIoReconnect);
    handlers.push(['__io_reconnect', onIoReconnect]);

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

  return {
    socket,
    disconnect: () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        if (socket) {
          handlers.forEach(([event, fn]) => {
            if (event === '__io_reconnect') {
              socket.io.off('reconnect', fn);
            } else {
              socket.off(event, fn);
            }
          });
          socket.removeAllListeners();
          socket.disconnect();
        }
      } catch {
        // ignore
      }
      handlers.length = 0;
      socket = null;
    }
  };
}
