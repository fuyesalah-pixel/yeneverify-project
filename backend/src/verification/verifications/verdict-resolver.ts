// ============================================================
// Yene Verify — Verdict Resolver (13E.1)
//
// Pure function that maps an adapter result + duplicate lookup +
// pre-adapter error context to a final verdict. No I/O, no side
// effects: the whole verdict matrix is exhaustively unit-testable.
// ============================================================

import type { BankCode } from '@prisma/client';
import type { VerifyResult } from '../adapters/adapter.interface';
import type {
  DuplicateCheck,
  ErrorContext,
  SupplementaryPrompt,
  VerdictOutcome,
} from './verifications.types';

/** User-facing hints for banks that need an extra input before verifying. */
export const SUPPLEMENTARY_HINTS: Record<string, SupplementaryPrompt> = {
  CBE: {
    field: 'last8',
    hint: 'Add your CBE account number in Settings → Verification Accounts',
  },
  ABYSSINIA: {
    field: 'accountSuffix',
    hint: 'Please provide the last 5 digits of the account you received payment to.',
  },
};

export type ResolveVerdictInput = {
  /** null when the bank was not detected or the reference was not extracted. */
  adapterResult: VerifyResult | null;
  adapterBankCode?: BankCode | null;
  duplicate: DuplicateCheck | null;
  /** Set when a pre-adapter stage failed (no bank, no reference, OCR…). */
  errorContext: ErrorContext | null;
  metadata?: Record<string, unknown>;
};

/**
 * Verdict matrix (checked in order):
 *   1. errorContext set            → ERROR with its code
 *   2. adapterResult null          → ERROR (VERIFICATION_BANK_NOT_DETECTED fallback)
 *   3. adapter FAKE                → FAKE (definitive; no duplicate check)
 *   4. adapter ERROR + supplementary-required code → NEEDS_REVIEW with prompt
 *   5. adapter ERROR (other)       → ERROR (transient or definitive-infrastructure)
 *   6. adapter VERIFIED + duplicate → DUPLICATE
 *   7. adapter VERIFIED, no dup    → VERIFIED
 */
export function resolveVerdict(input: ResolveVerdictInput): VerdictOutcome {
  const { adapterResult, adapterBankCode = null, duplicate, errorContext, metadata } = input;

  if (errorContext) {
    return {
      status: 'ERROR',
      bankCode: errorContext.bankCode ?? adapterBankCode ?? null,
      errorCode: errorContext.errorCode,
      errorMessage: errorContext.errorMessage,
      metadata: { ...(errorContext.metadata ?? {}), ...(metadata ?? {}) },
    };
  }

  if (!adapterResult) {
    return {
      status: 'ERROR',
      bankCode: adapterBankCode,
      errorCode: 'VERIFICATION_BANK_NOT_DETECTED',
      errorMessage: 'Could not identify the bank from the receipt.',
      metadata,
    };
  }

  if (adapterResult.status === 'FAKE') {
    return {
      status: 'FAKE',
      bankCode: adapterBankCode,
      errorCode: adapterResult.errorCode,
      errorMessage: 'Receipt could not be verified against bank records.',
      metadata: { ...adapterResult.metadata, ...(metadata ?? {}) },
    };
  }

  if (adapterResult.status === 'ERROR') {
    if (adapterResult.errorCode === 'BANK_SUPPLEMENTARY_REQUIRED') {
      const prompt: SupplementaryPrompt | null =
        (adapterBankCode && SUPPLEMENTARY_HINTS[adapterBankCode]) ?? null;
      return {
        status: 'NEEDS_REVIEW',
        bankCode: adapterBankCode,
        errorCode: adapterResult.errorCode,
        errorMessage: 'This bank requires an additional input before verification can run.',
        needsSupplementary: prompt,
        metadata: { ...adapterResult.metadata, ...(metadata ?? {}) },
      };
    }
    return {
      status: 'ERROR',
      bankCode: adapterBankCode,
      errorCode: adapterResult.errorCode,
      errorMessage: 'The bank could not verify this reference right now.',
      metadata: { ...adapterResult.metadata, ...(metadata ?? {}) },
    };
  }

  // Remaining: adapterResult.status === 'VERIFIED' (narrowed below).
  if (adapterResult.status !== 'VERIFIED') {
    // Unreachable per the matrix; a rogue status must never crash the
    // pipeline — degrade to ERROR instead.
    const unknown = adapterResult as { status?: string; metadata?: Record<string, unknown> };
    return {
      status: 'ERROR',
      bankCode: adapterBankCode,
      errorCode: 'BANK_ADAPTER_ERROR',
      errorMessage: 'The bank adapter returned an unknown result.',
      metadata: { rogueStatus: unknown.status },
    };
  }
  const success = adapterResult;

  if (duplicate) {
    return {
      status: 'DUPLICATE',
      bankCode: adapterBankCode,
      bankReference: success.bankReference,
      amountMinor: success.amountMinor,
      senderName: success.senderName,
      receiverName: success.receiverName,
      paidAt: success.paidAt,
      duplicateOfVerificationId: duplicate.firstVerificationId,
      metadata: {
        ...success.metadata,
        ...(metadata ?? {}),
        firstSeenAt: duplicate.firstSeenAt.toISOString(),
        firstMerchantId: duplicate.firstMerchantId,
        totalHits: duplicate.totalHits,
      },
    };
  }

  return {
    status: 'VERIFIED',
    bankCode: adapterBankCode,
    bankReference: success.bankReference,
    amountMinor: success.amountMinor,
    senderName: success.senderName,
    receiverName: success.receiverName,
    paidAt: success.paidAt,
    metadata: { ...success.metadata, ...(metadata ?? {}) },
  };
}
