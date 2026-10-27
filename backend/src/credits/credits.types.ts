// ============================================================
// Yene Verify — Credits Types
// Domain types for the immutable credit ledger.
//
// Balances and amounts are bigint minor units. They cross the API
// boundary as strings (JSON.stringify(bigint) throws — no polyfill).
// ============================================================

/** Sources a ledger row may reference. */
export type ListCreditHistorySort = 'createdAt';

export interface ListCreditHistoryQuery {
  page: number; // 1-based
  pageSize: number;
  sortBy?: ListCreditHistorySort;
  sortOrder?: 'asc' | 'desc';
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface CreditTransactionDto {
  id: string;
  merchantId: string;
  type: 'GRANT' | 'CONSUME' | 'REFUND' | 'ADJUSTMENT' | 'EXPIRE';
  amount: string; // bigint as string (signed)
  balanceAfter: string;
  verificationId: string | null;
  billingVerificationId: string | null;
  subscriptionId: string | null;
  reason: string | null;
  actorUserId: string | null;
  createdAt: string; // ISO
}

export interface ConsumeResult {
  consumed: bigint; // 0 for FAKE/ERROR/NEEDS_REVIEW or unlimited plans
  newBalance: bigint;
  txId: string | null; // null if consumed === 0
}

export interface GrantResult {
  granted: bigint;
  newBalance: bigint;
  txId: string;
}

export interface ReconcileResult {
  merchantId: string;
  previousBalance: bigint;
  ledgerBalance: bigint;
  drift: bigint; // ledgerBalance - previousBalance
  adjusted: boolean;
}

export interface SubmissionCheckResult {
  allowed: boolean;
  reason?: 'INSUFFICIENT_CREDITS' | 'SUBSCRIPTION_EXPIRED';
  balance: bigint;
  unlimited: boolean;
  /** balance <= LOW_CREDITS_WARNING_THRESHOLD and the plan is finite. */
  lowBalance: boolean;
}

export interface GrantInput {
  merchantId: string;
  amount: bigint; // must be > 0
  type: 'GRANT' | 'REFUND' | 'ADJUSTMENT';
  subscriptionId?: string;
  billingVerificationId?: string;
  reason?: string;
  actorUserId?: string;
}

export interface ConsumeInput {
  merchantId: string;
  verificationId: string;
  verificationStatus: string;
  requestId?: string;
  actorUserId?: string;
}

/** Subscription + package entitlement snapshot used by the service. */
export interface SubscriptionContext {
  merchantId: string;
  subscriptionId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING_PAYMENT';
  packageCode: string;
  unlimited: boolean;
}
