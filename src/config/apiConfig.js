/**
 * Resolves backend origin from VITE_API_URL (strips accidental /api/auth/... paths).
 * In local dev without VITE_API_URL, returns '' so callers use same-origin `/api` via Vite proxy.
 */

function trimUrl(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Origin from import.meta.env.VITE_API_URL (empty string = dev proxy relative mode). */
export function resolveViteApiOrigin() {
  const raw = trimUrl(import.meta.env.VITE_API_URL);
  if (!raw) {
    if (import.meta.env.DEV) {
      return '';
    }
    const proxy = trimUrl(import.meta.env.VITE_PROXY_TARGET);
    if (proxy) {
      try {
        return new URL(proxy).origin;
      } catch {
        return proxy.replace(/\/api\/?.*$/i, '').replace(/\/$/, '');
      }
    }
    console.error('[api] VITE_API_URL is missing — production build must set it to your Render API URL.');
    return '';
  }

  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withScheme);
    let origin = parsed.origin;
    if (!import.meta.env.DEV && origin.startsWith('http://')) {
      origin = `https://${origin.slice('http://'.length)}`;
    }
    if (parsed.pathname && parsed.pathname !== '/' && import.meta.env.DEV) {
      console.warn(
        '[api] VITE_API_URL should be backend origin only (no /api paths). Resolved origin:',
        origin
      );
    }
    return origin;
  } catch {
    return raw.replace(/\/api(\/.*)?$/i, '').replace(/\/$/, '');
  }
}

export function getApiBase() {
  const origin = resolveViteApiOrigin();
  if (origin) return origin;
  if (import.meta.env.DEV && typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function getApiRoot() {
  const origin = resolveViteApiOrigin();
  if (origin) return `${origin.replace(/\/$/, '')}/api`;
  return '/api';
}

/**
 * Absolute auth API URL: `${origin}/api/auth/register`
 * @param {string} authPath e.g. '/auth/register' (must not include /api prefix)
 */
export function getAuthApiUrl(authPath) {
  let path = String(authPath || '').trim();
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/^\/api/, '');
  if (!path.startsWith('/auth')) {
    throw new Error(`Invalid auth path "${authPath}" — must resolve under /auth`);
  }

  const origin = resolveViteApiOrigin();
  if (!origin) {
    const url = `/api${path}`;
    if (/\/api\/api\//i.test(url)) {
      throw new Error(`Invalid auth URL (duplicate /api): ${url}`);
    }
    return url;
  }

  const url = `${origin.replace(/\/$/, '')}/api${path}`;
  if (/\/api\/api\//i.test(url)) {
    throw new Error(`Invalid auth URL (duplicate /api): ${url}`);
  }
  return url;
}

/** @param {string} path e.g. '/loads' */
export function getApiUrl(path) {
  const root = getApiRoot().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${root}${p}`;
}

export const API_BASE = getApiBase();
export const API_ROOT = getApiRoot();
