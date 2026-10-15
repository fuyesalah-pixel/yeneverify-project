# Contributing to Yene Verify

> This is a private project. Only authorized contributors may commit.
> These rules exist to keep multiple AI agents coordinated. Read before coding.

---

## 1. Agent Boundary Rules

This repo is worked on by multiple AI agents. Each agent has a defined ownership zone.

| Agent | Owns | Read-only |
|-------|------|-----------|
| **Kiro** | `backend/`, `docker/`, `scripts/` (backend), `docs/architecture/`, `docs/api/`, `docs/ops/` | `shared/`, `mobile/` |
| **OpenCode** | `mobile/`, `docs/brand/`, `docs/product/faq.md` | `shared/`, `backend/` |
| **Fuad** | Everything | — |

**If you need to change something outside your zone, STOP and ask Fuad first.**

Shared files (`shared/contracts/openapi.yaml`, `shared/contracts/bank-codes.json`,
`shared/constants/packages.json`, etc.) are co-owned — neither agent edits them
without explicit instruction.

---

## 2. Branch Strategy

| Branch | Purpose | Protected |
|--------|---------|-----------|
| `main` | Production | ✅ Yes |
| `develop` | Staging integration | ✅ Yes |
| `feat/<scope>-<desc>` | New feature | No |
| `fix/<scope>-<desc>` | Bug fix | No |
| `chore/<scope>-<desc>` | Tooling / deps | No |
| `release/<version>` | Release prep | No |
| `hotfix/<version>` | Urgent prod fix | No |

**Scopes:** `backend`, `mobile`, `shared`, `docs`, `infra`

Examples:
```
feat/backend-credit-ledger
feat/mobile-verify-screen
fix/backend-otp-expiry
chore/shared-update-bank-codes
```

---

## 3. Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/) — enforced.

```
<type>(<scope>): <subject>

[optional body]

[optional footer: BREAKING CHANGE or closes #issue]
```

**Types:** `feat` `fix` `chore` `docs` `refactor` `test` `perf` `style` `ci` `build` `revert`

Examples:
```
feat(backend): add credit ledger with immutable entries
fix(mobile): correct ETB amount formatting for values > 1M
chore(shared): update bank-codes.json with new Zemen format
docs(ops): document Hostinger VPS deploy steps
test(backend): add verification duplicate-check unit tests
```

---

## 4. Pull Request Rules

- Squash merge only. One PR = one logical change.
- PR title follows the same convention as commits.
- Fill out the PR template fully.
- CI must be green — no exceptions.
- No direct pushes to `main` or `develop`.
- Max ~500 lines of diff. Larger PRs must be split.
- Self-review your diff before requesting merge.

---

## 5. Local Dev Setup

```bash
./scripts/bootstrap.sh
```

See [docs/ops/deploy.md](docs/ops/deploy.md) for more detail.

---

## 6. Environment and secret changes

Every backend variable must be updated together in
`backend/.env.example`, `backend/src/config/env.schema.ts`, local Compose
wiring if needed, the generated environment reference, and deployment docs.
Secret names belong in the GitHub/Hostinger secret inventories only; values
never belong in Git, tests, logs, issues, or mobile defines.

Before opening a PR:

```bash
./scripts/check-env-sync.sh
./scripts/check-no-secrets-in-repo.sh
./scripts/gen-env-docs.sh
```

Install the repository hooks with `pre-commit install`. Do not use
`--no-verify`; gitleaks and trufflehog are required controls.

---

## 7. Code Style

### Backend (NestJS / TypeScript)
- Run `npm run lint` and `npm run format` before committing.
- TypeScript strict mode. No `any`. No `// @ts-ignore` without a comment.
- All endpoints need DTOs. No raw `req.body`.

### Mobile (Flutter / Dart)
- Run `dart format .` and `flutter analyze` before committing.
- All colors from `context.colors` — never inline hex.
- All strings in ARB files — never hardcoded.
- Run CI guard scripts:
  ```bash
  ./scripts/check-no-hardcoded-colors.sh
  ./scripts/check-no-hardcoded-strings.sh
  ```

---

## 8. Updating Shared Contracts

Any API change requires a contract sync:

1. **Backend** changes endpoint → regenerates `shared/contracts/openapi.yaml`:
   ```bash
   cd backend && npm run swagger:export
   ```
2. **Mobile** regenerates Dart client:
   ```bash
   ./scripts/gen-api-client.sh
   ```
3. Both changes committed together in one PR.

**Never hand-edit** `shared/contracts/openapi.yaml` or
`mobile/lib/api/generated/**`. CI will fail.

---

## 9. Reporting Issues

Use GitHub Issues with the appropriate template:
- **Bug:** `.github/ISSUE_TEMPLATE/bug_report.md`
- **Feature:** `.github/ISSUE_TEMPLATE/feature_request.md`
