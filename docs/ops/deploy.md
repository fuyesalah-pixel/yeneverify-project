# Deployment Guide

> Last updated: 2026-09-25 | Owner: Kiro
> Target: Hostinger VPS, Ubuntu 22.04 LTS

This runbook deploys the backend image. Staging and production use separate
Hostinger environments, separate managed PostgreSQL/Redis instances, separate
R2 buckets, and separate provider credentials. Never copy a production `.env`
into Git, a local workstation, or a mobile build.

## Configuration contract

The complete, generated variable reference is [environment.md](environment.md).
The committed examples are:

- `backend/.env.example` — backend runtime and secret **names**.
- `docker/.env.example` — local Compose ports and fake local credentials.
- `mobile/dart_defines.example.json` — public client build configuration.

At boot, `backend/src/config/env.schema.ts` validates all values. A missing
or malformed variable stops the API before it accepts traffic. Staging and
production additionally reject obvious placeholders and mock external-service
flags. Error output contains variable names only, never values.

## First-time Hostinger setup

1. Create a non-root `deploy` user and install Docker Engine plus the Compose
   v2 plugin.
2. Install host-level Nginx and obtain TLS certificates with Certbot for the
   API hostname.
3. Create separate staging and production service accounts/secrets in the
   approved secret manager or Hostinger environment panel.
4. Provision managed PostgreSQL and Redis. Do not expose either port publicly.
5. Create the R2 buckets and configure CORS/CDN according to the bucket's
   least-privilege policy.
6. Provision the Google Vision and Firebase service accounts, then upload the
   Vision JSON to the host secret-file area (not into the repository).
7. Create a protected deployment env file outside the repository, or configure
   the Hostinger panel to inject the same variables. The file must be readable
   only by the deploy user.
8. Install the deploy key used by the matching GitHub Environment. The public
   key may be on the host; the private key belongs only in GitHub's protected
   secret store.

Never print the protected env file or run `env`, `set`, or a debug shell that
would print secret values.

## Protected env file layout

Use a path such as `/etc/yene-verify/staging.env` or
`/etc/yene-verify/production.env`, owned by `root` with mode `600` and made
readable by the deployment service through the approved host mechanism. Use
the exact keys from `backend/.env.example`; staging and production use the
same names with different values. The file must set, at minimum:

- `NODE_ENV=staging` or `production`
- managed `DATABASE_URL` and `REDIS_URL`
- `SHADOW_DATABASE_URL` only in local/CI environments used by `prisma migrate dev`; leave it unset for the running production API
- independent 64+ character JWT current keys
- real provider keys and mock flags set to `false`
- environment-specific `APP_URL`, `CORS_ORIGINS`, and `SENTRY_*`

For a Vision credential file, set `VISION_CREDENTIALS_JSON` to its read-only
path (normally `/run/secrets/gcp-vision.json`) and never inline the JSON.
For FCM, set `FCM_PRIVATE_KEY_FILE` to the read-only mounted key file when
using a file secret; otherwise use the protected escaped `FCM_PRIVATE_KEY`
value. Never inline the private-key body into a repository file.

## Deploy an immutable image

The API image is built in CI and deployed by tag. Do not build mutable
production code directly on the host as the release process.

