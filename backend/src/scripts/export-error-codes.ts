// ============================================================
// Yene Verify — Error-codes mirror exporter
// Usage:  npm run export:error-codes
// Check:  npm run export:error-codes -- --check
//
// Reads ERROR_CODES from src/common/constants/error-codes.ts
// (the single source of truth), groups the codes by prefix, and
// writes them to shared/contracts/error-codes.json.
//
// With --check (used by CI) it exits 1 when the committed mirror
// differs from what the constants produce — closing the drift
// that hand-updates kept introducing (backlog items 6 & 7).
// ============================================================

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ERROR_CODES } from '../common/constants/error-codes';

/** Group prefix for a code: "SUB_MERCHANT_X" → SUB_MERCHANT, else first segment. */
function groupOf(code: string): string {
  return code.startsWith('SUB_') ? 'SUB_MERCHANT' : code.split('_')[0];
}

function buildMirror(): string {
  const groups = new Map<string, string[]>();
  for (const code of Object.keys(ERROR_CODES)) {
    const group = groupOf(code);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(code);
  }

  const mirror: Record<string, unknown> = {
    _meta: {
      description:
        'Canonical error codes for Yene Verify, grouped by prefix. ' +
        'Source of truth: backend/src/common/constants/error-codes.ts — do not hand-edit.',
      generatedBy: 'cd backend && npm run export:error-codes',
      schema: 2,
    },
  };
  for (const [group, codes] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    mirror[group] = codes.sort((a, b) => a.localeCompare(b));
  }
  return JSON.stringify(mirror, null, 2) + '\n';
}

function main(): void {
  const isCheck = process.argv.includes('--check');

  // __dirname is <backend>/src/scripts under ts-node; anchor on the repo root.
  const repoRoot = resolve(__dirname, '..', '..', '..');
  const outputPath = resolve(repoRoot, 'shared', 'contracts', 'error-codes.json');
  const generated = buildMirror();

  if (isCheck) {
    if (!existsSync(outputPath)) {
      process.stderr.write('❌ error-codes.json does not exist. Run: npm run export:error-codes\n');
      process.exit(1);
    }
    const committed = readFileSync(outputPath, 'utf8');
    if (committed !== generated) {
      process.stderr.write(
        '❌ error-codes.json is out of sync with error-codes.ts. ' +
          'Run: npm run export:error-codes and commit.\n',
      );
      process.exit(1);
    }
    process.stdout.write('✅ error-codes.json is in sync with error-codes.ts.\n');
    return;
  }

  writeFileSync(outputPath, generated, 'utf8');
  process.stdout.write(
    `✅ error-codes.json regenerated (${Object.keys(ERROR_CODES).length} codes) → ${outputPath}\n`,
  );
}

try {
  main();
} catch (e) {
  process.stderr.write(`❌ Export failed: ${String(e)}\n`);
  process.exit(1);
}
