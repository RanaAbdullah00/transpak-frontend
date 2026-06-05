/**
 * Fail Cloudflare Pages build on stale/blocked commits or SHA mismatch.
 * Usage: node scripts/verify-pages-deploy-source.mjs
 *
 * Cloudflare injects CF_PAGES_COMMIT_SHA during builds.
 */
import { execSync } from 'node:child_process';

const BLOCKED_SHAS = [
  '2e9aeb5d8b48287ff72aa3ab81a7d255f31bebb4',
  '2e9aeb5'
];

function fail(msg) {
  console.error(`[pages-deploy] ${msg}`);
  console.error('BUILD FAILED - FIX REQUIRED');
  process.exit(1);
}

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
  fail('cannot resolve build commit SHA');
}

if (BLOCKED_SHAS.some((b) => buildSha === b || buildSha.startsWith(b))) {
  fail(`blocked stale commit ${buildSha} — deploy main HEAD only; never retry 2e9aeb5`);
}

if (platformSha && checkoutSha && platformSha !== checkoutSha) {
  fail(`SHA mismatch: CF_PAGES_COMMIT_SHA=${platformSha} git_HEAD=${checkoutSha}`);
}

console.log('[pages-deploy] OK — building from allowed commit', buildSha.slice(0, 12));
