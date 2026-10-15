# Prisma Schema, Migrations, and Database Safety

> Last updated: 2026-09-25 | Owner: Kiro
> Implements Step 6 from the approved design in
> [`05-database.md`](05-database.md).

## Source of truth

- `backend/prisma/schema.prisma` — the only ORM schema.
- `backend/prisma/migrations/` — ordered SQL migrations. Never use
  `prisma db push` in staging or production.
- `backend/src/common/utils/uuid.ts` — application UUIDv7 generator.
- `backend/prisma/seed.ts` — idempotent local/CI fixtures.

The application supplies UUIDv7 values on every create. The migration adds a
`uuid_generate_v4()` database fallback for imports and administrative tooling;
normal application rows remain v7.

## Migration order

| Directory | Responsibility |
|-----------|----------------|
| `20260925000000_init` | Extensions, roles, RLS helper functions, enums, tables, FKs, indexes, grants |
| `20260925000100_id_defaults_and_triggers` | UUID fallbacks and `set_updated_at()` triggers |
| `20260925000200_constraints_and_indexes` | Domain checks, partial indexes, active-subscription uniqueness |
| `20260925000300_rls_policies` | `ENABLE/FORCE ROW LEVEL SECURITY` and tenant policies |
| `20260925000400_immutable_ledgers` | Append-only rules for credits and audit logs |

Apply with:

```bash
cd backend
npx prisma migrate deploy
```

For a local schema reset during development only:

```bash
npx prisma migrate reset
```

## RLS contract

`TenantGuard` sets these variables with `SET LOCAL` inside the request
transaction:

```sql
app.current_merchant_id
app.current_user_id
app.current_role
```

The `yene_app` role is RLS-constrained; `yene_migrator` has `BYPASSRLS` and
must never be used for request traffic. `yene_readonly` receives `SELECT` only.
The hosting platform owns login credentials for these group roles; the
migration never creates or stores a password.

RLS is the second isolation layer. Every service must also filter by
`merchantId` explicitly. Sub-merchant restrictions remain an application-layer
filter because the database policy scopes by merchant, not employee.

## Invariants enforced in SQL

- `credit_transactions` and `audit_logs` reject runtime `UPDATE`/`DELETE`.
- Money is `BIGINT` minor units with non-negative/positive checks.
- Receipts are bounded to 8 MiB and JPEG/PNG only.
- Users use `+251` phone format and `en`/`am` language values.
- One active subscription per merchant is enforced by a partial unique index.
- `updated_at` is maintained by a trigger, not by trusting a client value.

## Credits reconciliation

`backend/src/credits/reconciliation.job.ts` compares
`SUM(credit_transactions.amount)` with the cached
`merchants.credits_balance`. It repairs safe drift in one admin-scoped
transaction, never touches the ledger, uses integer units, and returns a
metadata-only report for alerting. Schedule it nightly through BullMQ/cron
after the queue wiring step.

## Seed policy

`npx prisma db seed` is idempotent and safe to re-run locally. It creates the
package catalog, development users/merchants/sub-merchants, subscriptions,
credit grants, synthetic receipts/verifications/transactions, billing records,
review fixtures, notifications, and audit events. It never writes raw OTPs,
passwords, tokens, or provider credentials.
