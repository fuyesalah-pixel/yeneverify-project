# API Conventions

> Last updated: 2026-09-24 | Owner: Kiro

---

## Base URL

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:3000` |
| Staging | `https://staging-api.yeneverify.com` |
| Production | `https://api.yeneverify.com` |

API docs (Swagger UI): `{base_url}/docs`

---

## Authentication

All endpoints except `/health`, `/auth/request-otp`, `/auth/verify-otp`
require a JWT Bearer token:

```
Authorization: Bearer <accessToken>
```

Access tokens expire in 15 minutes. Use `POST /auth/refresh` with
the refresh token to get a new pair. Refresh tokens expire in 30 days.
On every refresh, the old refresh token is invalidated (rotation).

---

## Response Envelope

Every response — success or error — uses the same envelope:

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "page": 1,
    "pageSize": 20,
    "total": 42
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "VERIFICATION_DUPLICATE",
    "message": "This receipt has already been verified.",
    "details": { "firstVerifiedAt": "2026-09-20T10:00:00Z" }
  },
  "meta": { "requestId": "uuid" }
}
```

`page`, `pageSize`, `total` only present on list endpoints.
`details` only present when extra context helps the client.

---

## Error Codes

All error codes are defined in:
- Backend: `backend/src/common/constants/error-codes.ts`
- Shared mirror: `shared/contracts/error-codes.json`

Never invent error codes inline. Always use the centralized enum.

---

## Pagination

List endpoints accept:
```
?page=1&pageSize=20
```
Default: `page=1`, `pageSize=20`. Max `pageSize=100`.
Response `meta` always includes `page`, `pageSize`, `total`.

---

## Naming

- Endpoints: kebab-case, plural nouns (`/sub-merchants`, `/credit-transactions`)
- Query params: camelCase (`?merchantId=...`, `?startDate=...`)
- Request body: camelCase JSON
- Response data: camelCase JSON
- Enums (in JSON): SCREAMING_SNAKE_CASE

---

## Money

All monetary values are **integer minor units (santim)**. Never floats.
Field names always end in `_minor`: `amountMinor`, `priceMinor`.
`100 ETB = 10000` santim.

---

## Timestamps

All timestamps: ISO 8601 UTC (`2026-09-24T10:00:00.000Z`).
Stored as `TIMESTAMPTZ` in PostgreSQL.
Display in `Africa/Addis_Ababa` timezone — handled by mobile.

---

## Versioning

MVP: no versioning prefix. API is at root (`/auth`, `/verifications`, etc.).
Future: prefix with `/v2/` when breaking changes are needed.

---

## Rate Limits

| Endpoint group | Limit |
|----------------|-------|
| `/auth/request-otp` | 10 req/min per IP |
| `/auth/verify-otp` | 10 req/min per IP |
| All other endpoints | 60 req/min per IP |

`429 Too Many Requests` response uses `RATE_LIMITED` error code.
