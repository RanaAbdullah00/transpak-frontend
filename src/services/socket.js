import { io } from 'socket.io-client';

/**
 * Socket.io client (JWT in handshake). Server-delivered events only.
 */
export function createSocketClient({
  token,
  onNotification,
  onTracking,
  onChatMessage,
  onChatSeen
}) {
  const url =
    import.meta.env.VITE_SOCKET_URL ||
    (import.meta.env.DEV ? window.location.origin : 'http://localhost:5000');

  let socket = null;

  if (!token) {
    return {
      socket: null,
      disconnect: () => {}
    };
  }

  try {
    socket = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true
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
