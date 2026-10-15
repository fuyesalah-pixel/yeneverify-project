# Bank Adapters

> Last updated: 2026-09-24 | Owner: Kiro

---

## Interface

Every adapter implements exactly this interface (no exceptions):

```ts
export interface BankAdapter {
  readonly bankCode: BankCode;
  readonly displayName: string;
  detect(rawOcrText: string): boolean;
  extractReference(rawOcrText: string): string | null;
  extractSupplementary?(rawOcrText: string): Record<string, string>;
  verify(input: VerifyInput): Promise<VerifyResult>;
}
```

Location: `backend/src/verification/adapters/adapter.interface.ts`

---

## Adapter Registry

`adapter.registry.ts` maps `BankCode → BankAdapter` instance.
The verification worker calls `registry.detect(ocrText)` to find the right
adapter, then calls `adapter.verify(input)`.

---

## Adapters

| Bank | Code | Method | Status | Reference regex |
|------|------|--------|--------|-----------------|
| Commercial Bank of Ethiopia | CBE | HTML scrape | Full | `^FT\d{11,}$` |
| Telebirr | TELEBIRR | Puppeteer headless | Full | `^DEV[A-Z0-9]{7}$` |
| Awash Bank | AWASH | HTML table parse | Full | `^[A-Z0-9]{10}-[A-Z0-9]{6}$` |
| Dashen Bank | DASHEN | Unstable endpoint | Partial | varies |
| Bank of Abyssinia | ABYSSINIA | HTML scrape + account digits | Partial | `^FT[A-Z0-9]{12}$` |
| M-Pesa | MPESA | Safaricom API → PDF | Full | `^[A-Z0-9]{10}$` |
| Zemen Bank | ZEMEN | PDF URL fetch | Full | `^[0-9]{3}[A-Z]{4}[0-9]{9}$` |

---

## Adding a New Bank

1. Create folder: `backend/src/verification/adapters/{code}/`
2. Implement `BankAdapter` interface (no throws — all errors return `VerifyResult`)
3. Register in `adapter.registry.ts`
4. Add entry to `shared/contracts/bank-codes.json`
5. Add logo PNG to `mobile/assets/banks/{code}.png`
6. Add localized name to `app_en.arb` and `app_am.arb`
7. Add regex to `backend/src/verification/regex/` if complex
8. Write unit tests for `detect()`, `extractReference()`, `verify()`
9. All in one PR

---

## Error Handling Rules

- Adapters NEVER throw. All errors return `VerifyResult` with `status: ERROR`.
- Network timeouts: wrap in try/catch, return `{ status: 'ERROR', reason: 'BANK_TIMEOUT' }`.
- Retries: handled by BullMQ (3 attempts with exponential backoff). Not by the adapter.
- Partial results (amount found but name unclear): return `status: 'NEEDS_REVIEW'`.
