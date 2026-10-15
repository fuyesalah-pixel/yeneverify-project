# Tech Stack

> Last updated: 2026-09-24 | Owner: Kiro

---

## Mobile (Flutter)

| Layer | Library | Notes |
|-------|---------|-------|
| State | flutter_riverpod ^2.5.1 | AsyncNotifier / Notifier per feature |
| Navigation | go_router ^13.2.1 | Deep links, nested routes |
| HTTP | dio ^5.4.3 | Auth + logging + retry interceptors |
| Models | freezed + json_serializable | Immutable, union types |
| Local cache | isar ^3.1.0 | NOT offline-first — internet required |
| Secure storage | flutter_secure_storage ^9.0.0 | Tokens only — never SharedPreferences |
| Biometrics | local_auth ^2.2.0 | Fingerprint / Face ID |
| Push | firebase_messaging ^14.9.1 | FCM |
| Images | image_picker + camera | Only 2 inputs: camera + gallery |
| i18n | flutter_localizations + intl | EN + AM at launch |
| Charts | fl_chart ^0.68.0 | Analytics screens |
| Skeletons | shimmer ^3.0.0 | Loading states |
| Animations | lottie ^3.1.2 | Success/empty state animations |
| Crash reporting | sentry_flutter ^7.19.0 | |

## Backend (NestJS)

| Layer | Library | Notes |
|-------|---------|-------|
| Framework | NestJS (Node 20 LTS) | TypeScript strict |
| ORM | Prisma | Migrations only — no db push in prod |
| Database | PostgreSQL 16 | RLS enabled on all tenant tables |
| Cache/Queue broker | Redis 7 | BullMQ backend |
| Queue | BullMQ + @nestjs/bullmq | OCR, verification, notifications, exports |
| Auth | Passport + JWT | Access (15m) + Refresh (30d) tokens |
| Validation | class-validator + class-transformer | DTOs only |
| API docs | Swagger / OpenAPI | Auto-generated at /docs |
| Logging | Pino | Structured, requestId on every request |
| Storage | @aws-sdk/client-s3 | Cloudflare R2 (S3-compatible) |
| OCR | @google-cloud/vision | Primary; ML Kit fallback on client |
| Headless browser | Puppeteer | Telebirr/Awash JS-rendered pages |
| PDF/HTML parsing | pdf-parse + cheerio | Zemen + M-Pesa receipts |
| SMS (OTP) | AfroMessage REST API | Ethiopian SMS gateway |
| Push | Firebase Admin SDK | FCM |
| Error tracking | Sentry | |

## Infrastructure

| Component | Tech | Notes |
|-----------|------|-------|
| VPS | Hostinger (Ubuntu 22.04 LTS) | Production host |
| Reverse proxy | Nginx | TLS via Let's Encrypt |
| Object storage | Cloudflare R2 | Receipts + exports |
| CI/CD | GitHub Actions | See .github/workflows/ |
| Container | Docker + Docker Compose | Local dev + prod |
| Monitoring | BetterStack / UptimeRobot | Uptime alerts |

## NOT in the stack (MVP)

- ❌ No Nx / Turborepo — two projects don't need a meta-build system
- ❌ No admin web yet — Next.js + Tailwind (future phase)
- ❌ No real ML — rule-based analytics only (schema is ML-ready)
- ❌ No multi-region — single Hostinger VPS for MVP
