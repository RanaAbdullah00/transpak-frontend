/**
 * Resolves backend origin from VITE_API_URL (strips accidental /api/auth/... paths).
 * In local dev without VITE_API_URL, returns '' so callers use same-origin `/api` via Vite proxy.
 */

function trimUrl(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Origin from import.meta.env.VITE_API_URL only (empty in dev = Vite proxy). */
export function resolveViteApiOrigin() {
  const raw = trimUrl(import.meta.env.VITE_API_URL);
  if (!raw) {
    if (import.meta.env.DEV) {
      return '';
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
  if (import.meta.env.PROD) {
    console.error(
      '[api] VITE_API_URL is missing in production build — requests will hit relative /api and fail. Rebuild with VITE_API_URL=https://your-render-backend.onrender.com'
    );
  }
  return '/api';
}

/** One-time runtime log so production misconfiguration is visible in DevTools. */
export function logApiBootstrap() {
  const viteUrl = trimUrl(import.meta.env.VITE_API_URL) || '(unset — dev proxy mode)';
  const root = getApiRoot();
  const origin = resolveViteApiOrigin() || '(relative /api via dev proxy)';
  // eslint-disable-next-line no-console
  console.log('API BASE URL:', viteUrl);
  // eslint-disable-next-line no-console
  console.log('[transpak] API origin:', origin, '| API root:', root);
  if (import.meta.env.PROD && !trimUrl(import.meta.env.VITE_API_URL)) {
    console.error('[transpak] FATAL: production build without VITE_API_URL');
  }
  if (import.meta.env.PROD && root === '/api') {
    console.error('[transpak] FATAL: API root is relative — set VITE_API_URL and rebuild frontend');
  }
  return { viteUrl, root, origin };
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
