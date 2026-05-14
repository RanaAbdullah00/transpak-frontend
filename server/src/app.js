import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { notFound, errorHandler } from './middleware/error.js';

/**
 * Legacy package: transpak-frontend/server
 * The real API is transpak-backend (PostgreSQL + Express on port 5000 by default).
 * Vite should proxy /api → transpak-backend. This app only avoids accidentally
 * running a second REST server on the same port as transpak-backend.
 */
export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      message: 'ok',
      data: {
        status: 'ok',
        role: 'deprecated-stub',
        mainBackend: env.TRANSPAK_BACKEND_URL
      }
    });
  });

  app.use('/api', (req, res) => {
    res.status(410).json({
      success: false,
      message:
        'API is served by transpak-backend (PostgreSQL). Point the Vite dev proxy to that server; do not use this package for REST.',
      data: { mainBackend: env.TRANSPAK_BACKEND_URL }
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
