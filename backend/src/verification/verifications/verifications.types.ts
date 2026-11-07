// ============================================================
// Yene Verify — Verification Service Types (13E.1)
//
// Shapes shared by VerificationsService, VerdictResolver and the
// repository layer. Data-only module — no runtime imports — so it
// can be consumed from anywhere without pulling in NestJS.
// ============================================================

import type { BankCode } from '@prisma/client';

/** The five terminal states written to verifications.status. */
export type VerdictStatus = 'VERIFIED' | 'FAKE' | 'DUPLICATE' | 'NEEDS_REVIEW' | 'ERROR';

/** Input the caller (API in 13E.3, queue in 13E.2) passes to process(). */
export type ProcessInput = {
  /** Pre-created PENDING row from the receipts/API step. */
  verificationId: string;
  merchantId: string;
  requestedByUserId: string;
  /** For log correlation across the pipeline. */
  requestId?: string;
};

/** Final result of one process() run. */
export type VerificationResult = {
  id: string;
  status: VerdictStatus;
  bankCode: BankCode | null;
  bankReference: string | null;
  amountMinor: bigint | null;
  senderName: string | null;
  receiverName: string | null;
  paidAt: Date | null;
  ocrConfidence: number | null;
  errorCode: string | null;
  durationMs: number;
  duplicateOfVerificationId?: string | null;
  needsSupplementary?: SupplementaryPrompt | null;
};

/** The decision `finalize()` persists. Built by VerdictResolver. */
export type VerdictOutcome = {
  status: VerdictStatus;
  bankCode?: BankCode | null;
  bankReference?: string | null;
  /** Normalized (blanked-separator) reference, persisted alongside bankReference. */
  referenceNormalized?: string | null;
  amountMinor?: bigint | null;
  senderName?: string | null;
  receiverName?: string | null;
  paidAt?: Date | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  duplicateOfVerificationId?: string | null;
  needsSupplementary?: SupplementaryPrompt | null;
  metadata?: Record<string, unknown>;
};

/** Row data returned by DuplicateDetector.check(). */
export type DuplicateCheck = {
  firstVerificationId: string;
  firstMerchantId: string;
  firstSeenAt: Date;
  totalHits: number;
};

/** Why the resolver was asked to produce an ERROR for a pre-adapter failure. */
export type ErrorContext = {
  errorCode: string;
  errorMessage: string;
  bankCode?: BankCode | null;
  metadata?: Record<string, unknown>;
};

/** Findings from the pre-adapter pipeline stage (OCR → detect → extract). */
export type DetectionStageResult = {
  ocrConfidence: number | null;
  bankCode: BankCode | null;
  referenceNormalized: string | null;
};

/** Supplementary prompt the client should surface to the user. */
export type SupplementaryField = 'accountSuffix' | 'last8';

export type SupplementaryPrompt = { field: SupplementaryField; hint: string };
