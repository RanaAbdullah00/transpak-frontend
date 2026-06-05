/**
 * Fail Cloudflare Pages build on stale/blocked commits or SHA mismatch.
 * Usage: node scripts/verify-pages-deploy-source.mjs
 *
 * Cloudflare injects CF_PAGES_COMMIT_SHA during builds.
 */
import { execSync } from 'node:child_process';

const BLOCKED_FULL = '2e9aeb5d8b48287ff72aa3ab81a7d255f31bebb4';
const BLOCKED_SHORT = '2e9aeb5';

function normalizeSha(value) {
  return String(value || '').trim().toLowerCase();
}

function gitHead() {
  try {
    return normalizeSha(execSync('git rev-parse HEAD', { encoding: 'utf8' }));
  } catch {
    return '';
  }
}

const checkoutSha = gitHead();
const platformSha = normalizeSha(process.env.CF_PAGES_COMMIT_SHA);
const buildSha = platformSha || checkoutSha;

console.log('[pages-deploy] checkout HEAD:', checkoutSha || '(unknown)');
console.log('[pages-deploy] CF_PAGES_COMMIT_SHA:', platformSha || '(not set — local build)');
console.log('[pages-deploy] BUILD_SHA:', buildSha || '(unknown)');

if (!buildSha) {
  console.error('[pages-deploy] FAIL — cannot resolve build commit SHA');
  process.exit(1);
}

if (buildSha === BLOCKED_FULL || buildSha.startsWith(BLOCKED_SHORT)) {
  console.error(
    `[pages-deploy] FAIL — blocked stale commit ${buildSha}. Deploy main HEAD only; do not retry 2e9aeb5.`
  );
  process.exit(1);
}

if (platformSha && checkoutSha && platformSha !== checkoutSha) {
  console.error(
    `[pages-deploy] FAIL — SHA mismatch: platform=${platformSha} checkout=${checkoutSha}`
  );
  process.exit(1);
}

console.log('[pages-deploy] OK — building from allowed commit', buildSha.slice(0, 12));
