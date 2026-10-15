## Summary

<!-- One paragraph: what does this PR do and why? -->

## Type of change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `refactor` — no behaviour change
- [ ] `chore` — tooling / deps / config
- [ ] `docs` — documentation only
- [ ] `test` — tests only
- [ ] `ci` — CI/CD changes

## Scope

- [ ] `backend`
- [ ] `mobile`
- [ ] `shared`
- [ ] `docs`
- [ ] `infra`

## Checklist

### All PRs
- [ ] PR title follows Conventional Commits: `type(scope): subject`
- [ ] Branch is up to date with `develop`
- [ ] CI is green
- [ ] No secrets or `.env` files committed
- [ ] No `console.log` / `print` debug statements left
- [ ] `scripts/check-no-secrets-in-repo.sh` passes

### Backend PRs
- [ ] Environment keys are synchronized (`./scripts/check-env-sync.sh`)
- [ ] Pino/Sentry redaction updated for new secret fields
- [ ] DTOs created for all new request/response shapes
- [ ] Prisma migration created and committed (`npx prisma migrate dev`)
- [ ] New endpoints documented in Swagger (decorators added)
- [ ] `shared/contracts/openapi.yaml` regenerated (`npm run swagger:export`)
- [ ] Error codes added to `common/constants/error-codes.ts` (not inline)
- [ ] RLS policies updated if a new tenant-scoped table was added
- [ ] Audit log entry added for sensitive actions

### Mobile PRs
- [ ] Mobile define manifest is public-only (`./scripts/check-dart-defines-safe.sh` passes)
- [ ] No hex colors outside `app_colors.dart` (`./scripts/check-no-hardcoded-colors.sh` passes)
- [ ] No hardcoded strings in widgets (`./scripts/check-no-hardcoded-strings.sh` passes)
- [ ] New strings added to both `app_en.arb` and `app_am.arb`
- [ ] `flutter gen-l10n` run after ARB changes
- [ ] API client regenerated if `openapi.yaml` changed (`./scripts/gen-api-client.sh`)
- [ ] `flutter analyze --fatal-infos` passes

### Shared contract PRs
- [ ] `shared/contracts/openapi.yaml` was NOT hand-edited (generated only)
- [ ] JSON files are valid (run `npx ajv validate` or equivalent)
- [ ] Both backend and mobile are updated to consume the new contract

## Testing

<!-- What was tested? How? -->

## Screenshots / recordings

<!-- For mobile UI changes: before/after screenshots. Required for any visual change. -->

## Related issues

<!-- Closes #XX -->
