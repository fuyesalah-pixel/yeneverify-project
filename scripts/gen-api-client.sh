#!/usr/bin/env bash
# ============================================================
# Yene Verify — Regenerate mobile Dart API client from OpenAPI spec
# Usage: ./scripts/gen-api-client.sh
#
# Reads:   shared/contracts/openapi.yaml
# Outputs: mobile/lib/api/generated/
#
# Requires: Java 17+ (for openapi-generator-cli)
#           Flutter (for dart format + build_runner)
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()     { echo -e "${BLUE}[gen-api]${NC} $1"; }
success() { echo -e "${GREEN}[gen-api]${NC} ✅ $1"; }
warn()    { echo -e "${YELLOW}[gen-api]${NC} ⚠️  $1"; }
error()   { echo -e "${RED}[gen-api]${NC} ❌ $1"; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC="$REPO_ROOT/shared/contracts/openapi.yaml"
OUTPUT="$REPO_ROOT/mobile/lib/api/generated"
GENERATOR_VERSION="7.4.0"
GENERATOR_JAR="/tmp/openapi-generator-cli-${GENERATOR_VERSION}.jar"
GENERATOR_URL="https://repo1.maven.org/maven2/org/openapitools/openapi-generator-cli/${GENERATOR_VERSION}/openapi-generator-cli-${GENERATOR_VERSION}.jar"

# ── Checks ────────────────────────────────────────────────────────────────
log "Checking prerequisites..."

if [ ! -f "$SPEC" ]; then
  error "OpenAPI spec not found at $SPEC. Generate it first: cd backend && npm run swagger:export"
fi

if ! command -v java &>/dev/null; then
  error "Java 17+ is required. Install from: https://adoptium.net"
fi

JAVA_MAJOR=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
if [ "$JAVA_MAJOR" -lt 17 ] 2>/dev/null; then
  warn "Java 17+ recommended. Found: $(java -version 2>&1 | head -1)"
fi

if ! command -v flutter &>/dev/null; then
  error "Flutter is required. Install from: https://flutter.dev"
fi

success "Prerequisites OK."

# ── Download generator if needed ──────────────────────────────────────────
if [ ! -f "$GENERATOR_JAR" ]; then
  log "Downloading openapi-generator-cli v${GENERATOR_VERSION}..."
  curl -sSL "$GENERATOR_URL" -o "$GENERATOR_JAR"
  success "Downloaded to $GENERATOR_JAR"
else
  success "Generator jar already cached at $GENERATOR_JAR"
fi

# ── Clean output directory ────────────────────────────────────────────────
log "Cleaning $OUTPUT..."
rm -rf "$OUTPUT"
mkdir -p "$OUTPUT"

# ── Generate ──────────────────────────────────────────────────────────────
log "Generating Dart client from $SPEC..."
java -jar "$GENERATOR_JAR" generate \
  --input-spec "$SPEC" \
  --generator-name dart-dio \
  --output "$OUTPUT" \
  --additional-properties=pubName=yene_verify_api \
  --additional-properties=pubVersion=1.0.0 \
  --additional-properties=pubAuthor="Yene Verify" \
  --additional-properties=browserClient=false \
  --additional-properties=nullableFields=true \
  --additional-properties=serializationLibrary=built_value \
  --skip-validate-spec 2>&1 | grep -v "^$" || true

success "Client generated at $OUTPUT"

# ── Format generated code ─────────────────────────────────────────────────
log "Formatting generated Dart code..."
cd "$REPO_ROOT/mobile"
dart format lib/api/generated/ --line-length=120 2>/dev/null || \
  warn "dart format skipped (generated code may need manual review)."

# ── Run build_runner for Freezed models ──────────────────────────────────
log "Running build_runner for generated models..."
flutter pub run build_runner build \
  --delete-conflicting-outputs \
  2>/dev/null || warn "build_runner skipped (run manually if needed: flutter pub run build_runner build --delete-conflicting-outputs)."

success "API client generation complete."
echo ""
echo "  Generated at:  mobile/lib/api/generated/"
echo "  Next step:     Review generated client, then commit."
echo ""
