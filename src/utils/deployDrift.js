import { getApiBase } from '../config/apiConfig.js';

/** Expected Render backend commit (short) — override via VITE_EXPECTED_BACKEND_SHA at build. */
const EXPECTED_BACKEND_SHA = String(
  import.meta.env.VITE_EXPECTED_BACKEND_SHA || '5372f31'
)
  .trim()
  .toLowerCase()
  .slice(0, 12);

function normalizeCommit(value) {
  const h = String(value || '')
    .trim()
    .toLowerCase();
  if (!h || h === 'unknown' || h === 'local') return '';
  return h.slice(0, 12);
}

function commitsMatch(a, b) {
  const na = normalizeCommit(a);
  const nb = normalizeCommit(b);
  if (!na || !nb) return false;
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}

/**
 * True when live /api/health build does not match expected backend deploy SHA.
 */
export async function fetchBackendDeployDrift() {
  if (!EXPECTED_BACKEND_SHA) {
    return { drift: false, liveBuild: null, expectedBuild: null };
  }

  const origin = getApiBase();
  if (!origin) {
    return { drift: false, liveBuild: null, expectedBuild: EXPECTED_BACKEND_SHA };
  }

  try {
    const res = await fetch(`${origin.replace(/\/$/, '')}/api/health`, { cache: 'no-store' });
    const body = await res.json();
    const d = body?.data || {};
    const liveBuild = normalizeCommit(d.deploy?.commitFull || d.commitFull || d.commit || d.build);
    const drift = Boolean(liveBuild && !commitsMatch(liveBuild, EXPECTED_BACKEND_SHA));
    return { drift, liveBuild, expectedBuild: EXPECTED_BACKEND_SHA };
  } catch {
    return { drift: false, liveBuild: null, expectedBuild: EXPECTED_BACKEND_SHA };
  }
}
