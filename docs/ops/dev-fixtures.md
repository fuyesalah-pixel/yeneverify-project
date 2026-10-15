# Dev Fixtures Reference

> Last updated: 2026-09-24 | Owner: Kiro
> Source of truth for all fixed seed IDs, phone numbers, and fixture data.
> Changing any value here requires updating `backend/prisma/seed/ids.ts` AND
> any test that references the old ID.

---

## Seed Profiles

| Profile | Command | Use |
|---------|---------|-----|
| `minimal` | `npm run seed:minimal` | CI — packages + flags + admin only |
| `dev` | `npm run seed:dev` | Local development (default) |
| `staging` | `npm run seed:staging` | QA / demos |
| `prod` | `npm run seed:prod` | Production first-deploy |

`SEED_PROFILE=dev` + `NODE_ENV=production` → **throws a safety error** (by design).

---

## Fixed Phone Numbers

| Role | Phone | Display |
|------|-------|---------|
| Admin (Fuad) | `+251900000001` | Platform owner — web only |
| Merchant 1 (Selam) | `+251911111111` | Selam Coffee — Addis Ababa |
| Merchant 2 (Dawit) | `+251922222222` | Dawit Electronics — Adama |
| Sub-merchant 1 (Hanna) | `+251933333331` | Bole Branch |
| Sub-merchant 2 (Bereket) | `+251933333332` | Megenagna Branch |
| Sub-merchant 3 (Meron) | `+251933333333` | Dawit Electronics main shop |

**Dev PIN (all accounts):** `123456`

---

## Fixed UUIDs

All IDs use the UUID v7 format with a fixed timestamp prefix `018f8c1a-0000` (2026-09-24 UTC) and a fixed random suffix for determinism.

### Users

| Entity | UUID |
|--------|------|
| Admin user | `018f8c1a-0000-7000-8000-000000000001` |
| Merchant 1 user (Selam) | `018f8c1a-0000-7000-8000-000000000010` |
| Merchant 2 user (Dawit) | `018f8c1a-0000-7000-8000-000000000020` |
| Sub-merchant 1 user (Hanna) | `018f8c1a-0000-7000-8000-000000000030` |
| Sub-merchant 2 user (Bereket) | `018f8c1a-0000-7000-8000-000000000031` |
| Sub-merchant 3 user (Meron) | `018f8c1a-0000-7000-8000-000000000032` |

### Merchants

| Entity | UUID |
|--------|------|
| Merchant 1 (Selam Coffee) | `018f8c1a-0000-7000-8000-000000000011` |
| Merchant 2 (Dawit Electronics) | `018f8c1a-0000-7000-8000-000000000021` |

### Sub-merchants

| Entity | UUID | Branch |
|--------|------|--------|
| Sub-merchant 1 | `018f8c1a-0000-7000-8000-000000000040` | Bole Branch |
| Sub-merchant 2 | `018f8c1a-0000-7000-8000-000000000041` | Megenagna Branch |
| Sub-merchant 3 | `018f8c1a-0000-7000-8000-000000000042` | Main Shop |

### Subscriptions

| Entity | UUID | Package | Status |
|--------|------|---------|--------|
| Subscription 1 (Selam Coffee) | `018f8c1a-0000-7000-8000-000000000050` | BUSINESS | ACTIVE |
| Subscription 2 (Dawit Electronics) | `018f8c1a-0000-7000-8000-000000000051` | PREMIUM | ACTIVE |

### Verifications

| Entity | UUID | Status | Bank |
|--------|------|--------|------|
| verification1 | `018f8c1a-0000-7000-8000-000000000080` | VERIFIED | CBE |
| verification2 | `018f8c1a-0000-7000-8000-000000000081` | VERIFIED | CBE |
| verification3 | `018f8c1a-0000-7000-8000-000000000082` | VERIFIED | TELEBIRR |
| verification4 | `018f8c1a-0000-7000-8000-000000000083` | VERIFIED | AWASH |
| verification5 | `018f8c1a-0000-7000-8000-000000000084` | VERIFIED | CBE |
| verification6 | `018f8c1a-0000-7000-8000-000000000085` | VERIFIED | DASHEN |
| verification7 | `018f8c1a-0000-7000-8000-000000000086` | VERIFIED | MPESA |
| verification8 | `018f8c1a-0000-7000-8000-000000000087` | VERIFIED | ZEMEN |
| verification9 | `018f8c1a-0000-7000-8000-000000000088` | VERIFIED | ABYSSINIA |
| verification10 | `018f8c1a-0000-7000-8000-000000000089` | VERIFIED | CBE |
| verificationFake1 | `018f8c1a-0000-7000-8000-00000000008a` | FAKE | CBE |
| verificationFake2 | `018f8c1a-0000-7000-8000-00000000008b` | FAKE | TELEBIRR |
| verificationDuplicate | `018f8c1a-0000-7000-8000-00000000008c` | DUPLICATE | CBE |
| verificationReview | `018f8c1a-0000-7000-8000-00000000008d` | NEEDS_REVIEW | DASHEN |
| verificationError | `018f8c1a-0000-7000-8000-00000000008e` | ERROR | AWASH |

