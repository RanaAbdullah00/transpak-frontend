/**
 * Lightweight Socket.io stub (no database).
 * Real-time messaging/tracking for the FYP is handled by transpak-backend.
 */
export function registerSockets(io) {
  io.on('connection', (socket) => {
    socket.on('auth:join', ({ userId }) => {
      if (!userId) return;
      socket.join(`user:${userId}`);
    });

    socket.on('tracking:update', (payload) => {
      if (payload?.loadId) {
        io.to(`load:${payload.loadId}`).emit('tracking:update', payload);
      }
    });

    socket.on('load:join', ({ loadId }) => {
      if (!loadId) return;
      socket.join(`load:${loadId}`);
    });
  });
}
