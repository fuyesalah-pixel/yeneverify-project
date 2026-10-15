#!/usr/bin/env bash
# ============================================================
# Yene Verify — Seed local development database
# Usage: ./scripts/seed-dev.sh
# Idempotent: safe to re-run (seed script uses upsert).
#
# This script never prints passwords, PINs, tokens, or connection strings.
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()     { echo -e "${BLUE}[seed]${NC} $1"; }
success() { echo -e "${GREEN}[seed]${NC} ✅ $1"; }
warn()    { echo -e "${YELLOW}[seed]${NC} ⚠️  $1"; }
error()   { echo -e "${RED}[seed]${NC} ❌ $1"; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/docker/.env"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$REPO_ROOT/docker/docker-compose.dev.yml")

if [[ ! -f "$ENV_FILE" ]]; then
  error "docker/.env is missing. Copy docker/.env.example first."
fi

log "Checking Docker services..."
if ! "${COMPOSE[@]}" ps postgres 2>/dev/null | grep -q "running\|Up"; then
  error "PostgreSQL is not running. Run ./scripts/bootstrap.sh first."
fi
success "Docker services are running."

if [[ -f "$REPO_ROOT/backend/prisma/seed.ts" ]]; then
  log "Running Prisma database seed..."
  (cd "$REPO_ROOT/backend" && npx prisma db seed)
  success "Database seeded."
else
  warn "prisma/seed.ts not found; database seed deferred to the schema step."
fi

log "Ensuring MinIO buckets exist..."
if "${COMPOSE[@]}" ps minio 2>/dev/null | grep -q "running\|Up"; then
  # minio-init reads the ignored local env file and creates the configured
  # receipt/export buckets. No credential is echoed here.
  "${COMPOSE[@]}" run --rm minio-init
  success "MinIO buckets are ready."
else
  warn "MinIO is not running; skipping bucket setup."
fi

echo ""
success "Local seed/bootstrap checks complete."
echo "Synthetic local credentials, if created by a future seed, are stored"
echo "only in the local database and are never printed by this script."
