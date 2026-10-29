// ============================================================
// Yene Verify — Billing response DTOs (Step 16)
//
// bigint-free, Date→ISO at the mapper: everything here is JSON-safe.
// ============================================================

export type BillingStatusDto =
  | 'PENDING'
  | 'VERIFIED'
  | 'AMOUNT_MISMATCH'
  | 'DUPLICATE'
  | 'FAKE'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export interface PaymentInstructionsDto {
  cbe: { accountNumber: string; accountName: string };
  telebirr: { phoneNumber: string; accountName: string };
  note: string;
}

/** POST /billing/initiate → 200 */
export interface BillingInitiationResponseDto {
  packageCode: string;
  packageName: string;
  expectedAmountMinor: string; // bigint as string
  currency: 'ETB';
  instructions: PaymentInstructionsDto;
  billingSessionId: string;
}

/** POST /billing/submit → 202 */
export interface BillingSubmittedResponseDto {
  billingVerificationId: string;
  verificationId: string;
  status: 'PENDING';
}

export interface BillingDetailResponseDto {
  id: string;
  packageCode: string;
  expectedAmountMinor: string;
  submittedAmountMinor: string | null;
  status: BillingStatusDto;
  bankCode: string | null;
  bankReference: string | null;
  senderName: string | null;
  paidAt: string | null;
  verificationId: string | null;
  subscriptionId: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSummaryDto {
  id: string;
  packageCode: string;
  expectedAmountMinor: string;
  submittedAmountMinor: string | null;
  status: BillingStatusDto;
  bankReference: string | null;
  createdAt: string;
}

export interface BillingListResponseDto {
  data: BillingSummaryDto[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
