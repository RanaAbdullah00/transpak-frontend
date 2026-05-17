import { resolveViteApiOrigin, getApiUrl } from '../config/apiConfig.js';

/**
 * Public backend origin (no path, no trailing slash).
 */
export function getBackendOrigin() {
  const base = resolveViteApiOrigin();
  if (base) return base;
  if (import.meta.env.DEV && typeof window !== 'undefined') return window.location.origin;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function getDemoVideoStreamUrl() {
  return getApiUrl('/demo-video/stream');
}
