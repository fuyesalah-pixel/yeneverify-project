# Tenancy and Row-Level Security

> Last updated: 2026-09-24 | Owner: Kiro

---

## Model

Yene Verify is a **single-database multi-tenant** system.
All merchant data lives in the same PostgreSQL database, isolated by `merchantId`.

---

## Two-Layer Isolation

### Layer 1 — Application (TenantGuard)

Every authenticated request goes through `TenantGuard`:

```ts
// Pseudocode
@Injectable()
export class TenantGuard implements CanActivate {
  async canActivate(ctx) {
    const user = ctx.getRequest().user;
    const merchantId = user.merchantId ?? user.id;

    // Set PostgreSQL session variable for RLS
    await prisma.$executeRaw`SELECT set_tenant(${merchantId}::uuid)`;

    // Attach to request for service-layer checks
    ctx.getRequest().merchantId = merchantId;
    return true;
  }
}
```

### Layer 2 — Database (RLS)

Every tenant-scoped table has RLS enabled with a policy that restricts
rows to the current session's `app.current_merchant_id`:

```sql
-- Example policy (added by Prisma migration)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON transactions
  USING (merchant_id = current_merchant_id());
```

The `current_merchant_id()` function (defined in `docker/init/postgres-init.sql`)
reads `current_setting('app.current_merchant_id')` which is set by `set_tenant()`.

**Both layers must pass.** Bypassing the application guard still hits the DB
policy. Bypassing the DB policy still hits the application guard.

---

## Tables with RLS

All tenant-scoped tables:

```
transactions          receipts              billing_verifications
credit_transactions   subscriptions         notifications
analytics_snapshots   verification_reviews  audit_logs (read-only)
```

Non-tenant tables (no RLS):
```
users     otp_codes    devices    sessions
packages  bank_codes
```

---

## Admin Bypass

Admin bypasses RLS only via a superuser database connection used
exclusively by the future web dashboard. The mobile app never has
admin-level DB access.

---

## Sub-Merchant Scope

Sub-merchants are further restricted at the application layer:
- Can only see verifications they personally submitted
- `TenantGuard` sets merchantId to their parent merchant's ID
- A separate `subMerchantId` filter is applied by the service layer
- Never see analytics, exports, or billing data (403 at controller level)
