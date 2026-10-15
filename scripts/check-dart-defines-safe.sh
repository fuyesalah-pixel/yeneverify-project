#!/usr/bin/env bash
# Validate mobile --dart-define manifests as JSON and allow only the public
# configuration contract. The mobile app must never receive a secret.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE="$ROOT_DIR/mobile/dart_defines.example.json"

if [[ ! -f "$EXAMPLE" ]]; then
  echo "ERROR: missing $EXAMPLE" >&2
  exit 1
fi

shopt -s nullglob
FILES=("$ROOT_DIR"/mobile/dart_defines*.json)
if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "ERROR: no mobile define manifests found" >&2
  exit 1
fi

node - "${FILES[@]}" <<'NODE'
const fs = require('node:fs');
const paths = process.argv.slice(2);
const allowed = new Set([
  'APP_ENV',
  'API_BASE_URL',
  'API_TIMEOUT_MS',
  'SENTRY_DSN',
  'ENABLE_ANALYTICS_LOGS',
  'ENABLE_BIOMETRIC',
  'ENABLE_DEV_TOOLS',
  'BUILD_FLAVOR',
  'PIN_MIN_LENGTH',
  'PIN_MAX_LENGTH',
  'STEP_UP_TOKEN_TTL_SECONDS',
]);
const forbiddenName = /(?:password|passwd|token|api[_-]?key|private[_-]?key|secret|credential|authorization)/i;
const allowedTokenKeys = new Set(['STEP_UP_TOKEN_TTL_SECONDS']);
const forbiddenQuery = /^(?:token|access[_-]?token|refresh[_-]?token|api[_-]?key|password|otp|authorization)$/i;

for (const path of paths) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    console.error(`Invalid JSON: ${path}`);
    process.exit(1);
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    console.error(`Dart defines must be a JSON object: ${path}`);
    process.exit(1);
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (!allowed.has(key)) {
      console.error(`Unknown mobile define key: ${key} (${path})`);
      process.exit(1);
    }
    if (forbiddenName.test(key) && !allowedTokenKeys.has(key)) {
      console.error(`Secret-like mobile define key is forbidden: ${key}`);
      process.exit(1);
    }
    if (typeof value !== 'string') {
      console.error(`Mobile define values must be strings: ${key}`);
      process.exit(1);
    }
    if (key === 'API_BASE_URL' || key === 'SENTRY_DSN') {
      if (value === '') continue;
      let url;
      try { url = new URL(value); } catch {
        console.error(`Invalid URL in mobile define: ${key}`);
        process.exit(1);
      }
      if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) {
        console.error(`Unsafe URL in mobile define: ${key}`);
        process.exit(1);
      }
      for (const param of url.searchParams.keys()) {
        if (forbiddenQuery.test(param)) {
          console.error(`Secret-like query parameter in mobile define: ${key}`);
          process.exit(1);
        }
      }
    }
    if (/-----BEGIN [A-Z ]+-----/.test(value)) {
      console.error(`Private-key material is forbidden in mobile defines: ${key}`);
      process.exit(1);
    }
  }
  console.log(`Mobile define manifest is safe: ${path}`);
}
NODE