// ============================================================
// Yene Verify — Verification Response DTOs (13E.3)
//
// PII-SAFETY RULE: never serialize storageKey, sha256, ocrRawText,
// or adapterMetadata through these shapes. All Prisma rows MUST pass
// through the mapper in VerificationsService (or the repository),
// never be returned raw.
//
// bigint → string (amountMinor): JSON numbers lose bigint precision
//   and JSON.stringify(bigint) throws outright.
// Date → ISO 8601 string.
// ============================================================

import type { BankCodeLiteral } from './create-verification.dto';
import type { SupplementaryPrompt } from '../verifications.types';

/**
 * Credit snapshot returned on submit so the client can render instant
 * balance warnings (the pre-Step-15 push-notification surface).
 */
export interface SubmittedCreditsDto {
  /** bigint minor units as a string. */
  balance: string;
  unlimited: boolean;
  /** balance <= 20 and the plan is finite — show the renewal banner. */
  lowBalance: boolean;
}

export interface VerificationSubmittedResponseDto {
  verificationId: string;
  status: 'PENDING';
  createdAt: string;
  credits: SubmittedCreditsDto;
}

export interface ReceiptSummaryDto {
  id: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface DuplicateOfDto {
  verificationId: string;
  merchantId: string;
}

export interface VerificationDetailDto {
  id: string;
  status: 'PENDING' | 'VERIFIED' | 'FAKE' | 'DUPLICATE' | 'NEEDS_REVIEW' | 'ERROR';
  source: 'TRANSACTION' | 'BILLING';
  bankCode: BankCodeLiteral | null;
  bankReference: string | null;
  amountMinor: string | null;
  senderName: string | null;
  receiverName: string | null;
  paidAt: string | null;
  ocrConfidence: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  duplicateOf: DuplicateOfDto | null;
  needsSupplementary: SupplementaryPrompt | null;
  receipt: ReceiptSummaryDto;
  createdAt: string;
  completedAt: string | null;
}

export interface VerificationSummaryDto {
  id: string;
  status: VerificationDetailDto['status'];
  bankCode: BankCodeLiteral | null;
  bankReference: string | null;
  /** Who paid — the merchant-facing label for a list row. */
  senderName: string | null;
  receiverName: string | null;
  amountMinor: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface PageMetaDto {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface VerificationListResponseDto {
  data: VerificationSummaryDto[];
  meta: PageMetaDto;
}

export interface RetryResponseDto {
  verificationId: string;
  status: 'PENDING';
}

export interface RequestReviewResponseDto {
  verificationId: string;
  reviewId: string;
  status: 'NEEDS_REVIEW';
}
