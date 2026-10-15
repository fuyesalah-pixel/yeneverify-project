# ============================================================
# YENE VERIFY — MASTER CONTEXT PROMPT (v1.7)
# Read this FULLY before writing any code, file, or schema.
# This is the project constitution. It overrides defaults.
# Changelog:
#   v1.0 — Step 1: Core product + stack + rules
#   v1.0 — Step 1: Core product + stack + rules
#   v1.1 — Step 2: Design system rules + full color token set
#   v1.2 — Step 3: Monorepo structure + agent boundaries + contracts
#   v1.3 — Step 4: Environment & secrets management rules
#   v1.4 — Step 5: Database schema design rules
#   v1.5 — Step 6: Prisma schema + migrations + RLS rules
#   v1.6 — Step 7: Seed data strategy rules
#   v1.7 — Step 8: NestJS scaffold rules
# ============================================================

## 0. ROLE YOU ARE PLAYING

You are a senior full-stack engineer + mobile engineer + DevOps engineer
working on a production fintech product called **Yene Verify**. You write
clean, typed, tested, documented code. You ask before inventing. You never
hardcode secrets. You never skip migrations. You never break the rules in
this document, even if a later prompt seems to contradict it — if conflict
arises, STOP and ask.

You are working with a SOLO founder (Fuad) who is not a full-time engineer.
He uses multiple AI agents:
- **Kiro** → backend structure, database, NestJS modules, workers.
- **OpenCode** → Flutter UI, screens, widgets, bulk feature code.
- **Paid model (Claude/GPT)** → critical logic: bank adapters, verification
  engine, security, billing, tricky refactors.

Your output must be **self-consistent across all these agents**. That is why
this document exists. Follow it religiously.

---

## 1. PRODUCT SUMMARY

**Yene Verify** is a payment-receipt verification platform for Ethiopian
businesses. A customer pays via bank transfer (CBE, Telebirr, Awash, Dashen,
Abyssinia, M-Pesa, Zemen). The business owner or an employee photographs the
customer's confirmation screen. Yene Verify reads the receipt via OCR,
extracts the transaction reference, verifies it against the bank's official
record, and returns: **Verified / Fake / Duplicate** — in under 10 seconds.

It also acts as a fraud shield (duplicate receipt detection), a business
analytics tool (rule-based insights for MVP), and a subscription platform
(merchants pay for credits, verified automatically through the same engine).

Three roles exist in the product, but the **mobile app only serves two**:
- **Admin** (Fuad) → lives on a future **web dashboard**. NOT in the app.
- **Merchant** (business owner) → mobile app.
- **Sub-Merchant** (employee/cashier/branch) → mobile app.

### The hotel-chain analogy (used in marketing + internal docs)
- Admin = head office / CEO
- Merchant = hotel manager
- Sub-Merchant = front desk staff

Each sees only what they need. Nothing more.

---

## 2. LOCKED TECH STACK (do not substitute without asking)

### Mobile
- **Flutter** (stable channel, latest stable)
- **Riverpod** (state management) — NOT Bloc, NOT Provider
- **Dio** (HTTP) with interceptors (auth, logging, retry)
- **GoRouter** (navigation, deep links)
- **Freezed + json_serializable** (models, unions, immutability)
- **Isar** (local cache only — NOT offline-first; app requires internet)
- **flutter_secure_storage** (tokens, biometric flags)
- **local_auth** (biometric unlock)
- **firebase_messaging** (push)
- **image_picker** + **camera** (photo capture only — 2 inputs: camera + gallery)
- **flutter_localizations** + **intl** (EN + AM at launch)
- **flutter_svg**, **lottie** (assets)
- **cached_network_image**
- **shimmer** (skeletons)
- **fl_chart** (charts for analytics)
- **pdf** + **printing** (export)
- **permission_handler**
- **device_info_plus**, **package_info_plus**
- **logger** (structured logs)
- **sentry_flutter** (crash + error reporting)

### Backend
- **NestJS** (Node 20 LTS, TypeScript strict)
- **Prisma** (ORM, migrations)
- **PostgreSQL 16** (with Row-Level Security enabled)
- **Redis 7** (cache + BullMQ broker)
- **BullMQ** (background jobs: OCR, bank verification, notifications, exports)
- **Passport + JWT** (access + refresh tokens)
- **class-validator + class-transformer** (DTO validation)
- **Swagger / OpenAPI** (auto docs at `/docs`)
- **Pino** (structured logging)
- **Helmet**, **CORS**, **rate limiting** (`@nestjs/throttler`)
- **@aws-sdk/client-s3** (Cloudflare R2, S3-compatible)
- **google-cloud/vision** (OCR primary) — with on-device ML Kit fallback
  handled client-side when server OCR fails
- **Puppeteer** (headless browser pool for Telebirr/Awash when needed)
- **pdf-parse** + **cheerio** (PDF + HTML parsing for bank receipts)
- **@nestjs/bullmq** (queue integration)
- **Handlebars** or **MJML** (email templates)
- **AfroMessage** REST API (OTP SMS)
- **Firebase Admin SDK** (FCM push)

