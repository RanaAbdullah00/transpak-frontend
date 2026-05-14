import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { registerSockets } from './sockets/index.js';

const app = createApp();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: env.CLIENT_ORIGIN,
    credentials: true
  }
});

registerSockets(io);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[transpak-frontend/server] listening on http://localhost:${env.PORT} (stub only; REST → transpak-backend)`
  );
});
