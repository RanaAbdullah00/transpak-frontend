/**
 * Fail CI/local build if more than one physical react install exists.
 * Usage: node scripts/verify-single-react.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const nm = path.join(root, 'node_modules');

function findReactPackageDirs(dir, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name === '.bin') continue;
    const full = path.join(dir, ent.name);
    if (ent.name === 'react' && path.basename(path.dirname(full)) === 'node_modules') {
      const pkgJson = path.join(full, 'package.json');
      if (fs.existsSync(pkgJson)) found.push(full);
    }
    if (ent.name === 'node_modules' || ent.name.startsWith('@')) {
      findReactPackageDirs(full, found);
    }
  }
  return found;
}

const physical = findReactPackageDirs(nm);
const versions = physical.map((p) => {
  const pkg = JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf8'));
  return { path: path.relative(root, p), version: pkg.version };
});

let treeOk = true;
try {
  const tree = JSON.parse(execSync('npm ls react --all --json', { cwd: root, encoding: 'utf8' }));
  const seen = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.dependencies) {
      for (const [name, child] of Object.entries(node.dependencies)) {
        if (name === 'react' && child.version) seen.add(child.version);
        walk(child);
      }
    }
  };
  walk(tree);
  console.log('[react-check] npm ls versions:', [...seen].join(', ') || '(none)');
  if (seen.size > 1) treeOk = false;
} catch (e) {
  console.warn('[react-check] npm ls warn:', e.message || e);
}

console.log('[react-check] physical installs:', versions.length);
versions.forEach((v) => console.log(`  - react@${v.version} → ${v.path}`));

if (versions.length !== 1 || versions[0]?.version !== '18.3.1' || !treeOk) {
  console.error('[react-check] FAIL: require exactly one react@18.3.1');
  process.exit(1);
}

console.log('[react-check] OK — single react@18.3.1');
