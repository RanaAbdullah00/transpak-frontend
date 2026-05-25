import { resolveViteApiOrigin } from '../config/apiConfig.js';

function emitMismatch(message) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('tp:deploy-mismatch', {
      detail: { message }
    })
  );
}

/**
 * On production load, verify API deploy metadata and expose on window.
 */
export async function verifyProductionDeploy() {
  const frontendBuild = import.meta.env.VITE_APP_BUILD_ID || 'unknown';
  const apiOrigin = resolveViteApiOrigin();
  const expectedApiBuild = String(import.meta.env.VITE_EXPECTED_API_BUILD || '').trim();

  if (typeof window !== 'undefined') {
    window.__TRANSPAK_API__ = { checked: false, frontendBuild, apiOrigin };
  }

  if (import.meta.env.DEV) return;

  if (!apiOrigin) {
    console.error('[TransPak deploy] VITE_API_URL is missing — Cloudflare build env must set it.');
    emitMismatch('VITE_API_URL is not configured for this build.');
    return;
  }

  try {
    const res = await fetch(`${apiOrigin.replace(/\/$/, '')}/api/health`, { cache: 'no-store' });
    const body = await res.json();
    const apiVersion = body?.data?.version ?? res.headers.get('X-TransPak-Version');
    const apiBuild = body?.data?.build ?? body?.data?.commit ?? res.headers.get('X-TransPak-Build');
    const uptime = body?.data?.uptime;

    if (typeof window !== 'undefined') {
      window.__TRANSPAK_API__ = {
        checked: true,
        frontendBuild,
        apiOrigin,
        apiVersion,
        apiBuild,
        uptime,
        db: body?.data?.db
      };
    }

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[TransPak deploy]', {
        frontendBuild,
        apiUrl: apiOrigin,
        apiVersion,
        apiBuild,
        uptime,
        db: body?.data?.db
      });
    }

    if (!apiVersion && !apiBuild) {
      console.warn('[TransPak deploy] API missing version/build — stale Render deploy.');
      emitMismatch('Backend is missing version metadata (stale deploy). Redeploy Render with clear cache.');
      return;
    }

    if (expectedApiBuild && apiBuild && !String(apiBuild).startsWith(expectedApiBuild)) {
      emitMismatch(`API build ${apiBuild} does not match expected ${expectedApiBuild}.`);
    }

    if (body?.data?.db && body.data.db !== 'ready') {
      emitMismatch('Database is not ready on the API server.');
    }
  } catch (err) {
    console.error('[TransPak deploy] Cannot reach API health:', err?.message || err);
    emitMismatch('Cannot reach the API server. Check VITE_API_URL and Render status.');
  }
}
