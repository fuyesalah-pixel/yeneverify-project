#!/usr/bin/env bash
# Generate candidate JWT signing secrets and print a human-run rotation plan.
# This script NEVER edits an env file, deploys, or revokes a provider key.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/rotate-jwt.sh

Generates two fresh 64-byte random values (128 hexadecimal characters).
Copy them only into a password manager or the deployment secret manager;
never paste them into a ticket, PR, Slack message, or repository file.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi
if [[ $# -ne 0 ]]; then
  usage >&2
  exit 2
fi
if [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
  echo "ERROR: rotate-jwt.sh is an interactive operator tool and is disabled in CI." >&2
  exit 2
fi

generate_secret() {
  if command -v node >/dev/null 2>&1; then
    node -e "process.stdout.write(require('crypto').randomBytes(64).toString('hex'))"
  elif command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 64
  else
    echo "ERROR: install Node.js 20 or OpenSSL before rotating JWT keys." >&2
    exit 1
  fi
}

ACCESS_SECRET="$(generate_secret)"
REFRESH_SECRET="$(generate_secret)"

cat <<'EOF'
============================================================
YENE VERIFY — JWT ROTATION CANDIDATES
============================================================
The values below are newly generated and are not applied anywhere.
Treat this terminal output as sensitive until the values are pasted into the
approved secret manager and the terminal is cleared.

EOF
printf 'JWT_ACCESS_SECRET=%s\n' "$ACCESS_SECRET"
printf 'JWT_REFRESH_SECRET=%s\n' "$REFRESH_SECRET"
cat <<'EOF'

Human-in-the-loop checklist:
  1. Store the new values in the password/secret manager; never commit them.
  2. Add them as the current keys in staging and deploy staging.
  3. Set the old keys as *_PREVIOUS_* values with their previous kid IDs.
  4. Verify access and refresh flows, then add the new values to production.
  5. Keep the previous production keys live while existing sessions drain.
  6. Monitor authentication errors and session volume for 24 hours.
  7. Revoke the old provider/application keys only after the drain window.
  8. Record the date and reason in docs/ops/rotation.md and secrets.md.

No file was changed by this script.
EOF
