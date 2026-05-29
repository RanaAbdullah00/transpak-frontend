import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reactRoot = path.resolve(__dirname, 'node_modules/react');
const reactDomRoot = path.resolve(__dirname, 'node_modules/react-dom');

function resolveBuildId() {
  const fromCi =
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.CLOUDFLARE_PAGES_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    '';
  if (fromCi) return String(fromCi).slice(0, 12);
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'local';
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProdBuild = mode === 'production';
  const apiUrl = (env.VITE_API_URL || '').trim();

  if (isProdBuild && !apiUrl) {
    throw new Error(
      'VITE_API_URL is required for production builds (e.g. https://transpak-backend.onrender.com). Set it in .env.production or Cloudflare Pages build env.'
    );
  }

  const proxyTarget = (env.VITE_PROXY_TARGET || 'http://127.0.0.1:10000').replace(/\/$/, '');

  const appBuildId = resolveBuildId();

  return {
    plugins: [
      react(),
      {
        name: 'transpak-build-meta',
        transformIndexHtml(html) {
          return html.replace(
            '<head>',
            `<head>\n    <meta name="transpak-build" content="${appBuildId}" />`
          );
        }
      }
    ],
    resolve: {
      dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      alias: {
        react: reactRoot,
        'react-dom': reactDomRoot,
        'react/jsx-runtime': path.join(reactRoot, 'jsx-runtime.js'),
        'react/jsx-dev-runtime': path.join(reactRoot, 'jsx-dev-runtime.js')
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'react/jsx-runtime']
    },
    define: {
      'import.meta.env.VITE_APP_BUILD_ID': JSON.stringify(appBuildId)
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('socket.io') || id.includes('engine.io')) return 'vendor-socket';
            if (/node_modules[\\/]react(-dom)?[\\/]/.test(id) || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('leaflet') || id.includes('react-leaflet')) {
              return 'vendor-map';
            }
            if (
              id.includes('react-toastify') ||
              id.includes('react-icons') ||
              id.includes('react-phone-input')
            ) {
              return 'vendor-react';
            }
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