### Transactions (all from Selam Coffee, source=TRANSACTION)

| Entity | UUID | Product Label |
|--------|------|---------------|
| transaction1 | `018f8c1a-0000-7000-8000-000000000090` | Macchiato |
| transaction2 | `018f8c1a-0000-7000-8000-000000000091` | Cappuccino |
| transaction3 | `018f8c1a-0000-7000-8000-000000000092` | Croissant |
| transaction4 | `018f8c1a-0000-7000-8000-000000000093` | Lunch Combo |
| transaction5 | `018f8c1a-0000-7000-8000-000000000094` | Macchiato |
| transaction6 | `018f8c1a-0000-7000-8000-000000000095` | Cappuccino |
| transaction7 | `018f8c1a-0000-7000-8000-000000000096` | Juice |
| transaction8 | `018f8c1a-0000-7000-8000-000000000097` | Lunch Combo |
| transaction9 | `018f8c1a-0000-7000-8000-000000000098` | Macchiato |
| transaction10 | `018f8c1a-0000-7000-8000-000000000099` | Croissant |

### Billing verifications

| Entity | UUID | Status | Merchant |
|--------|------|--------|---------|
| billingVerif1 | `018f8c1a-0000-7000-8000-0000000000d1` | APPROVED | Selam Coffee |
| billingVerif2 | `018f8c1a-0000-7000-8000-0000000000d2` | PENDING | Dawit Electronics |
| billingVerif3 | `018f8c1a-0000-7000-8000-0000000000d3` | AMOUNT_MISMATCH | Selam Coffee |

### Reviews

| Entity | UUID | Status |
|--------|------|--------|
| review1 | `018f8c1a-0000-7000-8000-0000000000f1` | OPEN |
| review2 | `018f8c1a-0000-7000-8000-0000000000f2` | RESOLVED |

---

## Bank Reference Fixtures

Located in `backend/prisma/fixtures/bank-references.json`.

| Bank | Reference | Amount (santim) | Sender |
|------|-----------|-----------------|--------|
| CBE | `FT26195DBK5W81465291` | 55000 | Abebe Kebede |
| CBE | `FT26196AAK1X22334455` | 12000 | Meron Tadesse |
| TELEBIRR | `DEV6HKJX7K` | 25000 | Yonas Alemu |
| AWASH | `2KEX10DJ7F-575JQI` | 35000 | Hiwot Bekele |
| DASHEN | `DSH-TXN-20260717-0001` | 80000 | Kalkidan Assefa |
| ABYSSINIA | `FT26201XYZ123456789012` | 60000 | Tigist Haile |
| MPESA | `MPX1234ABCD` | 15000 | Sara Mekonnen |
| ZEMEN | `108IBET252931385` | 45000 | Dawit Tesfaye |

---

## Seed Entity Counts (dev profile)

| Entity | Count |
|--------|-------|
| Packages | 5 |
| Feature flags | 5 |
| Users | 6 (1 admin + 2 merchant + 3 sub) |
| Merchants | 2 |
| Sub-merchants | 3 |
| Subscriptions | 2 |
| Credit transactions | 13 (2 GRANT + 10 CONSUME + 1 billing GRANT) |
| Receipts | 18 (15 normal + 3 billing) |
| Verifications | 18 (15 normal + 3 billing) |
| Transactions | 10 |
| Billing verifications | 3 |
| Duplicate fingerprints | 1 |
| Verification reviews | 2 |
| Notifications | 10 |
| Audit logs | 20 |

---

## Credits Balance Expected State (after dev seed)

| Merchant | Ledger sum | Cached balance |
|----------|-----------|----------------|
| Selam Coffee (BUSINESS) | 390 | 390 |
| Dawit Electronics (PREMIUM) | 0 | 0 (unlimited plan) |

**Verify manually:**
```sql
SELECT merchant_id, SUM(amount) as ledger_sum
FROM credit_transactions
GROUP BY merchant_id;

SELECT id, credits_balance FROM merchants;
```

Both should match. If they differ, run:
```bash
# The reconciliation service will fix it automatically on next run
cd backend && npm run start:dev
# Or directly:
npx ts-node -e "
const {PrismaClient} = require('@prisma/client');
const {CreditsReconcileService} = require('./dist/src/credits/credits-reconcile.service');
// ... reconcileAll()
"
```

---

## Changing a Fixed ID

1. Update the UUID in `backend/prisma/seed/ids.ts`
2. Update this document
3. Search all test files for the old UUID and update them
4. Run `npm run db:reset:seed` to rebuild the DB
5. Commit both files in the same PR

**Never change a fixed ID without completing all 5 steps.**
