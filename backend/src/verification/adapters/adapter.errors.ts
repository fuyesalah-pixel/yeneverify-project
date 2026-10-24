// ============================================================
// Yene Verify — Adapter Error Normalization
//
// Converts anything thrown inside an adapter (SDK errors, parser
// crashes, aborted fetches) into a VerifyResultFailure the
// verification processor can persist. Typed AppErrors carry the
// rich codes; everything else normalizes to BANK_ADAPTER_ERROR
// with retryable=true.
// ============================================================

import { AppError } from '../../common/errors/app-error';
import { ERROR_CODES } from '../../common/constants/error-codes';
import type { VerifyResultFailure } from './adapter.interface';

/** Results/statuses an adapter's doVerify may return. */
export type AdapterAttempt = VerifyResultFailure | { status: 'VERIFIED' };

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/**
 * Map a thrown error to (errorCode, retryable). Validation-shaped
 * codes (4xx semantics) are not retryable; transport and provider
 * failures are.
 */
export function classifyThrownError(
  err: unknown,
  bankCode: string,
): {
  errorCode: string;
  retryable: boolean;
  message: string;
} {
  if (isAppError(err)) {
    const retryable = err.httpStatus >= 500 || err.httpStatus === 429;
    return { errorCode: err.code, retryable, message: err.message };
  }
  return {
    errorCode: ERROR_CODES.BANK_ADAPTER_ERROR,
    retryable: true,
    message: `Bank adapter '${bankCode}' threw an unexpected error: ${String(err)}`,
  };
}

/** Build the failure result inserted into metadata on the last attempt. */
export function failureFromThrownError(
  err: unknown,
  bankCode: string,
  attempts: number,
): VerifyResultFailure {
  const classified = classifyThrownError(err, bankCode);
  return {
    status: 'ERROR',
    errorCode: classified.errorCode,
    errorMessage: classified.message,
    retryable: classified.retryable,
    metadata: { attempts },
  };
}
