# Yene Verify

> Verify any Ethiopian bank payment. In seconds.

Yene Verify is a payment-receipt verification platform for Ethiopian businesses.
A customer pays via bank transfer. The merchant photographs the confirmation
screen. Yene Verify reads the receipt via OCR, verifies it against the bank's
official record, and returns **Verified / Fake / Duplicate** — in under 10 seconds.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) |
| Flutter | stable | [flutter.dev](https://flutter.dev/docs/get-started/install) |
| Docker | latest | [docker.com](https://www.docker.com/get-started) |
| Git | ≥ 2.40 | [git-scm.com](https://git-scm.com) |

---

## Quick Start

```bash
# Clone
git clone https://github.com/fuad/<repo>.git yene-verify
cd yene-verify

# One-command bootstrap (starts Docker services, runs migrations, seeds DB)
chmod +x scripts/bootstrap.sh
./scripts/bootstrap.sh
```

After bootstrap:
- Backend API: `http://localhost:3000`
- API docs: `http://localhost:3000/docs`
- Mailhog UI: `http://localhost:8025`
- MinIO console: `http://localhost:9001`

## Configuration and secrets (Step 4)

Backend configuration is declared once in
[`backend/src/config/env.schema.ts`](backend/src/config/env.schema.ts) and
validated before the API serves traffic. Copy the examples only for local
development; real `.env` files are ignored:

```bash
cp backend/.env.example backend/.env
cp docker/.env.example docker/.env
./scripts/check-env-sync.sh
./scripts/check-no-secrets-in-repo.sh
./scripts/gen-env-docs.sh
```

The full per-environment reference is [`docs/ops/environment.md`](docs/ops/environment.md).
Secret inventory and rotation procedures are in
[`docs/ops/secrets.md`](docs/ops/secrets.md) and
[`docs/ops/rotation.md`](docs/ops/rotation.md). Mobile builds use public
`--dart-define` values only; never put a backend secret in a mobile build.

---

## Folder Map

```
yene-verify/
├── backend/      NestJS API server
├── mobile/       Flutter mobile app
├── shared/       Contracts and constants shared by both
├── docker/       Docker Compose files + Nginx config
├── scripts/      Dev automation scripts
└── docs/         Architecture, ops, brand, product docs
```

See [docs/architecture/00-overview.md](docs/architecture/00-overview.md) for the full picture.

---

## Development Workflow

1. Create a branch: `feat/backend-<feature>` or `feat/mobile-<feature>`
2. Work in the relevant subproject (`backend/` or `mobile/`)
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/)
4. Open a PR against `develop`
5. CI must be green before merge

See [CONTRIBUTING.md](CONTRIBUTING.md) for full rules.

---

## Supported Banks

CBE · Telebirr · Awash · Dashen · Bank of Abyssinia · M-Pesa · Zemen

---

## License

Proprietary — © 2026 Fuad. All rights reserved.

---

## Contact

Fuad — founder@yeneverify.com
