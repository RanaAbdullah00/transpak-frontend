/**
 * Final build gate — prints deploy-safe status after Vite succeeds.
 * Usage: node scripts/verify-build-complete.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const distIndex = path.join(root, 'dist', 'index.html');

if (!fs.existsSync(distIndex)) {
  console.error('[build-complete] dist/index.html missing after vite build');
  console.error('BUILD FAILED - FIX REQUIRED');
  process.exit(1);
}

let buildSha = '(unknown)';
try {
  buildSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
} catch {
  // non-fatal for local builds without git
}

console.log(`[build-complete] BUILD_SHA=${buildSha}`);
console.log('[build-complete] dist/index.html present');
console.log('BUILD OK - DEPLOY SAFE');
