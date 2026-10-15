# Billing Flow

> Last updated: 2026-09-24 | Owner: Kiro

---

## Concept: Yene Verify eats its own dog food

Merchants pay Yene Verify by transferring money via CBE or Telebirr,
then uploading the payment screenshot in the app. Yene Verify verifies
that screenshot with its own engine. No payment gateway integration needed.

---

## Packages

| Code | Price (ETB) | Credits/month | Unlimited |
|------|-------------|---------------|-----------|
| FREE | 0 | 10 | No |
| PREMIUM | 199 | — | Yes |
| BUSINESS | 999 | 400 | No |
| BUSINESS_PRO | 1,999 | — | Yes |
| API | Custom | — | Yes |

All prices in integer santim in the database (`amount_minor`).
Source of truth: `shared/constants/packages.json`.

---

## Billing Verification Flow

```
1. Merchant selects package in app
2. App displays: payment destination account + exact amount
3. Merchant pays via their bank app
4. Merchant screenshots the confirmation
5. Merchant uploads screenshot → same pipeline as receipt verification
6. Backend checks:
   a. Is the receipt VERIFIED by the bank adapter?
   b. Does amount_minor == package.priceMinor?
   c. Has this receipt already been used for billing?
7a. All pass → issue credits → activate package → confirmation push
7b. Amount mismatch (≤10% tolerance) → NEEDS_REVIEW → admin queue
7c. Duplicate/fake → rejection with specific error code
```

---

## Credit Ledger

Credits are **immutable** — never updated, only appended.

```
credit_transactions table:
  id          UUID
  merchantId  UUID (FK)
  type        CREDIT | DEBIT
  amount      INTEGER (always positive)
  reason      PACKAGE_PURCHASE | VERIFICATION_CONSUMED | ADMIN_ADJUSTMENT | REFUND
  referenceId UUID nullable (links to billing_verification or transaction)
  createdAt   TIMESTAMPTZ
```

Current balance = `SUM(amount) WHERE type=CREDIT` - `SUM(amount) WHERE type=DEBIT`

A cached `balance` column on `merchants` is updated transactionally and
reconciled by a nightly job. The ledger is always the source of truth.

---

## Credit Thresholds

- **> 20 credits**: normal operation
- **≤ 20 credits**: warning banner + push notification + email
- **0 credits**: hard block — verification button disabled

---

## Manual Override

Admin (future web dashboard) can:
- Approve a `NEEDS_REVIEW` billing verification manually
- Issue credit adjustments with a required reason field
- Every manual action creates an `audit_logs` entry
