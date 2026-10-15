# Secrets Inventory

> Last updated: 2026-09-25 | Owner: Fuad

This is a living inventory. **Never add a secret value, token, private-key
body, database password, or DSN value to this file.** A `—` means the item has
not been provisioned or its rotation date has not been recorded yet.

## Backend and provider secrets

| Secret | Provider | Environments | Owner | Last rotated | Next due |
|--------|----------|--------------|-------|--------------|----------|
| `DATABASE_URL` | Hostinger managed PostgreSQL / local Docker | dev/stg/prod | Fuad | — | — |
| `SHADOW_DATABASE_URL` | Prisma shadow database (CLI only) | dev/CI | Fuad | — | — |
| `REDIS_URL` | Hostinger Redis / local Docker | dev/stg/prod | Fuad | — | — |
| `JWT_ACCESS_SECRET` | Internal secret manager | dev/stg/prod | Fuad | — | — |
| `JWT_REFRESH_SECRET` | Internal secret manager | dev/stg/prod | Fuad | — | — |
| `JWT_ACCESS_PREVIOUS_SECRET` | Internal secret manager | stg/prod during rotation | Fuad | — | — |
| `JWT_REFRESH_PREVIOUS_SECRET` | Internal secret manager | stg/prod during rotation | Fuad | — | — |
| `AFROMESSAGE_API_KEY` | AfroMessage | stg/prod | Fuad | — | — |
| `VISION_CREDENTIALS_JSON` (file) | Google Cloud service account | stg/prod | Fuad | — | — |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 | stg/prod | Fuad | — | — |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 | stg/prod | Fuad | — | — |
| `R2_ACCOUNT_ID` | Cloudflare R2 | stg/prod | Fuad | — | — |
| `FCM_CLIENT_EMAIL` | Firebase Admin service account | stg/prod | Fuad | — | — |
| `FCM_PRIVATE_KEY` | Firebase Admin service account | stg/prod | Fuad | — | — |
| `FCM_PRIVATE_KEY_FILE` (file) | Firebase Admin service account | stg/prod | Fuad | — | — |
| `SMTP_USER` | Transactional email provider | stg/prod when enabled | Fuad | — | — |
| `SMTP_PASS` | Transactional email provider | stg/prod when enabled | Fuad | — | — |
| `SENTRY_DSN` | Sentry (server-side ingestion) | stg/prod | Fuad | — | — |

`VISION_CREDENTIALS_JSON` is a **path**, not the service-account JSON. The
file itself lives in the ignored `docker/secrets/` directory locally and in
the Hostinger secret-file area in hosted environments. `FCM_PRIVATE_KEY_FILE`
is the equivalent optional file path; if it is empty, the escaped
`FCM_PRIVATE_KEY` value is parsed by the config service.

The backend logger and Sentry adapter use the shared redaction policy in
[`backend/src/common/logger/redact.ts`](../../backend/src/common/logger/redact.ts).
A secret value must not be added to an error report merely because it was
placed under an otherwise harmless object key.

## CI and deployment secrets

These are GitHub repository or GitHub Environment secrets. They are listed so
that additions can be reviewed; values never belong in a workflow file or
this document.

| GitHub secret | Purpose | Used by |
|---------------|---------|---------|
| `STAGING_DATABASE_URL` | Staging migration verification | `backend-ci` |
| `STAGING_REDIS_URL` | Optional staging smoke test | `backend-ci` |
| `STAGING_DEPLOY_KEY` | SSH access to Hostinger staging | `backend-ci` |
| `PROD_DEPLOY_KEY` | SSH access to Hostinger production release | release job |
| `SENTRY_AUTH_TOKEN` | Sentry source-map upload | backend and release jobs |
| `CODECOV_TOKEN` | Optional coverage upload | `backend-ci` |
| `ANDROID_KEYSTORE_BASE64` | Android release signing key | `mobile-ci` |
| `ANDROID_KEYSTORE_PASSWORD` | Android keystore password | `mobile-ci` |
| `ANDROID_KEY_ALIAS` | Android signing alias | `mobile-ci` |
| `ANDROID_KEY_PASSWORD` | Android signing key password | `mobile-ci` |
| `IOS_MATCH_PASSWORD` | Fastlane match (future) | `mobile-ci` |
| `PLAY_STORE_JSON` | Play Store deployment (future) | `mobile-ci` |

The staging and production GitHub Environments should be configured with
separate variables and production protection/manual approval. See
[deploy.md](deploy.md) for the current workflow policy.

## Handling rules

1. Provision through the provider and a password/secret manager, not through
   Git, a PR, an issue, a chat message, or a mobile define.
2. Store local development substitutes only in ignored `.env` files or
   `docker/secrets/`; use obvious `replace_me`-style markers.
3. Put only names in logs, error responses, screenshots, and this inventory.
4. Rotate on the cadence in [rotation.md](rotation.md), and immediately after
   a laptop loss, team change, provider alert, or suspected leak.
5. After a leak, revoke at the provider first, then rotate the application,
   invalidate sessions, and preserve an incident record in
   [incidents/](incidents/).

## Inventory review checklist

- [ ] Provider account and owner confirmed.
- [ ] Staging and production values are different.
- [ ] Rotation date and next due date recorded above.
- [ ] Previous key is present only during a planned dual-key window.
- [ ] CI secret is attached to the correct GitHub Environment.
- [ ] No value exists in Git history, Docker logs, or mobile artifacts.
