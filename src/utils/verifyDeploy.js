import { resolveViteApiOrigin } from '../config/apiConfig.js';

const RECHECK_MS = Number(import.meta.env.VITE_HEALTH_RECHECK_MS || 30000);
const MAX_RECHECKS = Number(import.meta.env.VITE_HEALTH_MAX_RECHECKS || 8);

function emitMismatch(message) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('tp:deploy-mismatch', {
      detail: { message }
    })
  );
}

function emitDeployOk(payload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('tp:deploy-ok', { detail: payload }));
}

function schemaMismatchMessage(schema, dbStatus) {
  if (schema?.message) return schema.message;
  const missing = Array.isArray(schema?.missing)
    ? schema.missing.map((m) => (typeof m === 'string' ? m : `${m.table}.${m.column}`)).filter(Boolean)
    : [];
  const mig = schema?.requiredMigration || '023_notifications_realtime.sql';
  const ver = schema?.schemaVersion || schema?.version || '023';
  if (missing.length) {
    return `Database schema outdated: missing ${missing.join(', ')}. Run migration ${mig} (SQL version ${ver}) on the API server.`;
  }
  if (dbStatus === 'migration_required') {
    return `Database migration required (SQL version ${ver}). Run: npm run db:migrate on Render.`;
  }
  return 'Database is not ready on the API server.';
}

function isBooting(dbStatus, schema, body) {
  if (dbStatus === 'connecting') return true;
  if (schema?.booting === true) return true;
  if (body?.data?.healthPhase === 'booting') return true;
  if (body?.data?.status === 'starting' && dbStatus !== 'ready') return true;
  return false;
}

function isHardMismatch(dbStatus, schema, body) {
  if (isBooting(dbStatus, schema, body)) return false;
  if (dbStatus !== 'ready' && dbStatus !== 'unavailable') return false;
  if (schema?.ok === false) return true;
  if (dbStatus === 'migration_required' || dbStatus === 'needs_migration') return true;
  return false;
}

function isHealthy(dbStatus, schema) {
  return dbStatus === 'ready' && schema?.ok === true;
}

async function fetchHealth(apiOrigin) {
  const res = await fetch(`${apiOrigin.replace(/\/$/, '')}/api/health`, { cache: 'no-store' });
  const body = await res.json();
  return { res, body };
}

/**
 * On production load, verify API deploy metadata and expose on window.
 * Re-checks health during cold start; clears banner when API reports ready.
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

  const evaluate = (body, res) => {
    const apiVersion = body?.data?.version ?? res.headers.get('X-TransPak-Version');
    const apiBuild = body?.data?.build ?? body?.data?.commit ?? res.headers.get('X-TransPak-Build');
    const uptime = body?.data?.uptime;
    const schema = body?.data?.schema ?? null;
    const dbStatus = body?.data?.db;

    if (typeof window !== 'undefined') {
      window.__TRANSPAK_API__ = {
        checked: true,
        frontendBuild,
        apiOrigin,
        apiVersion,
        apiBuild,
        uptime,
        db: dbStatus,
        schema,
        migrationRequired: body?.data?.migrationRequired || null
      };
    }

    if (!schema && dbStatus === 'unavailable' && body?.data?.dbPing === 'skipped') {
      emitMismatch(
        `Backend deploy is stale (build ${apiBuild || 'unknown'}) — missing live health/schema checks. Redeploy Render from latest commit.`
      );
      return { done: true, ok: false };
    }

    if (!apiVersion && !apiBuild) {
      console.warn('[TransPak deploy] API missing version/build — stale Render deploy.');
      emitMismatch('Backend is missing version/metadata (stale deploy). Redeploy Render with clear cache.');
      return { done: true, ok: false };
    }

    if (expectedApiBuild && apiBuild && !String(apiBuild).startsWith(expectedApiBuild)) {
      emitMismatch(`API build ${apiBuild} does not match expected ${expectedApiBuild}.`);
      return { done: true, ok: false };
    }

    if (isHealthy(dbStatus, schema)) {
      emitDeployOk({ db: dbStatus, schema, apiBuild });
      return { done: true, ok: true };
    }

    if (isHardMismatch(dbStatus, schema)) {
      emitMismatch(schemaMismatchMessage(schema, dbStatus));
      return { done: true, ok: false };
    }

    // connecting / unavailable during cold start — retry, do not show permanent banner yet
    return { done: false, ok: false, dbStatus, schema };
  };

  try {
    let attempt = 0;
    while (attempt <= MAX_RECHECKS) {
      // eslint-disable-next-line no-await-in-loop
      const { res, body } = await fetchHealth(apiOrigin);
      const result = evaluate(body, res);
      if (result.done) return;
      attempt += 1;
      if (attempt > MAX_RECHECKS) {
        const stillBooting = isBooting(body?.data?.db, body?.data?.schema, body);
        if (stillBooting) {
          console.warn('[TransPak deploy] API still booting after rechecks — not showing mismatch banner.');
          return;
        }
        emitMismatch(schemaMismatchMessage(body?.data?.schema, body?.data?.db));
        return;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, RECHECK_MS));
    }
  } catch (err) {
    console.error('[TransPak deploy] Cannot reach API health:', err?.message || err);
    emitMismatch('Cannot reach the API server. Check VITE_API_URL and Render status.');
  }
}
