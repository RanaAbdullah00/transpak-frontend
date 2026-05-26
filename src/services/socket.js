import { io } from 'socket.io-client';
import { getBackendOrigin } from '../utils/backendOrigin.js';

/**
 * Socket.io client (JWT in handshake). Server-delivered events only.
 */
export function createSocketClient({
  token,
  onNotification,
  onTracking,
  onChatMessage,
  onChatSeen,
  onReconnect
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
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      onReconnect?.();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tp:realtime-refresh'));
      }
    }, 400);
  };

  try {
    socket = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000,
      timeout: 20000
    });

    let hadConnected = false;
    socket.on('connect', () => {
      if (hadConnected) scheduleReconnectRefresh();
      hadConnected = true;
    });

    socket.io.on('reconnect', () => {
      scheduleReconnectRefresh();
    });

    socket.on('disconnect', (reason) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info('[socket] disconnected:', reason);
      }
    });

    socket.on('connect_error', (err) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[socket] connect_error:', err?.message || err);
      }
    });

    socket.on('notification:new', (n) => onNotification?.(n));
    socket.on('notifications:batch', (payload) => {
      const items = Array.isArray(payload?.items) ? payload.items : [];
      items.forEach((n) => onNotification?.(n));
    });
    socket.on('tracking:update', (p) => onTracking?.(p));
    socket.on('chat:message', (m) => onChatMessage?.(m));
    socket.on('chat:seen', (p) => onChatSeen?.(p));
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
        socket?.removeAllListeners();
        socket?.disconnect();
      } catch {
        // ignore
      }
    }
  };
}
