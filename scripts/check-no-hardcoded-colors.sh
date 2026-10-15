#!/usr/bin/env bash
# ============================================================
# Yene Verify — Guard: No hardcoded hex colors outside theme
# Usage: ./scripts/check-no-hardcoded-colors.sh
# Exit 0 = clean. Exit 1 = violations found.
#
# Rule (from MASTER_CONTEXT.md §16.1):
#   All hex color values must live ONLY in:
#   mobile/lib/core/theme/app_colors.dart
#
# What this checks:
#   1. Hex color literals: #RRGGBB or #RGB in Dart files
#   2. Colors.* usage outside core/theme/
#   3. Color(0x...) usage outside app_colors.dart
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log()     { echo -e "${BLUE}[color-guard]${NC} $1"; }
success() { echo -e "${GREEN}[color-guard]${NC} ✅ $1"; }
fail()    { echo -e "${RED}[color-guard]${NC} ❌ $1"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_LIB="$REPO_ROOT/mobile/lib"
VIOLATIONS=0

# ── Check 1: Hex literals (#RRGGBB) outside app_colors.dart ──────────────
log "Check 1: Hex color literals outside app_colors.dart..."

RESULT=$(grep -rInE "#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}\b" \
  "$MOBILE_LIB" \
  --include="*.dart" \
  --exclude-dir=core/theme \
  --exclude-dir=api/generated \
  --exclude-dir=.dart_tool \
  2>/dev/null || true)

if [ -n "$RESULT" ]; then
  fail "Hex color literals found outside core/theme/:"
  echo "$RESULT" | while IFS= read -r line; do
    echo "    $line"
  done
  VIOLATIONS=$((VIOLATIONS + 1))
else
  success "No hex color literals outside core/theme/."
fi

# ── Check 2: Colors.* outside core/theme/ ────────────────────────────────
log "Check 2: Colors.* usage outside core/theme/..."

RESULT=$(grep -rIn "Colors\.\(white\|black\|green\|red\|blue\|grey\|gray\|transparent\|amber\|orange\|purple\|pink\|teal\|cyan\|indigo\|lime\|yellow\|brown\)" \
  "$MOBILE_LIB" \
  --include="*.dart" \
  --exclude-dir=core/theme \
  --exclude-dir=api/generated \
  2>/dev/null || true)

if [ -n "$RESULT" ]; then
  fail "Colors.* usage found outside core/theme/:"
  echo "$RESULT" | while IFS= read -r line; do
    echo "    $line"
  done
  VIOLATIONS=$((VIOLATIONS + 1))
else
  success "No Colors.* usage outside core/theme/."
fi

# ── Check 3: Color(0x...) outside app_colors.dart ────────────────────────
log "Check 3: Color(0x...) literals outside app_colors.dart..."

RESULT=$(grep -rIn "Color(0x" \
  "$MOBILE_LIB" \
  --include="*.dart" \
  --exclude-dir=api/generated \
  2>/dev/null | \
  grep -v "core/theme/app_colors.dart" || true)

if [ -n "$RESULT" ]; then
  fail "Color(0x...) literals found outside app_colors.dart:"
  echo "$RESULT" | while IFS= read -r line; do
    echo "    $line"
  done
  VIOLATIONS=$((VIOLATIONS + 1))
else
  success "No Color(0x...) literals outside app_colors.dart."
fi

# ── Check 4: withOpacity() usage (deprecated) ─────────────────────────────
log "Check 4: Deprecated withOpacity() usage..."

RESULT=$(grep -rIn "withOpacity(" \
  "$MOBILE_LIB" \
  --include="*.dart" \
  --exclude-dir=api/generated \
  2>/dev/null || true)

if [ -n "$RESULT" ]; then
  fail "withOpacity() found (use withValues(alpha:) instead — Flutter 3.27+):"
  echo "$RESULT" | while IFS= read -r line; do
    echo "    $line"
  done
  VIOLATIONS=$((VIOLATIONS + 1))
else
  success "No withOpacity() usage found."
fi

# ── Result ────────────────────────────────────────────────────────────────
echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  fail "$VIOLATIONS violation(s) found. Fix before merging."
  echo ""
  echo "  How to fix:"
  echo "    1. Move hex values to mobile/lib/core/theme/app_colors.dart"
  echo "    2. Access via context.colors.tokenName in widgets"
  echo "    3. Replace Colors.X with AppColors.X or context.colors.X"
  echo "    4. Replace withOpacity(x) with withValues(alpha: x)"
  echo ""
  exit 1
else
  success "All color checks passed."
  exit 0
fi
