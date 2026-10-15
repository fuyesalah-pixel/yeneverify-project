#!/usr/bin/env bash
# Run trufflehog without ever echoing a detected secret. Findings are reduced
# to detector and file names before the hook fails.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if ! command -v trufflehog >/dev/null 2>&1; then
  echo "ERROR: trufflehog is required for the pre-commit hook." >&2
  exit 127
fi

REPORT="$(mktemp)"
trap 'rm -f "$REPORT"' EXIT
set +e
trufflehog git "file://$ROOT_DIR" --only-verified --json --no-update >"$REPORT" 2>/dev/null
TRUFFLEHOG_STATUS=$?
set -e

node - "$REPORT" <<'NODE'
const fs = require('node:fs');
const report = process.argv[2];
const lines = fs.readFileSync(report, 'utf8').split(/\r?\n/).filter(Boolean);
let findings = 0;
for (const line of lines) {
  try {
    const item = JSON.parse(line);
    if (!item || typeof item !== 'object') continue;
    const detector = item.DetectorName || item.Detector || 'unknown';
    const source = item.SourceMetadata?.Data?.Git?.file || item.SourceMetadata?.Data?.Filesystem?.file || 'unknown';
    console.error(`trufflehog finding: detector=${detector} file=${source}`);
    findings += 1;
  } catch {
    // Ignore non-JSON status lines; the exit status is checked below.
  }
}
process.exit(findings > 0 ? 1 : 0);
NODE
PARSE_STATUS=$?
if [[ $PARSE_STATUS -ne 0 ]]; then
  exit "$PARSE_STATUS"
fi
exit "$TRUFFLEHOG_STATUS"
