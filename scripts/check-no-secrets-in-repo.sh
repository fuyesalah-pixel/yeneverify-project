#!/usr/bin/env bash
# Scan the repository for committed secrets. This is intentionally a hard
# failure when gitleaks is not installed: silently skipping a security scan is
# worse than stopping a commit.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v gitleaks >/dev/null 2>&1; then
  cat >&2 <<'EOF'
ERROR: gitleaks is required but was not found in PATH.
Install it using the official project instructions, then run this script again.
Do not bypass the pre-commit hook.
EOF
  exit 127
fi

echo "Running gitleaks against the repository (values are redacted)..."
if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  gitleaks detect \
    --source "$ROOT_DIR" \
    --config "$ROOT_DIR/.gitleaks.toml" \
    --redact \
    --no-banner \
    --exit-code 1
else
  # This checkout may be unpacked without .git (for example in a review
  # sandbox). Scan the files directly rather than silently skipping them.
  gitleaks detect \
    --no-git \
    --source "$ROOT_DIR" \
    --config "$ROOT_DIR/.gitleaks.toml" \
    --redact \
    --no-banner \
    --exit-code 1
fi

# Trufflehog is the second pre-commit scanner. It is intentionally not run by
# this convenience command: installations differ, and its default finding
# output can include material. The local pre-commit hook still requires it.
echo "Secret scan completed successfully (gitleaks; trufflehog runs in pre-commit)."
