# Credits and Packages

> Last updated: 2026-09-24 | Owner: Fuad
> Technical source of truth: `shared/constants/packages.json`

---

## How Credits Work

Every time a merchant (or their team) verifies a payment receipt, **1 credit is consumed**.

Credits are purchased by subscribing to a package. The merchant pays via
CBE or Telebirr bank transfer and uploads the payment screenshot. Yene Verify
verifies the payment automatically — no manual approval needed in most cases.

---

## Packages

| Plan | Price | Verifications | Best for |
|------|-------|---------------|---------|
| **Free** | 0 ETB | 10 / month | Trying the product |
| **Premium** | 199 ETB / month | Unlimited | Freelancers, small shops |
| **Business** | 999 ETB / month | 400 / month | SMBs, retail stores |
| **Business Pro** | 1,999 ETB / month | Unlimited | Larger businesses |
| **API Integration** | Custom pricing | Unlimited | Banks, fintechs |

---

## What Happens When Credits Run Out

- A warning appears when **20 credits remain**: banner + push notification + email.
- When **0 credits remain**: the verification button is disabled.
- The app shows: *"Please renew your package to continue verifying receipts."*
- Sub-merchants also see this message — they cannot verify until the merchant renews.

---

## How to Renew

1. Open the app → **Subscription** tab
2. Choose a package
3. Transfer the exact amount to the Yene Verify payment account (CBE or Telebirr)
4. Take a screenshot of the confirmation
5. Upload it in the app
6. Credits are issued automatically once the payment is verified (usually < 10 seconds)

---

## Billing Verification Receipt

The payment screenshot goes through the exact same verification pipeline as
a customer receipt. If the amount matches and the payment is genuine, credits
are issued immediately. If there's an issue, it goes to manual review.

---

## Credit Ledger

Every credit change is recorded permanently. Credits are never "overwritten" —
every addition or deduction creates a new record. This ensures a full audit trail.
