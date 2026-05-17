import { resolveViteApiOrigin } from '../config/apiConfig.js';

/**
 * On production load, log API vs frontend build ids so mismatches are obvious in DevTools.
 */
export async function verifyProductionDeploy() {
  if (import.meta.env.DEV) return;

  const frontendBuild = import.meta.env.VITE_APP_BUILD_ID || 'unknown';
  const apiOrigin = resolveViteApiOrigin();

  if (!apiOrigin) {
    console.error('[TransPak deploy] VITE_API_URL is missing — Cloudflare build env must set it.');
    return;
  }

  try {
    const res = await fetch(`${apiOrigin.replace(/\/$/, '')}/api/health`, { cache: 'no-store' });
    const body = await res.json();
    const apiVersion = body?.data?.version ?? null;
    const apiBuild = body?.data?.build ?? null;
    const apiHeaderBuild = res.headers.get('X-TransPak-Build');

    console.info('TRANSPAK ACTIVE BUILD LOADED', frontendBuild);
    console.info('[TransPak deploy]', {
      frontendBuild,
      apiUrl: apiOrigin,
      apiVersion,
      apiBuild: apiBuild || apiHeaderBuild,
      db: body?.data?.db
    });

    if (!apiVersion && !apiBuild && !apiHeaderBuild) {
      console.warn(
        '[TransPak deploy] API has no version/build metadata — Render is likely on an OLD commit. Redeploy transpak-backend from latest main with "Clear build cache".'
      );
    }
  } catch (err) {
    console.error('[TransPak deploy] Cannot reach API health:', err?.message || err);
  }
}
