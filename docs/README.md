# Yene Verify Documentation

> Last updated: 2026-09-25 | Owner: Fuad

---

## Sections

| Folder | Audience | Contents |
|--------|----------|---------|
| [architecture/](architecture/) | Engineers (Kiro) | System design, pipeline, DB, adapters, Prisma migrations |
| [api/](api/) | Engineers (Kiro) | API conventions, error codes |
| [ops/](ops/) | Engineers (Kiro) | Deploy, environment, secrets, rotation, backups, incidents |
| [brand/](brand/) | Engineers (OpenCode) | Design system, theme guide, logo brief |
| [product/](product/) | Fuad + all agents | Roles, packages, FAQ |

---

## Quick Links

- [Architecture overview](architecture/00-overview.md)
- [Tech stack](architecture/01-stack.md)
- [Verification pipeline](architecture/02-verification-pipeline.md)
- [Billing flow](architecture/03-billing-flow.md)
- [Tenancy and RLS](architecture/04-tenancy-and-rls.md)
- [Bank adapters](architecture/05-bank-adapters.md)
- [Prisma schema and migrations](architecture/06-prisma.md)
- [API conventions](api/conventions.md)
- [Error codes](api/error-codes.md)
- [Deploy guide](ops/deploy.md)
- [Environment variables](ops/environment.md)
- [Secrets inventory](ops/secrets.md)
- [Secret rotation](ops/rotation.md)
- [Incident response](ops/incident-response.md)
- [Design system](brand/design-system.md)
- [Theme guide](brand/theme-guide.md)

---

## Doc Standards

Every file must:
1. Start with a one-line summary (the `#` heading)
2. Include `Last updated: YYYY-MM-DD | Owner: <name>`
3. Stay accurate — out-of-date docs are removed, not kept
4. Use plain language — no walls of text
