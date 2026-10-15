# Backup Strategy

> Last updated: 2026-09-25 | Owner: Kiro

Backups are operational data, not a place to copy secrets. All backup
artifacts containing credentials or PII are encrypted, access-controlled, and
excluded from Git.

## What to back up

| Data | Where | Frequency | Retention |
|------|-------|-----------|-----------|
| Managed PostgreSQL | Hostinger managed backup | Daily + provider retention policy | 30 days minimum |
| R2 receipts/exports | Cloudflare R2 versioning | Continuous | 90 days receipts, 30 days exports |
| Configuration metadata | Password/secret manager | On every rotation | Current + previous approved version |
| Audit logs | Managed database/observability store | Continuous | 30 days minimum for investigations |

Do not back up a plaintext `.env`. A secret manager's encrypted recovery
record is the only approved backup of deployment credentials. Restrict it to
Fuad's break-glass account and test access quarterly.

## Database restore drill

1. Confirm the provider snapshot and its checksum/availability.
2. Restore into an isolated staging database, never over production first.
3. Run Prisma migrations with the production-equivalent configuration.
4. Verify row counts, tenant/RLS behavior, and a read-only smoke test.
5. Record the drill date and outcome without connection strings.

## Secret recovery

If a secret must be recovered, use the provider's audited recovery flow and
the approved secret manager. Never decrypt a backup into a repository,
terminal transcript, issue, or chat message. If recovery is uncertain, rotate
the credential rather than guessing.

## Access and retention

- Backups are encrypted in transit and at rest.
- Access is limited to the founder/incident responder and audited.
- Delete obsolete recovery copies according to the provider and legal
  retention policy; never retain an old secret past its rotation window.
- A backup restore does not undo a compromise. Follow
  [rotation.md](rotation.md) and [incident-response.md](incident-response.md)
  if a secret may have been exposed.
