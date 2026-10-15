# Incident Response

> Last updated: 2026-09-25 | Owner: Kiro

Use this runbook for availability, data-integrity, and secret-exposure
incidents. Never paste a secret, token, OTP, connection string, or raw provider
response into an issue, PR, Slack message, or report.

## Severity

| Level | Description | Response |
|-------|-------------|----------|
| P0 | Production down, active secret exposure, or money-moving risk | Immediate |
| P1 | Core verification/auth flow broken or suspected unauthorized access | < 1 hour |
| P2 | One bank/provider degraded | < 4 hours |
| P3 | Non-critical feature issue | < 24 hours |

## First response

```bash
# Check the public health endpoint.
curl --fail --silent https://api.yeneverify.com/health

# Check containers without printing environment values.
ssh deploy@<host>
docker compose -f /opt/yene-verify/docker/docker-compose.prod.yml ps
docker compose -f /opt/yene-verify/docker/docker-compose.prod.yml logs --tail=100 api
```

Do not run `env`, `printenv`, an interactive debug shell, or a command that
renders a container configuration. Use redacted application logs and provider
dashboards instead.

## Suspected secret exposure

1. **Revoke first** at the provider, GitHub Environment, Hostinger, or identity
   system. Treat every exposed value as compromised.
2. Declare a P0/P1 incident and notify Fuad through the approved private
   channel. Create a value-free report in `docs/ops/incidents/`.
3. Follow [rotation.md](rotation.md): generate replacements, deploy staging,
   then production, and keep old JWT keys only for the planned drain window.
4. Force logout by bumping the session/version revocation marker.
5. Review at least 30 days of auth, deployment, provider, database, and audit
   logs for misuse. Preserve evidence before cleanup.
6. Verify redaction: search only for variable/rule names and inspect the
   scrubbed event shape; do not paste candidate values into the search query.
7. If the value entered Git history, use the documented `git filter-repo`
   incident procedure, notify everyone who pulled, and force-push only as
   explicitly authorized in that procedure.

## Bank/provider outage

1. Confirm the outage in the provider status/dashboard.
2. Verify that adapter responses become `ERROR`/`NEEDS_REVIEW` rather than
   exposing raw provider errors.
3. Reduce concurrency only through the typed config and redeploy the container
   (changing an env file does not reload an existing container).
4. Monitor the queue and notify affected users when an outage exceeds the
   service target.

## Rollback

Rollback an immutable API image to the previous known-good tag. Do not use
`prisma migrate reset` or hand-written SQL in production. Coordinate database
rollback with Fuad before attempting it.

## Post-incident checklist

- [ ] Secret revoked and replacement deployed, if applicable.
- [ ] Sessions invalidated when authentication material was involved.
- [ ] Logs/Sentry checked with the same redaction policy as production.
- [ ] Audit evidence preserved for at least 30 days.
- [ ] `docs/ops/secrets.md` and `docs/ops/rotation.md` updated without values.
- [ ] Post-incident report and follow-up owner recorded in `docs/ops/incidents/`.
