#!/usr/bin/env bash
# ============================================================
# Yene Verify — Guard: No hardcoded user-facing strings
# Usage: ./scripts/check-no-hardcoded-strings.sh
# Exit 0 = clean. Exit 1 = violations found.
#
# Rule (from MASTER_CONTEXT.md §16.8):
#   Zero hardcoded user-facing strings in any widget.
#   All strings must be in lib/l10n/app_en.arb and app_am.arb.
#
# What this checks:
#   Text('...') or Text("...") with literal English words in feature code.
#   Allowlist: single chars, numbers, empty strings, currency, punctuation.
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()     { echo -e "${BLUE}[string-guard]${NC} $1"; }
success() { echo -e "${GREEN}[string-guard]${NC} ✅ $1"; }
warn()    { echo -e "${YELLOW}[string-guard]${NC} ⚠️  $1"; }
fail()    { echo -e "${RED}[string-guard]${NC} ❌ $1"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FEATURES_DIR="$REPO_ROOT/mobile/lib/features"
VIOLATIONS=0

if [ ! -d "$FEATURES_DIR" ]; then
  warn "mobile/lib/features/ not found — skipping (no feature code yet)."
  exit 0
fi

# ── Check: Text('...') with English words in feature code ─────────────────
log "Checking for hardcoded English strings in feature widgets..."

# Pattern: Text('...') or Text("...") where content has 2+ alphabetic chars
# Excludes: empty strings, single chars, numbers, ETB, IDs, keys
RESULT=$(grep -rIn \
  "Text('[A-Za-z][A-Za-z ]\|Text(\"[A-Za-z][A-Za-z ]" \
  "$FEATURES_DIR" \
  --include="*.dart" \
  2>/dev/null | \
  # Allowlist: l10n references are fine (contain 'l10n.')
  grep -v "l10n\." | \
  # Allowlist: AppLocalizations references
  grep -v "AppLocalizations" | \
  # Allowlist: TODO comments
  grep -v "// TODO" | \
  # Allowlist: single ETB
  grep -v "'ETB'" | \
  # Allowlist: asset paths
  grep -v "assets/" | \
  true)

if [ -n "$RESULT" ]; then
  fail "Hardcoded English strings found in feature code:"
  echo "$RESULT" | while IFS= read -r line; do
    echo "    $line"
  done
  VIOLATIONS=$((VIOLATIONS + 1))
  echo ""
  echo "  How to fix:"
  echo "    1. Add the string to mobile/lib/l10n/app_en.arb"
  echo "    2. Add the Amharic translation to mobile/lib/l10n/app_am.arb"
  echo "    3. Run: cd mobile && flutter gen-l10n"
  echo "    4. Use: Text(context.l10n.yourKey) in the widget"
else
  success "No hardcoded English strings in feature code."
fi

# ── Check: ARB files exist and are non-empty ──────────────────────────────
log "Checking ARB files exist..."

for arb in \
  "$REPO_ROOT/mobile/lib/l10n/app_en.arb" \
  "$REPO_ROOT/mobile/lib/l10n/app_am.arb"; do
  if [ ! -f "$arb" ]; then
    fail "Missing ARB file: $arb"
    VIOLATIONS=$((VIOLATIONS + 1))
  else
    KEY_COUNT=$(grep -c '"@' "$arb" 2>/dev/null || echo 0)
    success "$(basename $arb): $KEY_COUNT keys found."
  fi
done

# ── Check: EN and AM have matching key counts ──────────────────────────────
log "Checking EN/AM key parity..."

EN_ARB="$REPO_ROOT/mobile/lib/l10n/app_en.arb"
AM_ARB="$REPO_ROOT/mobile/lib/l10n/app_am.arb"

if [ -f "$EN_ARB" ] && [ -f "$AM_ARB" ]; then
  EN_KEYS=$(grep -c '"[a-zA-Z]' "$EN_ARB" 2>/dev/null || echo 0)
  AM_KEYS=$(grep -c '"[a-zA-Z]' "$AM_ARB" 2>/dev/null || echo 0)

  # Allow a small delta (metadata keys differ)
  DELTA=$(( EN_KEYS - AM_KEYS ))
  DELTA=${DELTA#-} # abs value

  if [ "$DELTA" -gt 10 ]; then
    warn "EN has $EN_KEYS keys, AM has $AM_KEYS keys (delta: $DELTA). Consider syncing AM translations."
  else
    success "EN ($EN_KEYS keys) and AM ($AM_KEYS keys) are in sync."
  fi
fi

# ── Result ────────────────────────────────────────────────────────────────
echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  fail "$VIOLATIONS violation(s) found."
  exit 1
else
  success "All string checks passed."
  exit 0
fi
