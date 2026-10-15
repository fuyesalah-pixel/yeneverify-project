# Secret Rotation Policy

> Last updated: 2026-09-25 | Owner: Fuad

Rotation is a controlled human operation. Scripts may generate candidate
values, but they never edit a deployment, revoke a provider credential, or
change a database by themselves.

## Cadence

| Secret | Normal cadence | Trigger for immediate rotation |
|--------|----------------|--------------------------------|
| JWT signing keys | Every 90 days | Suspected leak, team/laptop change, auth incident |
| AfroMessage API key | Every 180 days or provider request | Abuse, leak, provider compromise notice |
| R2 access keys | Every 180 days | Suspicious access, leak, owner change |
| GCP Vision service account | Every 180 days | Unexpected API activity or IAM change |
| FCM service account | Every 180 days | Unexpected sends, leak, owner change |
| Database password | Every 180 days | Suspicious access, incident, host loss |
| Deploy SSH keys | Every 180 days | Team change, lost key, unexpected access |
| Sentry auth token | Every 180 days or on staff change | Token exposure or account incident |

A `Next due` date in [secrets.md](secrets.md) is calculated from the recorded
rotation date. Missing dates are treated as overdue for hosted environments;
provision the secret and record the date rather than guessing.

## Standard playbook

1. **Generate** the candidate in the provider or an approved secret manager.
   Prefer provider-native dual-key support where it exists.
2. **Record intent** in the rotation log below: secret name, environment,
   operator, date, reason, and ticket/incident reference. Do not record a
   value.
3. **Add to staging** first. For JWT, set the new current key and retain the
   old key as `*_PREVIOUS_*` with its key ID.
4. **Redeploy staging** and verify login, refresh, logout, and any affected
   provider call. Check redaction and Sentry before proceeding.
5. **Add to production** using the same key set. Keep old and new JWT keys
   active simultaneously during the drain window.
6. **Monitor** error rate, authentication failures, provider usage, and
   relevant audit logs for at least 24 hours (or the provider's documented
   propagation window).
7. **Revoke** the old credential at the provider only after the drain window
   and a successful verification. For providers without dual keys, schedule
   the shortest safe maintenance window.
8. **Update** `docs/ops/secrets.md` with the actual date and next due date,
   then complete the log entry and attach evidence links without secrets.

## JWT rotation without forced logout

The backend configuration supports current and previous access/refresh keys:

- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — new current keys.
- `JWT_ACCESS_PREVIOUS_SECRET` / `JWT_REFRESH_PREVIOUS_SECRET` — old keys
  accepted only during a planned rotation window.
- `JWT_ACCESS_KID` / `JWT_REFRESH_KID` and the corresponding previous key
  IDs identify which key verifies a token.

The auth implementation must select a verification key by the token's `kid`
header. It must sign new tokens only with the current key. Do not log either
key, and do not include a key ID that reveals a secret value.

## Emergency rotation (leak suspected)

1. **Revoke first** at the provider or identity system. Assume every exposed
   value is compromised, even if it appears fake.
2. Create a P0/P1 incident in [incidents/](incidents/) and notify Fuad through
   the approved private channel. Do not paste values into the incident file.
3. Generate and inject replacement values using the deployment secret store.
4. Bump `session.version` (or the equivalent auth revocation version) to force
   all sessions to re-authenticate.
5. Deploy and verify production; monitor continuously.
6. Audit the last 30 days of access, provider, deployment, and auth logs.
7. Remove leaked material from history only using the documented
   `git filter-repo` procedure, notify everyone who pulled, and never use a
   normal force-push for this.
8. Write the post-incident report, root cause, impact, and follow-up actions.
9. Update the inventory and schedule the next rotation.

## Rotation log

Record metadata only. Keep values, private-key bodies, tokens, passwords,
DSNs, and connection strings out of this file.

| Date | Secret(s) | Environment | Operator | Reason | Evidence/incident | Completed |
|------|-----------|-------------|----------|--------|--------------------|------------|
| — | — | — | — | Initial inventory; no rotation recorded | — | — |

## Prohibited shortcuts

- No automatic rotation or unattended secret-file edits.
- No reuse of development passwords in staging or production.
- No `--no-verify`, no emergency commit bypass, and no secret in a revert.
- No rotation history cleanup that destroys evidence or audit logs.
