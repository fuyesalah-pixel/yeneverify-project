// ============================================================
// Yene Verify — Verdict Resolver Unit Tests (13E.1)
//
// One test per matrix branch — the whole point of extracting the
// resolver into a pure function. No mocks, no I/O.
// ============================================================

import type { VerifyResult } from '../adapters/adapter.interface';
import type { DuplicateCheck, ErrorContext } from './verifications.types';
import { resolveVerdict } from './verdict-resolver';

const verifiedAdapterResult = (): Extract<VerifyResult, { status: 'VERIFIED' }> => ({
  status: 'VERIFIED',
  bankReference: 'FT26195DBK5W81465291',
  amountMinor: 12000n,
  currency: 'ETB',
  senderName: 'Yonas Alemu',
  receiverName: 'Selam Coffee',
  paidAt: new Date('2026-07-14T11:08:00.000Z'),
  metadata: { source: 'cbe-html' },
});

const duplicateRow = (): DuplicateCheck => ({
  firstVerificationId: 'first-verification-id',
  firstMerchantId: 'first-merchant-id',
  firstSeenAt: new Date('2026-07-01T08:00:00.000Z'),
  totalHits: 3,
});

const errorCtx = (errorCode = 'VERIFICATION_BANK_NOT_DETECTED'): ErrorContext => ({
  errorCode,
  errorMessage: 'boom',
  metadata: { stage: 'detect' },
});

describe('resolveVerdict', () => {
  it('branch 1: errorContext → ERROR with its code and merged metadata', () => {
    const outcome = resolveVerdict({
      adapterResult: verifiedAdapterResult(),
      adapterBankCode: 'CBE',
      duplicate: null,
      errorContext: errorCtx('VERIFICATION_BANK_NOT_DETECTED'),
      metadata: { detectionStage: 'pre' },
    });

    expect(outcome).toMatchObject({
      status: 'ERROR',
      errorCode: 'VERIFICATION_BANK_NOT_DETECTED',
      bankCode: 'CBE',
      metadata: { stage: 'detect', detectionStage: 'pre' },
    });
    expect(outcome.amountMinor).toBeUndefined();
  });

  it('branch 2: null adapter result (no errorContext) → ERROR fallback', () => {
    const outcome = resolveVerdict({
      adapterResult: null,
      adapterBankCode: null,
      duplicate: null,
      errorContext: null,
    });

    expect(outcome.status).toBe('ERROR');
    expect(outcome.errorCode).toBe('VERIFICATION_BANK_NOT_DETECTED');
  });

  it('branch 3: adapter FAKE → FAKE, no duplicate consultation', () => {
    const fake: VerifyResult = {
      status: 'FAKE',
      errorCode: 'BANK_REFERENCE_NOT_FOUND',
      errorMessage: 'not found',
      retryable: false,
      metadata: { reason: 'not-found' },
    };

    const outcome = resolveVerdict({
      adapterResult: fake,
      adapterBankCode: 'ZEMEN',
      duplicate: duplicateRow(), // present but must be ignored
      errorContext: null,
    });

    expect(outcome.status).toBe('FAKE');
    expect(outcome.errorCode).toBe('BANK_REFERENCE_NOT_FOUND');
    expect(outcome.duplicateOfVerificationId).toBeUndefined();
    expect(outcome.amountMinor).toBeUndefined();
  });

  it('branch 4: ERROR + BANK_SUPPLEMENTARY_REQUIRED → NEEDS_REVIEW with prompt', () => {
    const sup: VerifyResult = {
      status: 'ERROR',
      errorCode: 'BANK_SUPPLEMENTARY_REQUIRED',
      errorMessage: 'Abyssinia requires the last 5 digits of the destination account',
      retryable: false,
      metadata: { field: 'accountSuffix', length: 5 },
    };

    const outcome = resolveVerdict({
      adapterResult: sup,
      adapterBankCode: 'ABYSSINIA',
      duplicate: null,
      errorContext: null,
    });

    expect(outcome.status).toBe('NEEDS_REVIEW');
    expect(outcome.errorCode).toBe('BANK_SUPPLEMENTARY_REQUIRED');
    expect(outcome.needsSupplementary).toEqual({
      field: 'accountSuffix',
      hint: 'Please provide the last 5 digits of the account you received payment to.',
    });
  });

  it('branch 4b: supplementary REQUIRED without a known bank → NEEDS_REVIEW, null prompt', () => {
    const sup: VerifyResult = {
      status: 'ERROR',
      errorCode: 'BANK_SUPPLEMENTARY_REQUIRED',
      errorMessage: 'Requires suffix',
      retryable: false,
    };

    const outcome = resolveVerdict({
      adapterResult: sup,
      adapterBankCode: null,
      duplicate: null,
      errorContext: null,
    });

    expect(outcome.status).toBe('NEEDS_REVIEW');
    expect(outcome.needsSupplementary).toBeNull();
  });

  it('branch 5: ERROR (transport) → ERROR, not NEEDS_REVIEW', () => {
    const err: VerifyResult = {
      status: 'ERROR',
      errorCode: 'BANK_ADAPTER_UNAVAILABLE',
      errorMessage: 'all endpoints down',
      retryable: true,
      metadata: { errors: [] },
    };

    const outcome = resolveVerdict({
      adapterResult: err,
      adapterBankCode: 'DASHEN',
      duplicate: duplicateRow(), // must NOT be consulted
      errorContext: null,
    });

    expect(outcome.status).toBe('ERROR');
    expect(outcome.errorCode).toBe('BANK_ADAPTER_UNAVAILABLE');
    expect(outcome.duplicateOfVerificationId).toBeUndefined();
  });

  it('branch 6: VERIFIED + duplicate → DUPLICATE with escalation metadata', () => {
    const outcome = resolveVerdict({
      adapterResult: verifiedAdapterResult(),
      adapterBankCode: 'CBE',
      duplicate: duplicateRow(),
      errorContext: null,
    });

    expect(outcome.status).toBe('DUPLICATE');
    expect(outcome.duplicateOfVerificationId).toBe('first-verification-id');
    expect(outcome.amountMinor).toBe(12000n);
    expect(outcome.metadata).toMatchObject({
      totalHits: 3,
      firstMerchantId: 'first-merchant-id',
      firstSeenAt: '2026-07-01T08:00:00.000Z',
      source: 'cbe-html',
    });
  });

  it('branch 7: VERIFIED + no duplicate → VERIFIED', () => {
    const outcome = resolveVerdict({
      adapterResult: verifiedAdapterResult(),
      adapterBankCode: 'CBE',
      duplicate: null,
      errorContext: null,
    });

    expect(outcome.status).toBe('VERIFIED');
    expect(outcome.amountMinor).toBe(12000n);
    expect(outcome.senderName).toBe('Yonas Alemu');
    expect(outcome.paidAt?.toISOString()).toBe('2026-07-14T11:08:00.000Z');
    expect(outcome.duplicateOfVerificationId).toBeUndefined();
  });

  it('is deterministic: same input → same output', () => {
    const makeInput = () => ({
      adapterResult: verifiedAdapterResult(),
      adapterBankCode: 'CBE' as const,
      duplicate: duplicateRow(),
      errorContext: null,
    });
    const a = resolveVerdict(makeInput());
    const b = resolveVerdict(makeInput());
    expect(a).toEqual(b);
  });
});
