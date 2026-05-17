import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProdBuild = mode === 'production';
  const apiUrl = (env.VITE_API_URL || '').trim();

  if (isProdBuild && !apiUrl) {
    throw new Error(
      'VITE_API_URL is required for production builds (e.g. https://transpak-backend.onrender.com). Set it in .env.production or Cloudflare Pages build env.'
    );
  }

  const proxyTarget = (env.VITE_PROXY_TARGET || 'http://127.0.0.1:5000').replace(/\/$/, '');

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('recharts')) return 'vendor-charts';
            if (id.includes('socket.io') || id.includes('engine.io')) return 'vendor-socket';
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
            return 'vendor';
          }
        }
      },
      chunkSizeWarningLimit: 600
    },
    server: {
      port: 5173,
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          // eslint-disable-next-line no-console
          console.log(`[vite] dev proxy → ${proxyTarget} (/api, /socket.io). Production uses VITE_API_URL only.`);
        });
      },
      proxy: isProdBuild
        ? undefined
        : {
            '/api': {
              target: proxyTarget,
              changeOrigin: true
            },
            '/socket.io': {
              target: proxyTarget,
              changeOrigin: true,
              ws: true
            }
          }
    }
  };
});
