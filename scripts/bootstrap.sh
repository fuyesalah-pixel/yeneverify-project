#!/usr/bin/env bash
# ============================================================
# Yene Verify — One-command local dev bootstrap
# Usage: ./scripts/bootstrap.sh
# Idempotent: safe to re-run at any time.
# ============================================================

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()     { echo -e "${BLUE}[bootstrap]${NC} $1"; }
success() { echo -e "${GREEN}[bootstrap]${NC} ✅ $1"; }
warn()    { echo -e "${YELLOW}[bootstrap]${NC} ⚠️  $1"; }
error()   { echo -e "${RED}[bootstrap]${NC} ❌ $1"; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log "Starting Yene Verify local bootstrap..."
log "Repo root: $REPO_ROOT"
echo ""

# ── 1. Check prerequisites ────────────────────────────────────────────────
log "Checking prerequisites..."

check_tool() {
  local tool=$1
  local version_cmd=$2
  local min_version=$3
  if ! command -v "$tool" &>/dev/null; then
    error "$tool is not installed. Install it from: $4"
  fi
  success "$tool found: $($version_cmd 2>&1 | head -1)"
}

check_tool "node"   "node --version"   "20"   "https://nodejs.org"
check_tool "npm"    "npm --version"    "10"   "https://nodejs.org"
check_tool "docker" "docker --version" "24"   "https://docker.com"
check_tool "flutter" "flutter --version" "3"  "https://flutter.dev"
check_tool "git"    "git --version"    "2"    "https://git-scm.com"

NODE_MAJOR=$(node -e "process.stdout.write(process.version.split('.')[0].replace('v',''))")
if [ "$NODE_MAJOR" -lt 20 ]; then
  error "Node.js 20+ required. Found: $(node --version)"
fi

# Check Docker daemon is running
if ! docker info &>/dev/null; then
  error "Docker daemon is not running. Start Docker Desktop or the Docker service."
fi

success "All prerequisites met."
echo ""

# ── 2. Set up environment files ───────────────────────────────────────────
log "Setting up environment files..."

if [ ! -f "$REPO_ROOT/backend/.env" ]; then
  if [ -f "$REPO_ROOT/backend/.env.example" ]; then
    cp "$REPO_ROOT/backend/.env.example" "$REPO_ROOT/backend/.env"
    success "Created backend/.env from .env.example"
    warn "Review backend/.env and fill in any required values."
  else
    warn "backend/.env.example not found — skipping. Create backend/.env manually."
  fi
else
  success "backend/.env already exists — skipping."
fi

if [ ! -f "$REPO_ROOT/docker/.env" ]; then
  if [ -f "$REPO_ROOT/docker/.env.example" ]; then
    cp "$REPO_ROOT/docker/.env.example" "$REPO_ROOT/docker/.env"
    success "Created docker/.env from .env.example"
  else
    warn "docker/.env.example not found — skipping."
  fi
else
  success "docker/.env already exists — skipping."
fi
echo ""

log "Checking backend environment/schema synchronization..."
bash "$REPO_ROOT/scripts/check-env-sync.sh"
success "Environment schema is synchronized."

# ── 3. Start Docker services ──────────────────────────────────────────────
log "Starting Docker services (postgres, redis, mailhog, minio)..."
cd "$REPO_ROOT"
mkdir -p "$REPO_ROOT/docker/secrets"
COMPOSE=(docker compose --env-file "$REPO_ROOT/docker/.env" -f "$REPO_ROOT/docker/docker-compose.dev.yml")
"${COMPOSE[@]}" up -d --remove-orphans

log "Waiting for PostgreSQL to be healthy..."
TIMEOUT=60
ELAPSED=0
until "${COMPOSE[@]}" exec -T postgres \
  pg_isready -U "${POSTGRES_USER:-yene}" -d "${POSTGRES_DB:-yene_verify}" &>/dev/null; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    error "PostgreSQL did not become healthy within ${TIMEOUT}s."
  fi
  echo -n "."
done
echo ""
success "PostgreSQL is healthy."

log "Waiting for Redis to be healthy..."
ELAPSED=0
until "${COMPOSE[@]}" exec -T redis \
  redis-cli ping 2>/dev/null | grep -q PONG; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  if [ "$ELAPSED" -ge 30 ]; then
    error "Redis did not become healthy within 30s."
  fi
done
success "Redis is healthy."
echo ""

# ── 4. Backend setup ──────────────────────────────────────────────────────
if [ -d "$REPO_ROOT/backend" ]; then
  if [ -f "$REPO_ROOT/backend/package.json" ]; then
    log "Installing backend dependencies..."
    cd "$REPO_ROOT/backend"
    npm ci
    success "Backend npm ci complete."

    log "Running Prisma migrations..."
    npx prisma migrate dev --name init 2>/dev/null || \
    npx prisma migrate deploy 2>/dev/null || \
    warn "Prisma migrate skipped (schema.prisma may not exist yet — run again after Step 8)."
  else
    warn "backend/package.json not found — dependency install deferred."
  fi

  if [ -f "$REPO_ROOT/backend/prisma/seed.ts" ]; then
    log "Running database seed..."
    (cd "$REPO_ROOT/backend" && npx prisma db seed 2>/dev/null) || warn "Seed skipped (seed.ts may not be ready yet)."
  fi

  success "Backend setup complete."
else
  warn "backend/ directory not found — skipping backend setup (create it in Step 8)."
fi
echo ""

# ── 5. Mobile setup ───────────────────────────────────────────────────────
if [ -d "$REPO_ROOT/mobile" ]; then
  log "Installing Flutter dependencies..."
  cd "$REPO_ROOT/mobile"
  flutter pub get
  success "flutter pub get complete."

  log "Generating localization files..."
  flutter gen-l10n 2>/dev/null || warn "flutter gen-l10n skipped (l10n.yaml may need review)."

  success "Mobile setup complete."
else
  warn "mobile/ directory not found — skipping mobile setup."
fi
echo ""

# ── 6. Print next steps ───────────────────────────────────────────────────
cd "$REPO_ROOT"
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Yene Verify local env is ready! 🚀            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Backend API:      http://localhost:3000"
echo "  API docs:         http://localhost:3000/docs"
echo "  Mailhog UI:       http://localhost:8025"
echo "  MinIO console:    http://localhost:9001  (credentials: docker/.env)"
echo ""
echo "  Start backend:    cd backend && npm run start:dev"
echo "  Start mobile:     cd mobile && flutter run"
echo ""
echo "  Useful commands:"
echo "    docker compose --env-file docker/.env -f docker/docker-compose.dev.yml ps"
echo "    docker compose --env-file docker/.env -f docker/docker-compose.dev.yml logs -f postgres"
echo "    ./scripts/seed-dev.sh"
echo ""
