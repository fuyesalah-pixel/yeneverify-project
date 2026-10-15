# Verification Pipeline

> Last updated: 2026-09-24 | Owner: Kiro

---

## Flow

```
[Mobile Client]
  1. User takes photo or picks from gallery
  2. Compress: max 1600px long edge, JPEG q80
  3. POST /verifications/upload-url → { uploadUrl, receiptKey }
  4. PUT image directly to Cloudflare R2 via presigned URL
  5. POST /verifications { receiptKey, merchantId }
  6. ← { verificationId, status: "PENDING" }
  7. Poll GET /verifications/:id  OR  wait for FCM push

[NestJS API]
  - Validates request (JWT, tenant, credits > 0)
  - Deducts 1 credit (ledger entry)
  - Enqueues BullMQ job "verify-receipt"
  - Returns PENDING immediately

[BullMQ Worker — verification.processor.ts]
  1. Download image from R2
  2. Google Vision OCR → raw text
  3. Bank detection (regex + keyword map per bank)
  4. Reference extraction (per-bank regex from shared/contracts/bank-codes.json)
  5. Bank adapter call → VerifyResult
  6. Duplicate check (fingerprint hash: bankCode + reference)
  7. Write result to DB (transactions + receipts tables)
  8. FCM push notification + SSE event
  9. If ambiguous → NEEDS_REVIEW queue

[Mobile Client receives result]
  - VERIFIED → green hero card + haptic mediumImpact
  - FAKE     → red hero card + haptic heavyImpact
  - DUPLICATE → amber + haptic selectionClick + first-verified details
  - NEEDS_REVIEW → info banner
  - ERROR    → retry button
```

---

## Target Latency

Median < 10 seconds end-to-end. P95 < 20 seconds.
Never block the client — always return PENDING immediately.

---

## Bank Adapter Interface

Every adapter in `backend/src/verification/adapters/` implements:

```ts
interface BankAdapter {
  readonly bankCode: BankCode;
  readonly displayName: string;
  detect(rawOcrText: string): boolean;
  extractReference(rawOcrText: string): string | null;
  extractSupplementary?(rawOcrText: string): Record<string, string>;
  verify(input: VerifyInput): Promise<VerifyResult>;
}
```

Rules:
- Never throw unhandled errors — always return a typed `VerifyResult`
- Timeouts wrapped inside the adapter
- Retries handled by BullMQ (not the adapter)
- Adding a new bank = one new folder in `adapters/` + entry in `bank-codes.json`

---

## Duplicate Detection

Fingerprint: `SHA-256(bankCode + ":" + normalizedReference)`

Stored in `duplicate_fingerprints` table (unique constraint).
Checked before writing result. If collision → `DUPLICATE` verdict.
Cross-merchant: same receipt used at any merchant triggers DUPLICATE.

---

## Billing Verification

Merchant subscription payments use the **exact same pipeline**.
The only difference: billing verifications do **not** consume credits
and write to `billing_verifications` instead of `transactions`.
