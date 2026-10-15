#!/usr/bin/env bash
# Verify that the documented backend environment and Zod schema contain
# exactly the same variable names. Values are never printed.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/backend/.env.example"
SCHEMA_FILE="$ROOT_DIR/backend/src/config/env.schema.ts"
DOC_FILE="$ROOT_DIR/docs/ops/environment.md"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: missing $ENV_FILE" >&2
  exit 1
fi
if [[ ! -f "$SCHEMA_FILE" ]]; then
  echo "ERROR: missing $SCHEMA_FILE" >&2
  exit 1
fi
if [[ ! -f "$DOC_FILE" ]]; then
  echo "ERROR: missing $DOC_FILE; run ./scripts/gen-env-docs.sh" >&2
  exit 1
fi

extract_env_keys() {
  # A dotenv assignment starts at column zero. Ignore comments and blank lines.
  sed -nE 's/^([A-Z][A-Z0-9_]*)=.*/\1/p' "$ENV_FILE" | sort -u
}

extract_schema_keys() {
  # Object properties are indented in env.schema.ts. This avoids matching
  # names mentioned in comments, arrays, or path literals.
  sed -nE 's/^[[:space:]]+([A-Z][A-Z0-9_]*):[[:space:]].*/\1/p' "$SCHEMA_FILE" \
    | sort -u
}

extract_doc_keys() {
  # Generated table rows begin with a backtick-wrapped variable name.
  sed -nE 's/^\| `([A-Z][A-Z0-9_]*)` \|.*/\1/p' "$DOC_FILE" \
    | sort -u
}

ENV_KEYS="$(mktemp)"
SCHEMA_KEYS="$(mktemp)"
ONLY_ENV="$(mktemp)"
ONLY_SCHEMA="$(mktemp)"
DOC_KEYS="$(mktemp)"
ONLY_DOC="$(mktemp)"
trap 'rm -f "$ENV_KEYS" "$SCHEMA_KEYS" "$ONLY_ENV" "$ONLY_SCHEMA" "$DOC_KEYS" "$ONLY_DOC"' EXIT

extract_env_keys > "$ENV_KEYS"
extract_schema_keys > "$SCHEMA_KEYS"
comm -23 "$ENV_KEYS" "$SCHEMA_KEYS" > "$ONLY_ENV"
comm -13 "$ENV_KEYS" "$SCHEMA_KEYS" > "$ONLY_SCHEMA"
extract_doc_keys > "$DOC_KEYS"
comm -23 "$ENV_KEYS" "$DOC_KEYS" > "$ONLY_DOC"

if [[ -s "$ONLY_ENV" || -s "$ONLY_SCHEMA" || -s "$ONLY_DOC" ]]; then
  echo "Environment/schema sync failed. Variable names only:" >&2
  if [[ -s "$ONLY_ENV" ]]; then
    echo "  documented but missing from schema:" >&2
    sed 's/^/    /' "$ONLY_ENV" >&2
  fi
  if [[ -s "$ONLY_SCHEMA" ]]; then
    echo "  declared in schema but not documented:" >&2
    sed 's/^/    /' "$ONLY_SCHEMA" >&2
  fi
  if [[ -s "$ONLY_DOC" ]]; then
    echo "  documented in .env.example but missing from environment.md:" >&2
    sed 's/^/    /' "$ONLY_DOC" >&2
  fi
  exit 1
fi

printf 'Environment schema and docs are in sync: %s keys in backend/.env.example, backend/src/config/env.schema.ts, and docs/ops/environment.md.\n' "$(wc -l < "$ENV_KEYS" | tr -d ' ')"
