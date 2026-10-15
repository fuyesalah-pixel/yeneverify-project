# Error Codes Reference

> Last updated: 2026-09-24 | Owner: Kiro
> Machine-readable source: `shared/contracts/error-codes.json`

---

## Auth

| Code | Meaning |
|------|---------|
| `AUTH_PHONE_INVALID` | Phone is not a valid Ethiopian E.164 number |
| `AUTH_OTP_INVALID` | Incorrect OTP |
| `AUTH_OTP_EXPIRED` | OTP has expired (5 min window) |
| `AUTH_OTP_MAX_ATTEMPTS` | 5 failed OTP attempts — exponential lockout |
| `AUTH_OTP_RATE_LIMITED` | Too many OTP requests from this phone/IP |
| `AUTH_TOKEN_INVALID` | JWT is malformed or signature invalid |
| `AUTH_TOKEN_EXPIRED` | Access token expired — refresh needed |
| `AUTH_REFRESH_INVALID` | Refresh token revoked or not found |
| `AUTH_REFRESH_EXPIRED` | Refresh token expired — re-login required |
| `AUTH_PIN_INVALID` | Wrong PIN |
| `AUTH_PIN_MAX_ATTEMPTS` | Too many wrong PINs — account locked |
| `AUTH_PIN_NOT_SET` | User has not set a PIN yet |
| `AUTH_DEVICE_NOT_FOUND` | Device ID not registered or already revoked |
| `AUTH_DEVICE_LIMIT_REACHED` | 3 devices already registered — remove one |
| `AUTH_SESSION_EXPIRED` | Session ended — re-login required |

## Verification

| Code | Meaning |
|------|---------|
| `VERIFICATION_NOT_FOUND` | Verification ID not found |
| `VERIFICATION_PENDING` | Job still running |
| `VERIFICATION_DUPLICATE` | Receipt already used by any merchant |
| `VERIFICATION_FAKE` | Receipt not found in bank records |
| `VERIFICATION_BANK_UNREACHABLE` | Bank endpoint down — retry |
| `VERIFICATION_OCR_FAILED` | Cannot extract text — ask for clearer photo |
| `VERIFICATION_BANK_NOT_DETECTED` | Bank cannot be identified from receipt |
| `VERIFICATION_REFERENCE_NOT_FOUND` | Reference not in bank records |
| `VERIFICATION_AMOUNT_MISMATCH` | Amount differs from bank record |
| `VERIFICATION_NO_CREDITS` | Zero credits — must renew package |
| `VERIFICATION_UPLOAD_URL_EXPIRED` | Presigned URL expired — request new one |
| `VERIFICATION_IMAGE_TOO_LARGE` | Image > 10MB |
| `VERIFICATION_IMAGE_INVALID_FORMAT` | Not JPEG |

## Billing

| Code | Meaning |
|------|---------|
| `BILLING_PAYMENT_NOT_VERIFIED` | Payment receipt failed verification |
| `BILLING_AMOUNT_MISMATCH` | Paid amount ≠ package price |
| `BILLING_RECEIPT_ALREADY_USED` | Receipt already used for a subscription |
| `BILLING_PACKAGE_NOT_FOUND` | Package code not found |
| `BILLING_SUBSCRIPTION_ACTIVE` | Already on this package |
| `BILLING_MANUAL_REVIEW_REQUIRED` | Queued for admin review |

## Credits

| Code | Meaning |
|------|---------|
| `CREDITS_INSUFFICIENT` | Not enough credits |
| `CREDITS_LEDGER_ERROR` | Credit processing error — no charge made |

## General

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Field validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `UNAUTHORIZED` | 401 | No valid auth token |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected error — team notified |
| `SERVICE_UNAVAILABLE` | 503 | Temporary outage |
| `TENANT_ISOLATION_VIOLATION` | 403 | Attempted cross-tenant access |
