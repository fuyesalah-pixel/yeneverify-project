# Auth Client Handshake

> Last updated: 2026-09-30 | Owner: Kiro

How the mobile client and the backend establish, refresh, and tear down a
session. The backend source of truth is `backend/src/auth/`; the exported
contract is `shared/contracts/openapi.yaml`.

---

## Login flow (phone OTP)

```
Mobile                              Backend
  │ POST /api/v1/auth/request-otp      │
  │───────────────────────────────────▶│  hash OTP (OTP_HASH_ROUNDS), store with TTL,
  │                                    │  send via AfroMessage (mock in development)
  │◀───────────────────────────────────│  AUTH_OTP_SENT
  │ POST /api/v1/auth/verify-otp       │
  │  { phone, code, device metadata }  │
  │───────────────────────────────────▶│  verify hash, check attempts/TTL,
  │                                    │  create device + session,
  │                                    │  mint access JWT (kid: access-v1)
  │                                    │  mint refresh JWT (kid: refresh-v1)
  │◀───────────────────────────────────│  { accessToken, refreshToken, user }
```

Endpoints: `backend/src/auth/auth.controller.ts`
(`request-otp`, `verify-otp`, `refresh`, `logout`, `logout-all`).

---

## Token properties

| Property | Access token | Refresh token |
|---|---|---|
| TTL | `JWT_ACCESS_TTL` (default 15m) | `JWT_REFRESH_TTL` (default 30d) |
| Secret | `JWT_ACCESS_SECRET` (≥64 chars) | `JWT_REFRESH_SECRET` (≥64 chars) |
| `kid` header | `JWT_ACCESS_KID` (`access-v1`) | `JWT_REFRESH_KID` (`refresh-v1`) |
| Issuer / audience | `yene-verify` / `yene-verify-mobile` | same |
| Storage on client | memory only | secure storage (Keychain/Keystore) |

During a rotation the previous secret stays valid for **verification only**
(`JWT_ACCESS_PREVIOUS_SECRET`) so existing sessions survive a key rollover.

---

## Response envelope

Every response is wrapped by `TransformInterceptor` / `AllExceptionsFilter`:

```json
// success
{ "success": true, "data": { ... }, "meta": { "requestId": "..." } }

// error
{ "success": false, "error": { "code": "AUTH_OTP_EXPIRED", "message": "...", "details": null },
  "meta": { "requestId": "..." } }
```

Error codes come from `backend/src/common/constants/error-codes.ts` and are
mirrored to `shared/contracts/error-codes.json`. The client should branch on
`error.code`, never on `message`.

---

## Refresh protocol

The client refreshes **proactively** when the access token is within 60s of
expiry, and **reactively** on `AUTH_TOKEN_EXPIRED`:

1. `POST /api/v1/auth/refresh` with the refresh token.
2. The backend validates the session (`sessions.revokedAt IS NULL`).
3. The current session is revoked and a **new session + token pair** is
   issued (single-use refresh tokens).
4. The client must persist the new pair atomically and retry the original
   request exactly once.

Single-flight: the client must serialize concurrent 401s through one refresh
call (a simple mutex/promise queue in the HTTP layer).

### Refresh reuse detection

If a refresh token arrives for a session that is **already revoked**, the
backend treats it as theft and revokes **all** sessions for that user with
reason `reuse_detected`
(`backend/src/auth/tokens/token.service.ts → rotateRefreshToken`).
The client responds by clearing stored tokens and returning to login.

---

## Logout

- `POST /auth/logout` — revokes the current session (refresh token
  unusable), but the access token remains valid until natural expiry
  (≤15m). The client discards both tokens immediately.
- `POST /auth/logout-all` — revokes every session for the user.

---

## 401 handling rules for the client

| Server code | Client action |
|---|---|
| `AUTH_TOKEN_EXPIRED` | refresh once, retry request |
| `AUTH_TOKEN_INVALID` | clear tokens, go to login |
| `AUTH_REFRESH_INVALID` / `AUTH_REFRESH_EXPIRED` | clear tokens, go to login |
| any code during refresh call itself | clear tokens, go to login |

Never retry a request more than once after a refresh.

---

## Tenant scope (no client header)

The client never sends a tenant header. Tenant scope is derived
**server-side** from the authenticated principal: `TenantGuard`
(`backend/src/common/guards/tenant.guard.ts`) resolves the caller's
merchant scope (merchant row, active sub-merchant link) and stores it on
`req.tenant = { merchantId, subMerchantId? }`. Endpoints annotated with
`@TenantRequired()` additionally enforce via `TenantRequiredGuard` that
`req.tenant.merchantId` is present (`ADMIN` bypasses). A missing or
inactive tenant scope fails closed with the standard error envelope.
