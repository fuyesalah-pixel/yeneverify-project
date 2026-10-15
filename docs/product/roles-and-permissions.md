# Roles and Permissions

> Last updated: 2026-09-24 | Owner: Fuad
> Technical source of truth: `shared/contracts/roles.json`

---

## The Three Roles

### Admin (Fuad)
- Platform owner.
- Accesses everything via the **web dashboard** (not the mobile app).
- Can see all merchants, manage bank adapters, approve billing, ban users.

### Merchant
- Business owner.
- Uses the **mobile app**.
- Full control of their own business data and team.

### Sub-Merchant (Team Member)
- Employee, cashier, or branch staff.
- Uses the **mobile app**.
- Can only verify payments and see their own history.
- Cannot see analytics, manage the team, or change the subscription.

---

## The Hotel-Chain Analogy

| Role | Analogy |
|------|---------|
| Admin | Head office / CEO |
| Merchant | Hotel manager |
| Sub-Merchant | Front desk staff |

Each person sees only what they need. Nothing more.

---

## Permission Matrix

| Feature | Admin | Merchant | Sub-Merchant |
|---------|:-----:|:--------:|:------------:|
| Verify a payment | ✅ | ✅ | ✅ |
| See own verifications | ✅ | ✅ | ✅ |
| See all branches' data | ✅ | ✅ | ❌ |
| Create sub-merchants | ✅ | ✅ | ❌ |
| Set permissions | ✅ | ✅ | ❌ |
| See AI insights | ✅ | ✅ | ❌ |
| Export reports | ✅ | ✅ | ❌ |
| Manage subscriptions | ✅ | ✅ | ❌ |
| See ALL merchants on platform | ✅ | ❌ | ❌ |
| Manage banks & APIs | ✅ | ❌ | ❌ |
| Ban users / handle fraud | ✅ | ❌ | ❌ |
| View own audit log | ✅ | ✅ | ✅ |

---

## Hard Rules

- A user has exactly **one role**.
- A user belongs to exactly **one merchant** (or is the merchant).
- There is no "merchant + sub-merchant" dual role. Never.
- A merchant **cannot** see another merchant's data. Ever.
- Sub-merchants see only verifications they personally submitted.
