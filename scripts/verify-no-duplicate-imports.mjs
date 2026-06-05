/**
 * Fail build if any source file imports the same binding more than once.
 * Usage: node scripts/verify-no-duplicate-imports.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');
const exts = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (exts.has(path.extname(ent.name))) out.push(full);
  }
  return out;
}

const importLine =
  /^\s*import\s+(?:type\s+)?(?:(\*\s+as\s+(\w+))|(\{([^}]+)\})|(\w+))\s+from\s+['"][^'"]+['"]/;

function parseBindings(line) {
  const m = line.match(importLine);
  if (!m) return [];
  const names = [];
  if (m[2]) names.push(m[2]);
  if (m[4]) {
    for (const part of m[4].split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      const alias = seg.split(/\s+as\s+/i).pop().trim();
      if (alias) names.push(alias);
    }
  }
  if (m[5]) names.push(m[5]);
  return names;
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

const issues = [];

for (const file of walk(srcDir)) {
  const text = fs.readFileSync(file, 'utf8');
  const seen = new Map();
  const re = /^\s*import\s+/gm;
  let match;
  while ((match = re.exec(text)) !== null) {
    const lineStart = text.lastIndexOf('\n', match.index) + 1;
    const lineEnd = text.indexOf('\n', match.index);
    const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    const lineno = lineNumber(text, match.index);
    for (const name of parseBindings(line)) {
      if (seen.has(name)) {
        issues.push({
          file: path.relative(root, file).replace(/\\/g, '/'),
          binding: name,
          firstLine: seen.get(name),
          duplicateLine: lineno
        });
      } else {
        seen.set(name, lineno);
      }
    }
  }
}

if (issues.length) {
  console.error('[import-check] FAIL — duplicate imports detected:\n');
  for (const i of issues) {
    console.error(
      `  ${i.file}: "${i.binding}" imported at lines ${i.firstLine} and ${i.duplicateLine}`
    );
  }
  console.error('BUILD FAILED - FIX REQUIRED');
  process.exit(1);
}

console.log(`[import-check] OK — no duplicate imports in ${walk(srcDir).length} files`);