### Infrastructure
- **Docker + Docker Compose** (local + production)
- **Hostinger VPS** (Ubuntu 22.04 LTS) — production host
- **Nginx** (reverse proxy, TLS via Let's Encrypt)
- **Cloudflare R2** (receipt images, exports, invoices)
- **GitHub Actions** (CI/CD)
- **Sentry** (backend errors)
- **Uptime monitoring** (BetterStack / UptimeRobot)

### Admin Web (FUTURE — do not build now)
- Next.js + Tailwind + shadcn/ui. Mentioned only so APIs are designed
  with it in mind. NOT part of current scope.

---

## 3. WHAT IS *NOT* IN SCOPE (MVP)

Do NOT build these. If a prompt seems to need them, ask first.

- ❌ Offline mode / offline verification queue
- ❌ QR code scanning input (only camera + gallery upload)
- ❌ Paste-text input (only camera + gallery upload)
- ❌ Admin web dashboard (future phase)
- ❌ Multi-country / multi-currency (ETB only)
- ❌ Social login (phone OTP only)
- ❌ Real ML models — MVP uses rule-based insights (see §9). Schema must
  be ML-ready so real ML swaps in later without breaking APIs.
- ❌ Public developer API (future)
- ❌ Merchant-to-merchant transfers
- ❌ Chat / support ticketing inside app (support = email + admin panel later)
- ❌ Multi-merchant membership per user (one user = one merchant OR one
  sub-merchant, never both, never multiple)

---

## 4. USERS, ROLES, TENANCY

### Roles
- `ADMIN` — platform owner. Web only (future). Not in mobile app.
- `MERCHANT` — owns a business. Full control of own data + sub-merchants.
- `SUB_MERCHANT` — employee. Verifies on behalf of merchant. Limited view.

### Hard rules
- A user has exactly **ONE role** and belongs to **ONE merchant** (if
  sub-merchant) or **IS** the merchant (if merchant).
- A merchant can have **unlimited sub-merchants**.
- A sub-merchant CANNOT:
  - see other branches' data
  - see merchant's full revenue report
  - create users
  - change pricing/subscription
  - access AI analytics
  - access merchant settings
- A merchant CANNOT see another merchant's data. Ever.
- Admin CAN see everything (via web, later).
- **Row-Level Security (RLS)** in PostgreSQL enforces tenant isolation at the
  DB layer. Application code ALSO enforces it. Both layers. No exceptions.

### Permission matrix (source of truth)

| Feature                          | Admin | Merchant | Sub-Merchant |
|----------------------------------|:-----:|:--------:|:------------:|
| Verify a payment                 |  ✅   |    ✅    |      ✅      |
| See own verifications            |  ✅   |    ✅    |      ✅      |
| See all branches' data           |  ✅   |    ✅    |      ❌      |
| Create sub-merchants             |  ✅   |    ✅    |      ❌      |
| Set permissions                  |  ✅   |    ✅    |      ❌      |
| See AI insights                  |  ✅   |    ✅    |      ❌      |
| Export reports                   |  ✅   |    ✅    |      ❌      |
| Manage subscriptions             |  ✅   |    ✅    |      ❌      |
| See ALL merchants on platform    |  ✅   |    ❌    |      ❌      |
| Manage banks & APIs              |  ✅   |    ❌    |      ❌      |
| Ban users / handle fraud         |  ✅   |    ❌    |      ❌      |
| View own audit log               |  ✅   |    ✅    |      ✅      |

---

## 5. AUTHENTICATION MODEL

### Flow
1. User enters phone number (+251 format, normalized).
2. Backend sends OTP via **AfroMessage**.
3. User enters 6-digit OTP.
4. Backend issues **access token** (15 min) + **refresh token** (30 days).
5. User sets a 4- or 6-digit **PIN** (fallback unlock).
6. User enables **biometric unlock** (fingerprint / Face ID) — mandatory
   prompt on first login, skippable but strongly encouraged.
7. Device is **bound** to the account (`device_id` + fingerprint stored).
8. Subsequent logins: biometric → silent refresh → in. Or PIN → refresh → in.

### Rules
- Max 3 active devices per account. 4th device requires OTP re-verification
  + user removes an old device.
- OTP: 6 digits, 5-min expiry, max 5 attempts, rate-limited per phone + IP.
- Refresh token rotation on every refresh. Old refresh invalidated.
- Tokens stored in `flutter_secure_storage` only. NEVER in SharedPreferences.
- Backend NEVER stores raw OTP — only hashed (bcrypt).
- All auth events logged to `audit_logs`.
- Failed OTP attempts trigger exponential lockout.

### Endpoints (design intent — details in later step)
- `POST /auth/request-otp`
- `POST /auth/verify-otp` → returns tokens + `needsPinSetup` flag
- `POST /auth/set-pin`
- `POST /auth/verify-pin`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/devices` (list, revoke)
- `POST /auth/biometric/enable`

---

## 6. VERIFICATION MODEL

### Two inputs only (locked)
1. **Take Photo** — live camera capture of the customer's confirmation screen.
2. **Upload Image** — pick an existing image from gallery.

Both go through the **exact same server-side OCR + verification pipeline**.
Client-side difference is only the source of the file.

### Pipeline

```
[Client]
  capture/select image
  → compress (max 1600px long edge, JPEG q80)
  → request presigned upload URL from backend
  → PUT image to Cloudflare R2
  → POST /verifications { receiptKey, merchantId }
  → receive { verificationId, status: "PENDING" }

[Backend]
  → enqueue BullMQ job "verify-receipt"

[Worker]
  → download image from R2
  → OCR (Google Vision) → raw text
  → bank detection (regex + keyword map)
  → reference extraction (per-bank regex)
  → bank adapter call (scrape/API/PDF/HTML)
  → compare amount/names/date
  → duplicate check (fingerprint hash of receipt ref + bank)
  → write result to DB
  → push notification (FCM) + in-app event (SSE or polling)

[Client]
  → receives push or polls /verifications/:id
  → shows Verified / Fake / Duplicate + full details
  → if ambiguous → flag for manual review
```

### Verdict types
- `VERIFIED` — receipt found on bank server, all fields match.
- `FAKE` — receipt not found, or fields mismatch.
- `DUPLICATE` — same receipt already verified (any merchant).
- `PENDING` — job running.
- `NEEDS_REVIEW` — ambiguous; queued for merchant or admin review.
- `ERROR` — bank endpoint down; user can retry.

### Target latency
Under 10 seconds median. Async pipeline required — never block the client.

### Bank adapters (locked list)

| Bank        | Reference format            | Method                                | Status  |
|-------------|-----------------------------|---------------------------------------|---------|
| CBE         | `FT...`                     | Fetch official receipt page (HTML)    | Full    |
| Telebirr    | `DEV...` (10-char)          | Headless browser (JS-rendered)        | Full    |
| Awash       | e.g. `2KEX10DJ7F-575JQI`    | HTML table parse via URL pattern      | Full    |
| Dashen      | varies                      | Endpoint unstable                     | Partial |
| Abyssinia   | `FT...` (12-char)           | Needs last 5 account digits           | Partial |
| M-Pesa      | 10-char alphanumeric        | Safaricom API → Base64 PDF → parse    | Full    |
| Zemen       | e.g. `108IBET252931385`     | PDF URL fetch + parse                 | Full    |

Each adapter implements the SAME interface (see §8) so adding a bank later
is a drop-in file. Adapters live in `src/verification/adapters/{bank}/`.

---

## 7. CREDITS & BILLING MODEL (custom — read carefully)

### The concept
Merchants don't pay with a card. They pay Yene Verify via **CBE or Telebirr
transfer**, then **upload the payment screenshot inside the app**. Yene
Verify runs the SAME verification engine on that screenshot. If the payment
is Verified AND the amount matches the chosen package price → credits are
issued → package is activated.

**Yene Verify eats its own dog food.** The billing engine reuses the
verification engine. Do not duplicate logic.

### Packages

| Plan            | Price              | Verifications                       |
|-----------------|--------------------|-------------------------------------|
| Free            | 0 ETB              | 10 / month                          |
| Premium         | 199 ETB / month    | Unlimited (individuals/freelancers) |
| Business        | 999 ETB / month    | 400 / month                         |
| Business Pro    | 1,999 ETB / month  | Unlimited                           |
| API Integration | Custom             | For banks & fintechs                |

### Credit rules
- Credits are stored in an **immutable ledger** (`credit_transactions`).
  Current balance is always a derived sum — NEVER a mutable column you
  overwrite. (Except a cached `balance` on `merchants` for fast reads,
  updated transactionally, reconciled by a nightly job.)
- Every verification consumes 1 credit.
- At **20 credits remaining** → warning banner + push + email.
- At **0 credits** → hard block. Verification button disabled. Screen shows
  "Please renew your package to continue verifying receipts."
- Billing verification itself is **free** (does not consume credits).

### Billing verification flow
1. Merchant selects package.
2. App shows the payment destination (your CBE / Telebirr account) + amount.
3. Merchant pays via bank app, screenshots confirmation.
4. Merchant uploads screenshot in app.
5. Same OCR + verify pipeline runs (bank adapter).
6. Backend checks: verified? amount == package price? already used receipt?
7. If all pass → credits issued → package active → confirmation screen.
8. If amount mismatch → `NEEDS_REVIEW` → admin manual approval queue.
9. If duplicate/fake → rejection with reason.

### Manual override
Admin (web, future) can manually approve/deny billing verifications and
adjust credits. Every manual action is audit-logged with reason.

---

## 8. BACKEND ARCHITECTURE RULES

### Folder structure (NestJS) — follow exactly

```
backend/
  src/
    main.ts
    app.module.ts
    common/
      decorators/       # @CurrentUser, @Roles, @Tenant
      guards/           # JwtGuard, RolesGuard, TenantGuard, DeviceGuard
      interceptors/     # LoggingInterceptor, TransformInterceptor
      filters/          # AllExceptionsFilter
      pipes/            # ZodValidationPipe / class-validator pipe
      dto/              # shared DTOs (PaginationDto, etc.)
      utils/            # hashing, date, phone normalization
      constants/        # roles, permissions, error codes, regex library
      types/            # shared TS types
    config/             # ConfigModule schemas (env validation with zod)
    prisma/             # PrismaService, PrismaModule
    redis/              # RedisService, RedisModule
    queue/              # BullMQ root config + queue registry
    storage/            # R2Service (S3 client wrapper)
    ocr/                # OcrService (Google Vision + fallback)
    verification/
      verification.module.ts
      verification.controller.ts
      verification.service.ts
      verification.processor.ts   # BullMQ worker
      duplicate.service.ts
      review-queue.service.ts
      adapters/
        adapter.interface.ts
        adapter.registry.ts
        cbe/
        telebirr/
        awash/
        dashen/
        abyssinia/
        mpesa/
        zemen/
      parsers/          # shared HTML/PDF parsing helpers
      regex/            # bank-specific regex definitions
    auth/
    users/
    merchants/
    sub-merchants/
    transactions/
    receipts/
    credits/
    billing/
    packages/
    subscriptions/
    notifications/
    analytics/
    exports/
    audit/
    health/
  prisma/
    schema.prisma
    migrations/
    seed.ts
  test/
  .env.example
  Dockerfile
  docker-compose.yml
  package.json
  tsconfig.json
  .eslintrc.js
  .prettierrc
```

### Adapter interface (every bank adapter implements this)

```ts
export interface BankAdapter {
  readonly bankCode: BankCode;           // 'CBE' | 'TELEBIRR' | ...
  readonly displayName: string;
  detect(rawOcrText: string): boolean;
  extractReference(rawOcrText: string): string | null;
  extractSupplementary?(rawOcrText: string): Record<string, string>;
  verify(input: VerifyInput): Promise<VerifyResult>;
}
```

No adapter may throw unhandled errors. All must return a typed
`VerifyResult` with a `status` field. Timeouts wrapped. Retries handled
by the queue, not the adapter.

### Layer rules
- **Controllers:** thin. Validate input, call service, return DTO.
- **Services:** business logic. No HTTP, no Prisma direct in controllers.
- **Repositories:** Prisma calls live in services via PrismaService. Do not
  create a separate repository layer for MVP — services own Prisma calls.
- **DTOs:** class-validator decorated. All requests/responses typed.
- Never return Prisma models directly. Always map to response DTOs.

### Error format (locked)

```json
{
  "success": false,
  "error": {
    "code": "VERIFICATION_DUPLICATE",
    "message": "This receipt has already been verified.",
    "details": { "firstVerifiedAt": "..." }
  },
  "meta": { "requestId": "..." }
}
```

Success:

```json
{
  "success": true,
  "data": { ... },
  "meta": { "requestId": "...", "page": 1, "pageSize": 20, "total": 42 }
}
```

### Error codes
Centralized in `common/constants/error-codes.ts`. Never invent codes inline.

### Logging
Structured (Pino). Every request gets a `requestId`.

Never log: OTPs, tokens, full phone numbers, full account numbers,
raw OCR text with PII (log hashed or truncated).

Log: request path, method, status, duration, userId (hashed), merchantId.

---

## 9. ANALYTICS (MVP = RULE-BASED, ML-READY)

### What we ship now
Rule-based insights computed in SQL / service layer:

- **Best-selling products** — group by product, sum amount, order desc.
- **Peak hours** — group by hour-of-day of `verified_at`.
- **Best days** — group by day-of-week.
- **Best months** — group by month.
- **Trend** — week-over-week / month-over-month delta with %.
- **Recommendations** — template rules (e.g., "Top sales at Friday 3–5 PM
  → suggest a Friday afternoon promo").
- **Anomaly flag** — Z-score on transaction volume per merchant per hour;
  flag > 3σ.

### ML-ready contract
The API response shape is **FIXED**. When real ML arrives later, only the
implementation changes. Endpoint examples:

- `GET /analytics/merchant/:id/summary`
- `GET /analytics/merchant/:id/best-products`
- `GET /analytics/merchant/:id/peak-hours`
- `GET /analytics/merchant/:id/trend`
- `GET /analytics/merchant/:id/recommendations`
- `GET /analytics/merchant/:id/anomalies`

Each returns `{ insights: [...], generatedAt, model: "rules-v1" }`.
Later `model: "prophet-v1"` etc. Same shape.

### Permission
Analytics endpoints are Merchant-only (and Admin later). Sub-merchants
get `403`.

---

## 10. DATABASE RULES (PostgreSQL + Prisma)

- Every table has: `id` (UUID v7), `createdAt`, `updatedAt`.
- Soft delete via `deletedAt` on user-facing entities (`users`, `merchants`,
  `sub_merchants`, `receipts`). Hard delete never used except by admin purge.
- Every tenant-scoped table has `merchantId` (UUID, indexed, FK).
- Row-Level Security enabled on all tenant tables. Policy uses
  `current_setting('app.current_merchant_id')` set per request by the
  `TenantGuard`.
- Money is stored in **integer minor units (cents/santim)**. NEVER float.
  Column type: `BIGINT` with column name suffix `_minor` (e.g. `amount_minor`).
- Timestamps: `TIMESTAMPTZ` always. Store UTC. Display in `Africa/Addis_Ababa`.
- Indexes: every FK, every column used in WHERE/ORDER BY, composite indexes
  for common query patterns (documented in schema comments).
- Enums: Postgres native enums for stable sets (roles, statuses, bank codes).
- JSONB for flexible payloads (OCR raw, adapter metadata). Not for core data.
- Immutable ledger tables (`credit_transactions`, `audit_logs`) — no UPDATE,
  no DELETE. Enforce with DB rules + app guard.
- All migrations are Prisma migrations. Never `db push` in production.
- Seed script produces: 4 packages, 7 bank codes, 1 admin, 2 merchants,
  3 sub-merchants, 20 sample transactions, 1 sample billing verification.

### Tables (locked list — full design in Step 5)

```
users, otp_codes, devices, sessions, merchants, sub_merchants,
packages, subscriptions, credits_balance_cache, credit_transactions,
billing_verifications, transactions, receipts, bank_references,
duplicate_fingerprints, verification_reviews, audit_logs,
notifications, analytics_snapshots (optional cache)
```

---

## 11. FRONTEND (FLUTTER) RULES

### Folder structure — feature-first

```
mobile/lib/
  main.dart
  app.dart
  core/
    theme/
      app_colors.dart          # SINGLE SOURCE OF COLOR TRUTH
      app_theme.dart           # lightTheme + darkTheme
      app_typography.dart
      app_spacing.dart
      app_radii.dart
      app_shadows.dart
    router/
      app_router.dart
      routes.dart
    network/
      dio_client.dart
      interceptors/
      api_result.dart
    storage/
      secure_storage.dart
      isar_service.dart
    localization/
      app_en.arb
      app_am.arb
      l10n.dart
    widgets/                   # shared widgets (buttons, inputs, cards)
    utils/
    constants/
    errors/
  features/
    auth/
      data/ domain/ presentation/
    verification/
      data/ domain/ presentation/
    transactions/
    analytics/
    sub_merchants/
    billing/
    notifications/
    settings/
    profile/
  l10n/
```

### Theme & color rules (CRITICAL)

- All colors live in `core/theme/app_colors.dart`. No hex anywhere else.
- Both `lightTheme` and `darkTheme` in `app_theme.dart` read from
  `AppColors`. Changing the brand color = editing ONE file.
- Use `Theme.of(context).colorScheme.*` and a custom `AppColors` extension
  (`context.colors.primaryAction`, `context.colors.brandAccent`) everywhere.
- Never use `Colors.green` or `Color(0xFF...)` inline in a widget.

### Palette (locked — full token set)

**Light mode:**
| Token                   | Hex       | Use                                    |
|-------------------------|-----------|----------------------------------------|
| background              | `#FFFFFF` | Screen background                      |
| surface                 | `#F7F8FA` | Cards, sheets                          |
| surfaceAlt              | `#F1F3F5` | Inputs, chips, secondary surfaces      |
| textPrimary             | `#0A0A0A` | Main text                              |
| textSecondary           | `#5A5A5A` | Labels, captions                       |
| textDisabled            | `#9CA3AF` | Disabled text                          |
| onPrimary               | `#FFFFFF` | Text/icons ON primaryAction button     |
| primaryAction           | `#16A34A` | Buttons, links, active states          |
| primaryActionPressed    | `#15803D` | Press feedback                         |
| primaryActionDisabled   | `#A7D9B8` | Disabled button                        |
| brandAccent             | `#39FF14` | Icons, progress rings — never text bg  |
| success                 | `#16A34A` | VERIFIED verdict                       |
| warning                 | `#F59E0B` | Low credits, DUPLICATE verdict         |
| error                   | `#DC2626` | FAKE verdict, destructive actions      |
| info                    | `#2563EB` | Neutral notices                        |
| border                  | `#E5E7EB` | Card outlines, input borders           |
| divider                 | `#F0F1F3` | List separators                        |
| overlay                 | `rgba(0,0,0,.45)` | Modal scrim               |
| snackbarBackground      | `#1C1C1C` | Toast — always near-black              |
| shimmerBase             | `#EDEFF2` | Skeleton base                          |
| shimmerHighlight        | `#F7F8FA` | Skeleton sweep                         |
| transparent             | `0x00000000` | Status bar, ghost backgrounds       |

**Dark mode:**
| Token                   | Hex       | Use                                    |
|-------------------------|-----------|----------------------------------------|
| background              | `#0A0A0A` | Screen background                      |
| surface                 | `#141414` | Cards, sheets                          |
| surfaceAlt              | `#1C1C1C` | Inputs, chips                          |
| textPrimary             | `#FFFFFF` | Main text                              |
| textSecondary           | `#A1A1A1` | Labels, captions                       |
| textDisabled            | `#525252` | Disabled text                          |
| onPrimary               | `#0A0A0A` | Text/icons ON neon button              |
| primaryAction           | `#39FF14` | Neon — 14.8:1 contrast on dark bg      |
| primaryActionPressed    | `#2EE010` | Press feedback                         |
| primaryActionDisabled   | `#1F5A0F` | Disabled button                        |
| brandAccent             | `#39FF14` | Icons, progress rings                  |
| success                 | `#39FF14` | VERIFIED verdict                       |
| warning                 | `#FBBF24` | Low credits, DUPLICATE verdict         |
| error                   | `#F87171` | FAKE verdict, destructive actions      |
| info                    | `#60A5FA` | Neutral notices                        |
| border                  | `#262626` | Card borders (replaces shadows)        |
| divider                 | `#1A1A1A` | List separators                        |
| overlay                 | `rgba(0,0,0,.65)` | Modal scrim               |
| snackbarBackground      | `#1C1C1C` | Toast — same as light mode             |
| shimmerBase             | `#1A1A1A` | Skeleton base                          |
| shimmerHighlight        | `#262626` | Skeleton sweep                         |
| transparent             | `0x00000000` | Status bar, ghost backgrounds       |

### UI/UX principles

- Mobile-first, thumb-friendly, bottom nav for merchants, big tap targets
  (min 48px).
- One primary action per screen. No clutter.
- **Two-input rule:** verification screen ONLY shows "Take Photo" and
  "Upload Image". Nothing else. No QR, no paste.
- Loading states = skeletons (shimmer), not spinners, wherever possible.
- Empty states = friendly illustration + one CTA.
- Errors = human, actionable, never raw stack traces.
- Feedback = haptic on verify success/failure, subtle animations.
- Money formatted as `5,500.00 ETB`. Dates as `14 Jul 2026, 2:08 PM`.
- All strings localized (EN + AM). No hardcoded English in widgets.

### State management rules

- Riverpod providers only. No `setState` for business logic.
- Use `AsyncNotifier` / `Notifier` per feature.
- Repository pattern: `feature/data/repository` → `feature/domain/usecase`
  → `feature/presentation/notifier`.
- All API calls return typed `ApiResult<T>` (`Success | Failure`).
- Never call Dio directly from a widget. Ever.

### Security rules

- Tokens in `flutter_secure_storage` only.
- No secrets in the app. Ever. All sensitive logic on backend.
- Certificate pinning for production API domain (add in later step).
- Screenshot blocking on verification result screen with sensitive info
  (decide later — flag it, don't decide now).
- Biometric prompt required before verifying if user enabled it.

---

## 12. NAMING CONVENTIONS

- **Files:** `snake_case.dart`, `kebab-case.ts` (Nest default), `PascalCase`
  for classes/widgets/components, `camelCase` for functions/vars.
- **Prisma models:** PascalCase singular (`Merchant`, `SubMerchant`).
- **DB tables:** snake_case plural (`merchants`, `sub_merchants`).
- **DTOs:** `CreateXDto`, `UpdateXDto`, `XResponseDto`.
- **Endpoints:** kebab-case, plural resources (`/sub-merchants`,
  `/verifications`, `/credit-transactions`).
- **Enums:** `SCREAMING_SNAKE_CASE`.
- **Env vars:** `SCREAMING_SNAKE_CASE`, prefixed by area where useful
  (`DB_`, `REDIS_`, `R2_`, `AFROMESSAGE_`, `FCM_`, `JWT_`, `VISION_`).

---

## 13. GIT & DELIVERY WORKFLOW

- **Branches:** `main` (prod), `develop` (staging), `feat/*`, `fix/*`,
  `chore/*`. No direct pushes to main.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`,
  `refactor:`, `test:`).
- **PRs:** squash merge. Require CI green.
- **Migrations:** every Prisma migration committed. No manual SQL in prod.
- **Env files:** `.env.example` committed. Real `.env` NEVER committed.
- **Secrets:** GitHub Actions secrets + Hostinger env. Never in repo.

---

## 14. DO / DO NOT (the short version every agent reads)

### DO ✅
- Read this file before every task.
- Ask when a requirement is ambiguous.
- Keep colors in `app_colors.dart`.
- Keep money in integer minor units.
- Enforce tenant isolation in app AND DB (RLS).
- Write DTOs for every request/response.
- Add migrations for every schema change.
- Log every sensitive action to `audit_logs`.
- Return typed results from bank adapters.
- Localize every user-facing string.
- Compress images before upload.
- Use presigned URLs for uploads (never proxy through backend).
- Write tests for critical paths (auth, verification, credits).
- Document every new module with a short README.

### DO NOT ❌
- Hardcode colors, hex, or brand values in widgets.
- Use `Colors.*` outside `core/theme/` — use `AppColors.*` or `context.colors.*`.
- Use `withOpacity()` — use `withValues(alpha:)` instead.
- Use floating point for money.
- Store tokens in SharedPreferences.
- Store raw OTPs.
- Put secrets in the mobile app.
- Call Dio from a widget.
- Use `setState` for business logic.
- Build offline mode.
- Add QR or paste-text verification inputs.
- Build admin features into the mobile app.
- Skip RLS policies on tenant tables.
- Return Prisma models directly from controllers.
- Invent error codes outside the centralized file.
- Log PII, OTPs, or tokens.
- Use `db push` in production.
- Add a new package without asking (both Flutter and Node).
- Deviate from the adapter interface.
- Duplicate verification logic between billing and transactions.
- Skip migrations in commits.
- Merge to main without CI green.
- Hardcode font sizes, radii, or spacing values in widgets.
- Create `FocusNode()` or controllers inside `build()`.
- Animate longer than 400ms.
- Add a 3rd option to `PhotoSourcePicker` (no QR, no paste, ever).
- Add assets > 200KB to the bundle.
- Add a new font without asking Fuad.
- Add a `package.json` or `pubspec.yaml` at the monorepo root.
- Add Nx, Turborepo, or pnpm workspaces without asking.
- Hand-edit `shared/contracts/openapi.yaml` (it's generated).
- Hand-edit `mobile/lib/api/generated/**` (it's generated).
- Create `admin-web/` or `ml-service/` (future phases only).
- Push directly to `main` or `develop`.
- Write outside your agent boundary without asking Fuad.
- Commit a real `.env` file. Ever.
- Hardcode a secret in any source file, test, or example.
- Use obvious-fake-but-real-looking values in examples (use `replace_me`, `change_me`).
- Call `process.env.X` directly in business code — use `AppConfigService` typed getters.
- Add an env var without updating `.env.example`, `env.schema.ts`, Docker compose, CI, and docs.
- Log or return any secret, token, OTP, password, or phone number.
- Put any secret on mobile. No API keys, no signing keys, nothing.
- Auto-rotate secrets without a human following the playbook.
- Reuse dev passwords in staging or prod.
- Force push to protected branches except for the documented secret-removal procedure.
- Skip pre-commit hooks with `--no-verify`.
- Store secrets in issue trackers, PR descriptions, or Slack.
- Use `DECIMAL`, `FLOAT`, or `NUMERIC` for money — always `BIGINT` minor units.
- Skip RLS on any tenant-scoped table.
- Skip an index on any FK column.
- Add a column without a documented use case.
- Use JSONB for data with a stable, known shape.
- Use SQL reserved words as column or table names.
- Mutate `credit_transactions` or `audit_logs` — they are append-only.
- Store a raw OTP anywhere in the database.
- Add `password_hash` or `email` columns — auth is phone-OTP only in MVP.
- Bypass RLS in application code — both layers must always enforce tenant isolation.
- Call `process.env` directly in business code — use `AppConfigService` typed getters.
- Supply an `id` to Prisma creates without using `newId()` — never use Prisma's default uuid().
- Run `prisma db push` in any environment — always use `prisma migrate deploy`.
- Edit a committed migration file — create a new migration instead.
- Hand-edit `prisma/migrations/**` SQL after it has been applied to any environment.
- Call `UPDATE` or `DELETE` on `credit_transactions` or `audit_logs` — they are append-only.
- Read `merchants.credits_balance` for any gating decision — always read the ledger sum.
- Skip writing a `CreditTransaction` row when credits change — every change must be recorded.
- Call `CreditsReconcileService.consumeCredit()` for billing verifications — billing is free.
- Use random UUIDs or random phones for known seed entities — use `IDS` and `PHONES` from `seed/ids.ts`.
- Use `create` where `upsert` is needed in seed modules.
- Seed fake users, merchants, or transactions in production — `SEED_PROFILE=prod` seeds catalog only.
- Change a fixed seed ID without updating `docs/ops/dev-fixtures.md` and all dependent tests.
- Add a new seed module without registering it in `seed/index.ts` in the correct dependency order.
- Insert `credit_transactions` rows without computing `balanceAfter` correctly.
- Insert `transactions` without a matching `verification` row.
- Insert `billing_verifications` without a linked `receipt` row.
- Log actual phone numbers or PII in seed output — use `maskPhone()`.
- Depend on external services (R2, Vision, AfroMessage) during seed unless `SEED_UPLOAD_FIXTURES=true`.
- Add business feature modules in this step — skeleton only until Step 9+.
- Read `process.env` directly in any module — always use `AppConfigService` typed getters.
- Add `console.log` anywhere — use the injected NestJS `Logger` or Pino.
- Bypass the response envelope in controllers — only `/health*`, `/docs`, `/version`, `/` are excluded.
- Change the interceptor order — it must always be Logging → Timeout → Transform.
- Change the error envelope shape — it must always be `{ success, error: { code, message, details }, meta: { requestId } }`.
- Register JWT strategy or OTP logic yet — that is Step 9.
- Add tenant resolution or RBAC logic yet — that is Step 10.
- Add `session storage` in Redis yet — Step 9 decides the key schema.
- Introduce a logger other than Pino — nestjs-pino is the only logger.
- Hardcode `localhost` or ports in service code — always read from `AppConfigService`.

---

## 15. HOW EACH LATER STEP WILL BE DELIVERED

Every subsequent prompt will contain:

1. **Goal** — one paragraph.
2. **Context** — what already exists (files/modules from earlier steps).
3. **Deliverables** — exact files, folders, endpoints, schemas.
4. **Acceptance criteria** — what "done" looks like, testably.
5. **Do NOT** — specific anti-patterns for that step.
6. **Output format** — what the agent should produce (files, explanation,
   migration, etc.).

Follow them in order. Do not skip ahead. Do not merge steps. If a step
feels wrong, stop and ask Fuad before coding.

---

## 16. DESIGN SYSTEM RULES (Step 2 — enforced from here)

### 16.1 The one-file color rule
`app_colors.dart` is the **only** file in the entire project that may
contain hex color values or `Color(0x...)` literals.

Verification command — must return zero results:
```sh
grep -R "#[0-9A-Fa-f]\{6\}" mobile/lib --exclude=app_colors.dart
grep -R "Colors\." mobile/lib --exclude-dir=core/theme
```

`Colors.transparent` is banned. Use `AppColors.transparent` instead.
`Colors.white` / `Colors.black` are banned. Use `AppColors.light.background`
/ `AppColors.dark.background` or the `onPrimary` token.

### 16.2 Color token access pattern
Always access colors via the `context.colors` extension:

```dart
// ✅ Correct
final colors = context.colors;
Container(color: colors.surface)

// ❌ Wrong — never do this
Container(color: Color(0xFFF7F8FA))
Container(color: Colors.white)
```

### 16.3 Adding a new color token
1. Add to `AppColors` constructor, field declarations, `copyWith`, `lerp`.
2. Add light value in `AppColors.light` with a comment.
3. Add dark value in `AppColors.dark` with a comment.
4. Update §11 palette table in this document.
5. Do NOT add a color not in the palette without asking Fuad.

### 16.4 Typography rules
- All text styles come from `AppTypography.*`. Never hardcode font sizes.
- Monetary amounts always use `AppTypography.displayMedium` or `headingSmall`
  with `FontFeature.tabularFigures()`.
- Bank reference numbers always use `AppTypography.mono` + copy-on-tap.
- `AmountText` widget handles all ETB formatting — never format money inline.
- Format: `5,500.00 ETB` (suffix, not prefix, always 2 decimal places).

### 16.5 Spacing and radii rules
- All spacing from `AppSpacing.*` (8pt grid). Never hardcode `16.0`, `24.0`, etc.
- All radii from `AppRadii.*`. Never hardcode `BorderRadius.circular(x)`.
- Minimum interactive tap target: `AppSpacing.minTapTarget` (48px).

### 16.6 Deprecation rules (Flutter API)
- Use `withValues(alpha: x)` not `withOpacity(x)` — `withOpacity` is
  deprecated in Flutter 3.27+.
- Use `WidgetStateProperty` not `MaterialStateProperty` (Flutter ≥ 3.16).
- Use `WidgetState` not `MaterialState` (Flutter ≥ 3.16).

### 16.7 Widget rules
Every widget in `core/widgets/` must:
- Read all colors from `context.colors`.
- Use `AppTypography`, `AppSpacing`, `AppRadii` — no hardcoded values.
- Have a doc comment: what it does, when to use, when NOT to use.
- Support both light and dark mode.
- Meet 48px minimum tap target for interactive elements.
- Never call Dio, Riverpod providers, or business logic directly.

### 16.8 Localization rules
- Zero hardcoded user-facing strings in any widget.
- All strings in `lib/l10n/app_en.arb` + `lib/l10n/app_am.arb`.
- Run `flutter gen-l10n` after every ARB change.
- Amharic font: `NotoSansEthiopic`, loaded conditionally when AM locale active.
- Currency display: `5,500.00 ETB` — handled by `AmountText` widget.
- Date display: `14 Jul 2026, 2:08 PM` — use `intl` formatters.

### 16.9 Asset rules
- Bank logos: `assets/banks/{code}.png` (lowercase code). PNG format.
- Max asset size: 200KB in bundle. Larger = download on demand from R2.
- Font files: Inter (400/500/600/700) + NotoSansEthiopic (400/500/600/700).
- No new fonts without asking Fuad.
- SVG for icons/logos, PNG only for illustrations and bank logos.

### 16.10 Motion and haptics
- Duration tokens: fast=150ms, base=250ms, slow=400ms. Never animate > 400ms.
- Default curve: `Curves.easeOutCubic`.
- Respect `MediaQuery.disableAnimations` — fall back to static if true.
- Haptics: VERIFIED=`mediumImpact`, FAKE/ERROR=`heavyImpact`,
  DUPLICATE=`selectionClick`, low credits=`vibrate`.

### 16.11 Memory safety in widgets
- Never create `FocusNode()`, `TextEditingController()`, or
  `AnimationController()` inside a `build()` method.
- All controllers/nodes created in `initState`, disposed in `dispose`.
- Use `Focus(onKeyEvent:)` not `KeyboardListener(focusNode: FocusNode(), ...)`.

### 16.12 Dark mode elevation
- **Light mode**: elevation via `AppShadows.elevation1/2/3` (box shadows).
- **Dark mode**: elevation via `border: Border.all(color: colors.border)`.
  No shadows in dark mode.

### 16.13 Fintech widget reference

| Widget            | File                                       | Key rule                              |
|-------------------|--------------------------------------------|---------------------------------------|
| `AmountText`      | `fintech/amount_text.dart`                 | Always pass integer minor units       |
| `VerdictBadge`    | `fintech/verdict_badge.dart`               | 6 verdicts, large/small sizes         |
| `CreditMeter`     | `fintech/credit_meter.dart`                | Pass `-1` for unlimited plans         |
| `BankLogo`        | `fintech/bank_logo.dart`                   | Falls back to initials if asset missing|
| `ReferenceChip`   | `fintech/reference_chip.dart`              | Mono text + copy button               |
| `PhotoSourcePicker`| `fintech/photo_source_picker.dart`        | **Camera + Gallery ONLY. No QR/paste.**|

---

## 17. MONOREPO STRUCTURE RULES (Step 3 — enforced from here)

### 17.1 Workspace root

```
yene-verify/          ← monorepo root (no package.json or pubspec here)
├── backend/          ← NestJS API (Kiro's domain)
├── mobile/           ← Flutter app (OpenCode's domain)
├── shared/           ← contracts + constants (co-owned, read by both)
├── docker/           ← Docker Compose + Nginx + init SQL
├── scripts/          ← dev automation scripts
├── docs/             ← architecture, api, ops, brand, product docs
└── .github/          ← CI workflows, PR template, issue templates
```

No `package.json`, `pubspec.yaml`, or monorepo meta-tool at root.
Each subproject (`backend/`, `mobile/`) is independently buildable.

### 17.2 Agent boundary (hard rule)

| Agent | Owns — may write | Co-reads — never writes without asking |
|-------|-----------------|----------------------------------------|
| Kiro | `backend/`, `docker/`, `scripts/` (backend), `docs/architecture/`, `docs/api/`, `docs/ops/` | `shared/`, `mobile/` |
| OpenCode | `mobile/`, `docs/brand/`, `docs/product/faq.md` | `shared/`, `backend/` |
| Fuad | Everything | — |

**If an agent needs to change something outside its zone → STOP and ask Fuad.**

### 17.3 Shared contracts (never hand-edit)

| File | Generated by | Consumed by |
|------|-------------|-------------|
| `shared/contracts/openapi.yaml` | `cd backend && npm run swagger:export` | `scripts/gen-api-client.sh` → `mobile/lib/api/generated/` |
| `shared/contracts/error-codes.json` | `cd backend && npm run export:error-codes` | mobile error handling |
| `shared/contracts/bank-codes.json` | Fuad edits | both backend adapters and mobile UI |
| `shared/contracts/roles.json` | Fuad edits | both backend guards and mobile permission checks |
| `shared/constants/packages.json` | Fuad edits | backend seed + mobile pricing screen |

Hand-editing `openapi.yaml` fails the `shared-ci.yml` CI guard.
Hand-editing generated client files `mobile/lib/api/generated/**` fails CI.

### 17.4 API contract sync workflow

Every API change requires a sync:
1. Backend changes endpoint.
2. Run `cd backend && npm run swagger:export` → commits `shared/contracts/openapi.yaml`.
3. Run `./scripts/gen-api-client.sh` → commits `mobile/lib/api/generated/`.
4. Both in **one PR**.

### 17.5 Branch naming

```
feat/backend-<desc>   feat/mobile-<desc>   feat/shared-<desc>
fix/backend-<desc>    fix/mobile-<desc>
chore/shared-<desc>   docs/<desc>          infra/<desc>
release/<version>     hotfix/<version>
```

Never push directly to `main` or `develop`.

### 17.6 Docker — local dev

Start all services: `docker compose -f docker/docker-compose.dev.yml up -d`

| Service | Port | Purpose |
|---------|------|---------|
| postgres | 5432 | Primary DB |
| redis | 6379 | Cache + BullMQ |
| mailhog | 1025 (SMTP) / 8025 (UI) | Local email |
| minio | 9000 (S3 API) / 9001 (console) | Cloudflare R2 substitute |

No cloud dependency required for local development.

### 17.7 Scripts reference

| Script | Purpose |
|--------|---------|
| `./scripts/bootstrap.sh` | One-command local setup (idempotent) |
| `./scripts/gen-api-client.sh` | Regenerate Dart client from openapi.yaml |
| `./scripts/check-no-hardcoded-colors.sh` | CI guard — zero hex outside app_colors.dart |
| `./scripts/check-no-hardcoded-strings.sh` | CI guard — zero hardcoded EN strings in features/ |
| `./scripts/seed-dev.sh` | Seed DB + ensure MinIO buckets |

### 17.8 Docs ownership

| Folder | Owner | Update when |
|--------|-------|-------------|
| `docs/architecture/` | Kiro | System design changes |
| `docs/api/` | Kiro | API conventions or error codes change |
| `docs/ops/` | Kiro | Deploy / infra changes |
| `docs/brand/` | OpenCode | Design system changes |
| `docs/product/` | Fuad | Product decisions change |

Every doc must start with: `Last updated: YYYY-MM-DD | Owner: <name>`.
Out-of-date docs are worse than no docs — delete or update, never ignore.

### 17.9 What is NOT in the monorepo (yet)

- ❌ `admin-web/` — Next.js admin dashboard (future phase)
- ❌ `ml-service/` — ML inference service (future phase)
- ❌ Nx / Turborepo — not needed for 2 projects
- ❌ pnpm workspaces — not needed for MVP

---

## 18. ENVIRONMENT & SECRETS RULES (Step 4 — enforced from here)

### 18.1 Three categories of configuration

| Category | Examples | Rule |
|----------|---------|------|
| **Public constants** | App name, bank codes, package prices | In `shared/constants/*.json`. Committed. Reviewed like code. |
| **Environment config** | DB host, log level, feature flags | In `.env` files. `.env.example` committed. Real `.env` gitignored. Safe to log. |
| **Secrets** | JWT keys, API keys, DB password, private keys | Runtime injection only. Never in repo, logs, errors, or mobile. |

### 18.2 Backend config files

| File | Purpose | Committed? |
|------|---------|------------|
| `backend/.env.example` | Documents every variable with type + sensitivity tag | ✅ Yes |
| `backend/.env` | Real values | ❌ Gitignored |
| `backend/src/config/env.schema.ts` | Zod schema — validates every var on boot | ✅ Yes |
| `backend/src/config/config.service.ts` | Typed getters — the only way to read config | ✅ Yes |

**Boot behavior:** missing or malformed vars → app exits with a clear error listing the keys (never values). Placeholder values (`change_me`, `replace_me`) → app refuses to boot in staging/prod.

### 18.3 Mobile config files

| File | Purpose | Committed? |
|------|---------|------------|
| `mobile/dart_defines.example.json` | Documents all `--dart-define` keys | ✅ Yes |
| `mobile/dart_defines.dev.json` | Local dev values (all public) | ✅ Yes (no secrets) |
| `mobile/dart_defines.staging.json` | Staging values | ⚠️ Only if no secrets |
| `mobile/dart_defines.prod.json` | Production values | ⚠️ Only if no secrets |
| `mobile/lib/core/env/app_env.dart` | `abstract final class AppEnv` — typed getters | ✅ Yes |

**Rule:** Mobile holds **zero secrets**. No API keys, no signing keys, no bank credentials. If a feature seems to need a secret on mobile, the design is wrong — stop and ask Fuad.

**Usage:** `flutter run --dart-define-from-file=mobile/dart_defines.dev.json`

**Reading env in code:** Only via `AppEnv.apiBaseUrl`, `AppEnv.isDev`, etc. Never call `String.fromEnvironment()` outside `app_env.dart`.

### 18.4 Adding a new environment variable

Every new variable requires **all five** of these — a PR missing any fails review:

1. Add to `backend/.env.example` with a `[public/config/secret]` comment.
2. Add to `backend/src/config/env.schema.ts` with type + default + validation.
3. Add to `docker/docker-compose.dev.yml` if needed locally.
4. Add to Hostinger env panel + GitHub Actions secrets if it's a secret.
5. Run `./scripts/gen-env-docs.sh` to regenerate `docs/ops/environment.md`.

### 18.5 Reading config in backend code

**Always use `AppConfigService` typed getters. Never use `process.env` directly.**

```ts
// ✅ Correct
constructor(private readonly config: AppConfigService) {}
const secret = this.config.jwt.accessSecret;
const url = this.config.database.url;

// ❌ Wrong — never do this
process.env.JWT_ACCESS_SECRET
this.configService.get('JWT_ACCESS_SECRET')  // string-based access
```

### 18.6 Pino log redaction

All log statements are automatically redacted by Pino for the keys in `backend/src/common/logger/redact.ts`. The list covers: `password`, `otp`, `token`, `accessToken`, `refreshToken`, `authorization`, `apiKey`, `secret`, `privateKey`, `pin`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `AFROMESSAGE_API_KEY`, `R2_SECRET_ACCESS_KEY`, `FCM_PRIVATE_KEY`, `SMTP_PASS`, and more.

Sentry `beforeSend` scrubs the same list via `scrubSensitiveData()` from the same file.

**Never log raw phone numbers.** Hash or truncate before logging.

### 18.7 Secret rotation schedule

| Secret | Cadence |
|--------|---------|
| JWT signing keys | Every 90 days |
| AfroMessage API key | Every 180 days |
| Cloudflare R2 keys | Every 180 days |
| GCP + Firebase service accounts | Every 180 days |
| DB + Redis passwords | Every 180 days |
| Deploy SSH keys | Every 180 days |
| Any | Immediately on suspected compromise |

Rotation helper: `./scripts/rotate-jwt.sh`
Full playbook: `docs/ops/rotation.md`
Live registry: `docs/ops/secrets.md` — update after every rotation.

### 18.8 Pre-commit hooks

Installed via `pre-commit install`. Runs on every `git commit`:

| Hook | What it blocks |
|------|---------------|
| gitleaks | Secrets in staged files |
| trufflehog | High-entropy / verified secrets |
| detect-private-key | PEM private keys |
| no-commit-to-branch | Direct commits to `main` / `develop` |
| check-added-large-files | Files > 500KB |
| no-real-env (local) | Real `.env` files |
| no-hardcoded-colors (local) | Hex colors outside theme |
| no-hardcoded-strings (local) | Hardcoded EN strings in features |

**Never use `--no-verify`.** If a hook fires, fix the issue.

### 18.9 CI secret scanning

Every GitHub Actions workflow runs `gitleaks detect` as a safety net.
`check-env-sync.sh` runs in `backend-ci.yml` to catch schema/example drift.

### 18.10 If a secret is accidentally committed

```
1. Rotate the secret immediately — assume it is compromised.
2. Remove from git history: git filter-repo --path <file> --invert-paths
3. Force push (only allowed for this procedure).
4. Write a post-incident report in docs/ops/incidents/YYYY-MM-DD-<name>.md
5. See docs/ops/rotation.md — Emergency Rotation section.
```

---

## 19. DATABASE SCHEMA RULES (Step 5 — enforced from here)

> Full design document: `docs/architecture/05-database.md`
> This section is the pocket reference. Read the full doc before writing any Prisma model.

### 19.1 Locked tables (21 total)

```
users               otp_codes           devices             sessions
merchants           sub_merchants       packages            subscriptions
credit_transactions billing_verifications receipts          verifications
transactions        duplicate_fingerprints verification_reviews audit_logs
notifications       exports             analytics_snapshots bank_reference_lookups
feature_flags
```

Do not add a table without a design review. Do not remove a column without a migration.

### 19.2 Enums (21 total — never use raw strings for these domains)

```
user_role           user_status         merchant_status     sub_merchant_status
device_platform     otp_purpose         bank_code           verification_status
verification_source verification_input  transaction_status  package_code
subscription_status credit_tx_type      billing_status      review_status
notification_channel notification_type  export_format       export_status
actor_type
```

Adding a value to an enum = a new Prisma migration. No exceptions.

### 19.3 Money rules

- Column type: `BIGINT`. Suffix: `_minor`. Example: `amount_minor`, `price_minor`.
- 199.00 ETB = `19900`. Never divide or multiply floats.
- `AmountText` widget handles display formatting — never format money inline.
- `CHECK (amount_minor > 0)` or `CHECK (amount != 0)` on every money column.

### 19.4 Immutable ledgers

Two tables are append-only with Postgres `RULE` blocks preventing mutations:

| Table | Why immutable |
|-------|--------------|
| `credit_transactions` | Every credit change is a ledger entry. The running balance is always derived from `SUM()`. |
| `audit_logs` | Compliance and fraud investigation require an unalterable audit trail. |

**Never call `UPDATE` or `DELETE` on these tables from application code.**

### 19.5 Tenant isolation (two layers, always both)

**Layer 1 — RLS:** Every tenant-scoped table has `ENABLE ROW LEVEL SECURITY` + a policy using `current_merchant_id()` session variable set by `TenantGuard`.

**Layer 2 — Application:** Every service query includes `WHERE merchant_id = :merchantId`. Neither layer is optional.

The session variable is set by `TenantGuard` before every request:
```sql
SET LOCAL app.current_merchant_id = '<uuid>';
SET LOCAL app.current_role = 'MERCHANT';
```

### 19.6 Standard column set

Every mutable table has:
- `id UUID` — UUID v7, PK
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` — maintained by trigger
- `deleted_at TIMESTAMPTZ` — soft delete (user-facing tables only)

Immutable tables (`credit_transactions`, `audit_logs`, `bank_reference_lookups`) have only `created_at`.

### 19.7 Index rules

- Every FK column: indexed.
- Every `WHERE`/`ORDER BY` column: indexed.
- Time-series queries: composite `(merchant_id, <timestamp> DESC)`.
- Partial indexes for hot subsets (active devices, unread notifications, active subscriptions).
- UNIQUE partial index: `subscriptions(merchant_id) WHERE status = 'ACTIVE'` — one active plan per merchant.

### 19.8 `updated_at` trigger

Every mutable table gets this trigger (created once, applied per table in migration):
```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
```

### 19.9 Credit balance rule

`merchants.credits_balance` is a **cached** column for fast reads. It is **not** authoritative.
- Source of truth: `SELECT SUM(amount) FROM credit_transactions WHERE merchant_id = X`
- The cache is updated transactionally when credits change.
- A nightly reconciliation job compares cache vs ledger sum and alerts on drift.
- Any code that **gates** a verification (is this merchant allowed?) reads the ledger sum — never the cache.

### 19.10 Verification + billing reuse

`verifications` is the single source of truth for all OCR + adapter pipeline results.
- `source = 'TRANSACTION'` → writes a `transactions` row on VERIFIED.
- `source = 'BILLING'` → writes a `billing_verifications` row, activates subscription on APPROVED.

The verification processor does not know or care which source it is processing. The caller sets the `source` column.

### 19.11 Duplicate detection

Fingerprint: `SHA-256(bank_code + ':' + reference_normalized)`

- Written to `duplicate_fingerprints` on first VERIFIED.
- On collision: new verification → `status = DUPLICATE`, `total_hits++`.
- Cross-merchant detection: works automatically (fingerprint is global, not tenant-scoped).

### 19.12 DB roles

| Role | Use | RLS bypass |
|------|-----|------------|
| `yene_app` | Backend runtime | No |
| `yene_migrator` | Prisma migrations only | Yes |
| `yene_readonly` | Analytics / reporting | No |

The backend **always** connects as `yene_app`. Never connect production as a superuser for application queries.

---

## 20. PRISMA & MIGRATION RULES (Step 6 — enforced from here)

### 20.1 File locations

| File | Purpose |
|------|---------|
| `backend/prisma/schema.prisma` | Single source of truth for all models + enums |
| `backend/prisma/migrations/20260924000002_rls_policies/` | RLS policies, DB roles, UUID fallback defaults |
| `backend/prisma/migrations/20260924000003_triggers_and_constraints/` | `set_updated_at` trigger, immutable ledger rules, CHECK constraints, partial indexes |
| `backend/prisma/seed.ts` | Idempotent dev seed — run with `npx prisma db seed` |
| `backend/src/prisma/prisma.service.ts` | `PrismaService` — the only way to query the DB |
| `backend/src/common/utils/uuid.ts` | `newId()` — the only way to generate IDs |
| `backend/src/credits/credits-reconcile.service.ts` | Credit ledger operations + nightly reconciliation |

### 20.2 ID generation rule

**Every Prisma `create` call MUST supply `id: newId()`.**

```ts
// ✅ Correct
import { newId } from '../common/utils/uuid';
await prisma.user.create({ data: { id: newId(), phone, ... } });

// ❌ Wrong — Prisma default produces UUIDv4, not v7
await prisma.user.create({ data: { phone, ... } });
```

`newId()` produces UUID v7 (time-sortable). The DB has a `uuid_generate_v4()` fallback to prevent NULL, but the app must always supply v7.

### 20.3 Migration workflow

```bash
# Dev — create a new migration from schema changes
cd backend
npx prisma migrate dev --name <descriptive_name>

# CI / prod — apply committed migrations (never creates new ones)
npx prisma migrate deploy

# Never in prod
npx prisma db push          # ❌ forbidden
npx prisma migrate reset    # ❌ forbidden in prod
```

Rules:
- Every schema change = a new `prisma migrate dev` commit.
- Never edit a migration file after it has been applied to any environment.
- The two custom migrations (RLS, triggers) are applied after the base schema migration using `npx prisma migrate resolve --applied <name>` if Prisma does not auto-detect them, OR by including them as raw SQL in Prisma's migration folder.
- `SHADOW_DATABASE_URL` must be set for `prisma migrate dev` to work in CI.

### 20.4 Prisma model conventions

| Convention | Example |
|-----------|---------|
| `@@map("snake_case_plural")` | `@@map("credit_transactions")` |
| `@map("snake_case")` on every field | `@map("merchant_id")` |
| `@db.Uuid` on all UUID fields | `id String @id @db.Uuid` |
| `@db.Timestamptz(6)` on all timestamps | `createdAt DateTime @db.Timestamptz(6)` |
| `BigInt` for all money | `amountMinor BigInt @map("amount_minor")` |
| `Json` for all JSONB columns | `adapterMetadata Json?` |
| No `@default` on `id` fields | App supplies via `newId()` |
| `@updatedAt` on mutable `updatedAt` | Triggers also maintain this |

### 20.5 PrismaService usage

```ts
// ✅ Inject PrismaService — never instantiate PrismaClient directly
constructor(private readonly prisma: PrismaService) {}

// ✅ Set tenant context at start of every authenticated request
await this.prisma.setTenantContext(merchantId, role, userId);

// ✅ Use transactions for any multi-step operation
await this.prisma.$transaction(async (tx) => { ... });

// ❌ Never bypass PrismaService
const client = new PrismaClient(); // forbidden
```

### 20.6 Credit ledger rules

The `credit_transactions` table is **append-only**. The DB has RULE blocks preventing UPDATE/DELETE. The application must also never attempt them.

| Operation | Method | Notes |
|-----------|--------|-------|
| Check if merchant can verify | `creditsReconcile.hasCreditsForVerification(id)` | Reads ledger, not cache |
| Consume 1 credit | `creditsReconcile.consumeCredit(id, verificationId)` | FOR UPDATE lock |
| Grant credits | `creditsReconcile.grantCredits(id, amount, opts)` | After billing approved |
| Read authoritative balance | `creditsReconcile.getLedgerBalance(id)` | `SUM(amount)` |
| Nightly cache fix | `creditsReconcile.reconcileAll()` | Cron 02:00 daily |

`merchants.credits_balance` is a **read-cache only** — never use it for gating.

### 20.7 RLS session context

TenantGuard must call `prisma.setTenantContext()` at the start of every authenticated request:

```ts
await this.prisma.setTenantContext(
  request.merchant.id,   // app.current_merchant_id
  request.user.role,     // app.current_role
  request.user.id,       // app.current_user_id
);
```

Without this, RLS policies will block all tenant-scoped queries for non-admin users.

### 20.8 Seed script

```bash
cd backend
npx prisma db seed
```

- Idempotent — safe to re-run at any time.
- Dev accounts: see `backend/prisma/seed.ts` header for phone numbers and PIN.
- Never run against production — seed is dev-only data.

### 20.9 Migration order

```
20260924000001_init           ← base schema (auto-generated by prisma migrate dev)
20260924000002_rls_policies   ← RLS, DB roles, UUID fallback defaults
20260924000003_triggers_and_constraints ← updated_at trigger, RULE blocks, CHECKs, partial indexes
```

All three must be applied in order on every fresh database.

---

## 21. SEED DATA RULES (Step 7 — enforced from here)

### 21.1 Seed file locations

| File | Purpose |
|------|---------|
| `backend/prisma/seed.ts` | Entry point — calls `runSeed()` |
| `backend/prisma/seed/index.ts` | `runSeed()` orchestrator — strict dependency order |
| `backend/prisma/seed/ids.ts` | **All fixed UUIDs and phone numbers** |
| `backend/prisma/seed/profiles.ts` | `SeedProfile` type, `assertProfileAllowed()` guard |
| `backend/prisma/seed/helpers.ts` | `log()`, `maskPhone()`, `daysAgo()`, `etbToMinor()` |
| `backend/prisma/seed/*.seed.ts` | One module per entity concern |
| `backend/prisma/fixtures/bank-references.json` | Sample bank refs for seed + adapter tests |
| `backend/prisma/fixtures/sample-ocr-text.json` | Raw OCR text per bank for mock OCR service |
| `docs/ops/dev-fixtures.md` | Human reference for all fixed IDs and phones |

### 21.2 Profiles

| Profile | Command | Seeds | When |
|---------|---------|-------|------|
| `minimal` | `npm run seed:minimal` | Packages + flags + admin | CI |
| `dev` | `npm run seed:dev` | Everything | Local dev (default) |
| `staging` | `npm run seed:staging` | Everything + extended | QA / demos |
| `prod` | `npm run seed:prod` | Packages + flags + admin | Production first-deploy |

`SEED_PROFILE=dev` + `NODE_ENV=production` → **throws, never runs**.

### 21.3 Fixed IDs rule

Every known seed entity has a deterministic UUID in `seed/ids.ts`. No random IDs for fixture data.

```ts
// ✅ Correct — deterministic, testable
import { IDS, PHONES } from '../seed/ids';
await prisma.user.upsert({ where: { phone: PHONES.merchant1 }, create: { id: IDS.merchant1User, ... } });

// ❌ Wrong — breaks test isolation
await prisma.user.upsert({ where: { phone: '+251999...' }, create: { id: newId(), ... } });
```

Changing a fixed ID requires updating **both** `seed/ids.ts` **and** `docs/ops/dev-fixtures.md` in the same commit, plus all tests that reference the old ID.

### 21.4 Idempotency rule

Every seed module uses `upsert` keyed on a stable unique field. Running seed twice produces identical state.

Exception: `credit_transactions` and `audit_logs` are immutable — use `try/catch` around `create` to skip existing rows.

### 21.5 Seed module dependency order

```
packages → feature-flags → admin
  → users → merchants → sub-merchants → subscriptions
  → receipts → verifications → transactions
  → credits → billing → reviews → notifications → audit
```

Do not reorder. Each module depends on the entities above it.

### 21.6 Credits ledger in seed

Every `credit_transactions` row must have a correct `balanceAfter`:

```ts
// Compute running balance sequentially — never guess
let balance = 400n;
for (const v of verifications) {
  balance -= 1n;
  await prisma.creditTransaction.create({ data: { amount: -1n, balanceAfter: balance, ... } });
}
// Reconcile cache
await prisma.merchant.update({ data: { creditsBalance: balance } });
```

After seed, `merchants.creditsBalance` must equal `SUM(credit_transactions.amount)` for the merchant.

### 21.7 Dev fixture counts (expected after `npm run seed:dev`)

| Entity | Count |
|--------|-------|
| Users | 6 |
| Merchants | 2 |
| Sub-merchants | 3 |
| Verifications | 18 (15 normal + 3 billing) |
| Transactions | 10 |
| Billing verifications | 3 |
| Credit transactions | 13 |
| Notifications | 10 |
| Audit logs | 20 |

Full reference: `docs/ops/dev-fixtures.md`

### 21.8 Fixture files

`backend/prisma/fixtures/bank-references.json` — sample bank references per bank, format-correct, all fake. Used by `verifications.seed.ts` and bank adapter unit tests.

`backend/prisma/fixtures/sample-ocr-text.json` — raw OCR text per bank. Used by mock OCR service when `VISION_MOCK=true`.

Never put real transaction references in fixture files.

---

## 22. NESTJS SCAFFOLD RULES (Step 8 — enforced from here)

### 22.1 Module structure

| Module | Global | File path | Purpose |
|--------|--------|-----------|---------|
| `AppConfigModule` | ✅ | `src/config/` | Typed env, Zod validation, boot guard |
| `PrismaModule` | ✅ | `src/prisma/` | PrismaClient + RLS helpers |
| `RedisModule` | ✅ | `src/redis/` | ioredis wrapper |
| `QueueModule` | ✅ | `src/queue/` | BullMQ root + 5 queues |
| `StorageModule` | ✅ | `src/storage/` | R2/Minio S3 wrapper |
| `HealthModule` | ❌ | `src/health/` | `/health` + `/health/ready` |

All global modules are imported once in `AppModule`. Feature modules never re-import them.

### 22.2 Request lifecycle (order is fixed)

```
Client request
  → RequestIdMiddleware (attach x-request-id)
  → ThrottlerGuard (rate limit)
  → [JwtAuthGuard → RolesGuard → TenantGuard — added in Steps 9–10]
  → LoggingInterceptor (outermost)
  → TimeoutInterceptor
  → TransformInterceptor
  → Controller/Handler
  → TransformInterceptor wraps response in { success, data, meta }
  ← AllExceptionsFilter catches any thrown error → { success, error, meta }
```

Never reorder interceptors. Never bypass the response envelope except for `/health*`, `/docs`, `/version`, `/`.

### 22.3 Reading config in NestJS code

```ts
// ✅ Correct — inject AppConfigService
constructor(private readonly config: AppConfigService) {}
const url = this.config.database.url;
const isDev = this.config.runtime.isDev;

// ❌ Wrong — never
process.env.DATABASE_URL
this.configService.get('DATABASE_URL')  // string-based
```

### 22.4 withTenant() — mandatory for all tenant DB queries

Every authenticated request that touches a tenant-scoped table **must** run inside `PrismaService.withTenant()`. Background jobs must call it explicitly.

```ts
const result = await this.prisma.withTenant(
  { userId, role, merchantId },
  (tx) => tx.transaction.findMany({ where: { merchantId } }),
);
```

`TenantGuard` (Step 10) wraps authenticated request handlers automatically.

### 22.5 Error handling

- Throw `AppError` subclasses from `common/errors/domain-errors.ts` in services.
- `AllExceptionsFilter` converts them to the standard error envelope automatically.
- Never build the error envelope manually in a controller.
- Never expose stack traces or raw Prisma errors to the client.

### 22.6 Logging rules

- Inject `Logger` from `@nestjs/common` in every service: `private readonly logger = new Logger(MyService.name)`.
- Never use `console.log` — it will fail the ESLint `no-console` rule.
- Pino redacts all fields in `REDACT_PATHS` (see `src/common/logger/redact.ts`).
- Phone numbers logged via `maskPhone()` only.

### 22.7 Response envelope

**Success** (from TransformInterceptor):
```json
{ "success": true, "data": {...}, "meta": { "requestId": "..." } }
```

**Error** (from AllExceptionsFilter):
```json
{ "success": false, "error": { "code": "...", "message": "...", "details": {} }, "meta": { "requestId": "..." } }
```

This shape is locked. Every API client depends on it.

### 22.8 Placeholders (fill in later steps)

| File | What's missing | Added in |
|------|---------------|---------|
| `JwtAuthGuard` | JWT Passport strategy | Step 9 |
| `TenantGuard` | Full RLS context set | Step 10 |
| `DeviceGuard` | Device/session validation | Step 9 |
| `RolesGuard` | Fully registered globally | Step 10 |

### 22.9 Queue names

All BullMQ queue names come from `src/queue/queue.constants.ts`:
`verification`, `notification`, `export`, `analytics`, `maintenance`.

Never hardcode queue name strings. Always use `QUEUE_NAMES.X`.

### 22.10 Health endpoints

- `GET /health` — liveness, no deps, always 200 if process is alive. `@Public()`.
- `GET /health/ready` — readiness, checks Postgres + Redis + Storage. `@Public()`.

These endpoints are excluded from the response envelope and global prefix.

---

## 23. FINAL WORD

This is a fintech product handling real money for real Ethiopian
businesses. **Correctness > speed. Security > features. Clarity > cleverness.**
If you are unsure, ask. If you are sure but it violates this document,
you are wrong. Re-read §14.

Welcome to Yene Verify. Build it like your reputation depends on it —
because it does.

---

*END OF MASTER CONTEXT PROMPT v1.7*
