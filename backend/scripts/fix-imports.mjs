/**
 * One-shot repair for systematically corrupted relative imports
 * (one extra '../' written by a broken generator).
 *
 * For every relative import in backend/src that does not resolve from
 * the file's directory, retries with one leading '../' removed and,
 * if still unresolvable, with one appended. Reports leftovers.
 *
 * Run:  node scripts/fix-imports.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const DRY = process.argv.includes('--dry');

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) yield full;
  }
}

function resolveSpec(spec, fromDir) {
  const base = path.resolve(fromDir, spec);
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return true;
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (fs.existsSync(base + ext)) return true;
  }
  return false;
}

let filesChanged = 0;
let fixes = 0;
const leftovers = [];

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  const fromDir = path.dirname(file);
  let touched = false;

  const rewritten = src.replace(
    /(from\s+|import\s*\(\s*|require\(\s*)(['"])(\.\.?\/[^'"]+)\2/g,
    (whole, prefix, quote, spec) => {
      if (resolveSpec(spec, fromDir)) return whole;

      // Try removing one leading '../'
      if (spec.startsWith('../')) {
        const shorter = spec.replace(/^\.\.\//, '');
        if (resolveSpec(shorter, fromDir)) {
          fixes++;
          touched = true;
          return `${prefix}${quote}${shorter}${quote}`;
        }
      }

      // Try adding one '../' (corruption in the other direction)
      const deeper = '../' + spec;
      if (resolveSpec(deeper, fromDir)) {
        fixes++;
        touched = true;
        return `${prefix}${quote}${deeper}${quote}`;
      }

      // Try same-directory
      if (!spec.startsWith('./') && !spec.startsWith('../')) return whole;
      const local = './' + spec.replace(/^(\.\.?\/)+/, '');
      if (resolveSpec(local, fromDir)) {
        fixes++;
        touched = true;
        return `${prefix}${quote}${local}${quote}`;
      }

      if (spec.startsWith('.')) leftovers.push(`${path.relative(process.cwd(), file)} → ${spec}`);
      return whole;
    },
  );

  if (touched && !DRY) {
    fs.writeFileSync(file, rewritten, 'utf8');
    filesChanged++;
  }
}

console.log(`files changed: ${filesChanged}, imports fixed: ${fixes}`);
if (leftovers.length) {
  console.log(`unresolvable relative imports (${leftovers.length}):`);
  for (const l of leftovers.slice(0, 30)) console.log('  ' + l);
}