```bash
# SSH as the deploy user
ssh deploy@<host>

# Select either Hostinger panel injection or a protected env file.
# Panel mode: the panel supplies the variables to the deployment process.
# File mode: uncomment these two lines and protect the file outside Git.
# export PROD_ENV_FILE=/etc/yene-verify/production.env
# export API_IMAGE=registry.example/yeneverify-api:<immutable-commit-sha>
export API_IMAGE=${API_IMAGE:?Set an immutable image tag}
export VISION_CREDENTIALS_HOST_FILE=${VISION_CREDENTIALS_HOST_FILE:?Set the protected Vision file path}
export FCM_PRIVATE_KEY_HOST_FILE=${FCM_PRIVATE_KEY_HOST_FILE:?Set the protected FCM file path}

cd /opt/yene-verify
if [[ -n "${PROD_ENV_FILE:-}" ]]; then
  test -r "$PROD_ENV_FILE"
fi

# Build a command prefix that works in either mode.
if [[ -n "${PROD_ENV_FILE:-}" ]]; then
  COMPOSE=(docker compose --env-file "$PROD_ENV_FILE" -f docker/docker-compose.prod.yml)
else
  COMPOSE=(docker compose -f docker/docker-compose.prod.yml)
fi

# Run pending Prisma migrations before switching traffic.
"${COMPOSE[@]}" run --rm api npx prisma migrate deploy

# Start or update the API and reverse proxy.
"${COMPOSE[@]}" pull api
"${COMPOSE[@]}" up -d --no-deps api
"${COMPOSE[@]}" up -d nginx

# Verify health and then the public route.
curl --fail --silent https://api.yeneverify.com/health
```

The production Compose file intentionally does not start local PostgreSQL or
Redis. Its secrets are mounted read-only at `/run/secrets`; the application
must not log their paths' contents or the raw environment.

## Staging deployment

Use the same process with `NODE_ENV=staging`, the staging host, the staging
managed services, the staging R2 bucket, and the staging Sentry project. Run
the API smoke tests and a test OTP/verification flow before promoting a build.
Mock flags must be `false`; provider sandbox keys are still real credentials
and remain secret.

## GitHub Actions and environment protection

Required repository secrets and their owners are listed in
[secrets.md](secrets.md). The allowed CI set is:

`STAGING_DATABASE_URL`, `STAGING_REDIS_URL`, `STAGING_DEPLOY_KEY`,
`PROD_DEPLOY_KEY`, `SENTRY_AUTH_TOKEN`, `CODECOV_TOKEN`,
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`, `IOS_MATCH_PASSWORD`, and `PLAY_STORE_JSON`.

No workflow may reference a secret outside that table. Create separate
GitHub Environments named `staging` and `production`; protect `production`
with required reviewers/manual approval and restrict deployment branches to
`main`. Configure these non-secret variables in the matching GitHub Environment:

| Non-secret variable | Example | Environment |
|---------------------|---------|-------------|
| `STAGING_API_URL` | `https://staging-api.yeneverify.com` | staging |
| `PROD_API_URL` | `https://api.yeneverify.com` | production |
| `STAGING_FLAVOR` | `staging` | staging |
| `PROD_FLAVOR` | `prod` | production |

They are public build/deployment metadata, not credentials.

`backend-ci` runs `scripts/check-env-sync.sh`. Every workflow runs gitleaks;
the pre-commit configuration runs both gitleaks and trufflehog.

## Local Docker

```bash
cp docker/.env.example docker/.env
cp backend/.env.example backend/.env       # local only; never commit
./scripts/bootstrap.sh
```

The local Compose stack provides PostgreSQL, Redis, MailHog, and MinIO. It
uses the obvious fake credentials in `docker/.env` only. The optional API
profile receives env injection and read-only secret mounts.

## Post-deploy checks

- [ ] Health endpoint is green through Nginx and TLS.
- [ ] Container restart count is stable.
- [ ] Database migrations completed without manual SQL.
- [ ] Redis and queue workers are connected.
- [ ] One staging OTP and one receipt verification succeeded.
- [ ] Logs and Sentry contain no credentials, tokens, OTPs, or raw config.
- [ ] Production and staging use different values for every secret.
- [ ] Deployment image is pinned to a commit/release identifier.

## Rollback and incidents

Rollback an image by selecting the previous known-good immutable tag and
rerunning the deployment; do not use `prisma migrate reset` in production.
For a suspected secret leak, follow [rotation.md](rotation.md) and
[incident-response.md](incident-response.md) immediately. Do not paste secret
values into Slack, issues, pull requests, or incident reports.
