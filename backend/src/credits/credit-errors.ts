// ============================================================
// Yene Verify — Credits Domain Errors
// Typed error classes for the credit ledger service.
// ============================================================

import { AppError } from '../common/errors/app-error';
import { ERROR_CODES } from '../common/constants/error-codes';

/** Verification (or grant flow) attempted with an empty balance. */
export class CreditsExhaustedError extends AppError {
  constructor(balance = 0n) {
    super(
      ERROR_CODES.CREDITS_INSUFFICIENT,
      'No credits remaining. Renew your package to continue verifying receipts.',
      402,
      { balance: balance.toString() },
    );
  }
}

/** Positive ledger amounts only: ADJUSTMENT may be signed, but grant() requires amount > 0. */
export class CreditGrantInvalidError extends AppError {
  constructor(amount: bigint) {
    super(
      ERROR_CODES.CREDITS_INVALID_AMOUNT,
      'Credit grant amount must be a positive integer.',
      400,
      { amount: amount.toString() },
    );
  }
}

/** Submission gate: the merchant's plan window has lapsed until they renew. */
export class CreditsSubscriptionExpiredError extends AppError {
  constructor(merchantId: string) {
    super(
      ERROR_CODES.CREDITS_SUBSCRIPTION_EXPIRED,
      'Your subscription has expired. Renew your package to continue.',
      403,
      { merchantId },
    );
  }
}

/** Ledger append failure (immutability rules, FK violation, etc.). */
export class CreditLedgerError extends AppError {
  constructor(operation: string, details?: Record<string, unknown>) {
    super(
      ERROR_CODES.CREDITS_LEDGER_ERROR,
      `Credit ledger write failed during ${operation}.`,
      500,
      { operation, ...details },
    );
  }
}
