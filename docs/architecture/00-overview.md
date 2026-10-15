# Architecture Overview

> Last updated: 2026-09-24 | Owner: Kiro

---

## What is Yene Verify?

A payment-receipt verification platform for Ethiopian businesses. A customer
pays via bank transfer. The merchant photographs the confirmation screen. Yene
Verify reads the receipt via OCR, verifies it against the bank's official record,
and returns **Verified / Fake / Duplicate** in under 10 seconds.

---

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile App (Flutter)                      │
│   Merchant / Sub-Merchant screens · Riverpod state · GoRouter    │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS (JWT)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NestJS API (Node 20)                        │
│   Auth · Verification · Credits · Billing · Analytics            │
│   Guards · RLS enforcement · Swagger /docs                       │
└──────┬──────────────┬──────────────┬──────────────┬─────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
  PostgreSQL 16    Redis 7       BullMQ         Cloudflare R2
  (Prisma + RLS)  (cache/queue) (workers)      (receipt images)
                                   │
              ┌────────────────────┼──────────────────┐
              ▼                    ▼                   ▼
       Google Vision          Bank Adapters         FCM Push
       (OCR primary)     (CBE/Telebirr/Awash/…)  (notifications)
```

---

## Monorepo Layout

```
yene-verify/
├── backend/        NestJS API — Kiro's domain
├── mobile/         Flutter app — OpenCode's domain
├── shared/         Contracts + constants — co-owned
├── docker/         Docker Compose + Nginx
├── scripts/        Dev automation
└── docs/           This folder
```

See [01-stack.md](01-stack.md) for the full tech stack.

---

## Agent Boundary

| Agent | Owns | Never touches |
|-------|------|---------------|
| Kiro | `backend/`, `docker/`, `docs/architecture/`, `docs/api/`, `docs/ops/` | `mobile/` |
| OpenCode | `mobile/`, `docs/brand/`, `docs/product/` | `backend/` |
| Both co-read | `shared/` | Neither edits without Fuad |

---

## Key Design Decisions

1. **Async verification pipeline** — receipt is never verified synchronously.
   Client submits → receives `PENDING` → polls or receives push notification.

2. **Bank adapter pattern** — every bank implements a single `BankAdapter`
   interface. Adding a new bank = dropping a new file in `adapters/`.

3. **Billing reuses verification** — merchant payment receipts go through the
   exact same OCR + adapter pipeline. No duplicate logic.

4. **Immutable credit ledger** — credits are never decremented in place.
   Every change is an append-only row in `credit_transactions`.

5. **Two-layer tenant isolation** — RLS at the DB layer + `TenantGuard` at
   the application layer. Both must pass. Neither alone is enough.

6. **ML-ready analytics** — MVP uses rule-based SQL insights. API shape is
   fixed so real ML can swap in later without breaking mobile.
