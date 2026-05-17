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

  if (!token) {
    return {
      socket: null,
      disconnect: () => {}
    };
  }

  if (!url) {
    console.warn('[socket] No backend URL — set VITE_API_URL (or VITE_SOCKET_URL) in production');
    return { socket: null, disconnect: () => {} };
  }

  try {
    socket = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 800
    });

    let hadConnected = false;
    socket.on('connect', () => {
      if (hadConnected) onReconnect?.();
      hadConnected = true;
    });

    socket.on('notification:new', (n) => onNotification?.(n));
    socket.on('tracking:update', (p) => onTracking?.(p));
    socket.on('chat:message', (m) => onChatMessage?.(m));
    socket.on('chat:seen', (p) => onChatSeen?.(p));
  } catch {
    socket = null;
  }

  return {
    socket,
    disconnect: () => {
      try {
        socket?.disconnect();
      } catch {
        // ignore
      }
    }
  };
}
