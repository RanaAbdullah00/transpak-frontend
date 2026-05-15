/**
 * Single source for API origin in production (Cloudflare Pages + Render).
 * Dev: leave VITE_API_URL empty → axios uses `/api` and Vite proxies (VITE_PROXY_TARGET in .env only).
 */

function trimUrl(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Backend origin without path, e.g. https://transpak-backend.onrender.com */
export function getApiBase() {
  const raw = trimUrl(import.meta.env.VITE_API_URL);
  if (!raw) {
    if (import.meta.env.DEV) return '';
    console.error('[api] VITE_API_URL is missing — production build must set it to your Render API URL.');
    return '';
  }
  return raw.replace(/\/api\/?$/i, '').replace(/\/$/, '');
}

/** Axios baseURL: `${API_BASE}/api` in production, `/api` in local dev (proxy). */
export function getApiRoot() {
  const base = getApiBase();
  if (base) return `${base}/api`;
  if (import.meta.env.DEV) return '/api';
  return '/api';
}

/** Full URL for a path under /api, e.g. getApiUrl('/auth/register'). */
export function getApiUrl(path) {
  const root = getApiRoot().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${root}${p}`;
}

export const API_BASE = getApiBase();
export const API_ROOT = getApiRoot();
