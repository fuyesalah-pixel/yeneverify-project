import { AppError } from './app-error';
import { ERROR_CODES } from '../constants/error-codes';

// Pre-built typed domain errors.
// Feature code throws these; AllExceptionsFilter converts to response.

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: Record<string, unknown>) {
    super(ERROR_CODES.NOT_FOUND, message, 404, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', details?: Record<string, unknown>) {
    super(ERROR_CODES.FORBIDDEN, message, 403, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: Record<string, unknown>) {
    super(ERROR_CODES.UNAUTHORIZED, message, 401, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ERROR_CODES.CONFLICT, message, 409, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: Record<string, unknown>) {
    super(ERROR_CODES.VALIDATION_FAILED, message, 422, details);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests') {
    super(ERROR_CODES.RATE_LIMITED, message, 429);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(ERROR_CODES.SERVICE_UNAVAILABLE, message, 503);
  }
}

export class TenantIsolationError extends AppError {
  constructor() {
    super(
      ERROR_CODES.TENANT_ISOLATION_VIOLATION,
      'Access denied. You can only access your own data.',
      403,
    );
  }
}

export class CreditsExhaustedError extends AppError {
  constructor() {
    super(
      ERROR_CODES.CREDITS_INSUFFICIENT,
      'Please renew your package to continue verifying receipts.',
      402,
    );
  }
}

export class MerchantNotOnboardedError extends AppError {
  constructor() {
    super(
      'MERCHANT_NOT_ONBOARDED',
      'Merchant profile not found. Please complete onboarding first.',
      403,
    );
  }
}

export class SubMerchantNotActiveError extends AppError {
  constructor() {
    super('SUB_MERCHANT_NOT_ACTIVE', 'Sub-merchant profile is not active.', 403);
  }
}

export class InvalidPinError extends AppError {
  constructor(message = 'The PIN entered is incorrect.') {
    super('AUTH_PIN_INVALID', message, 400);
  }
}

export class PinNotSetError extends AppError {
  constructor(message = 'PIN has not been set for this account.') {
    super('AUTH_PIN_NOT_SET', message, 400);
  }
}

export class PinAlreadySetError extends AppError {
  constructor(message = 'PIN is already set. Use change PIN instead.') {
    super('AUTH_PIN_ALREADY_SET', message, 400);
  }
}

export class PinLockedError extends AppError {
  readonly retryAfter: number;
  constructor(retryAfter: number) {
    super(
      'AUTH_PIN_LOCKED',
      `Too many incorrect PIN attempts. Please wait ${Math.ceil(retryAfter / 60)} minutes before trying again.`,
      429,
    );
    this.retryAfter = retryAfter;
  }
}

export class TokenTooOldError extends AppError {
  constructor(message = 'Access token is too old. Please provide a fresh OTP.') {
    super('AUTH_TOKEN_TOO_OLD', message, 401);
  }
}

export class StepUpRequiredError extends AppError {
  constructor(message = 'Step-up authentication required.') {
    super('AUTH_STEP_UP_REQUIRED', message, 401);
  }
}

export class DeviceMismatchError extends AppError {
  constructor(message = 'Device fingerprint does not match.') {
    super('AUTH_DEVICE_MISMATCH', message, 401);
  }
}

export class BiometricNotEnabledError extends AppError {
  constructor(message = 'Biometric unlock is not enabled.') {
    super('AUTH_BIOMETRIC_NOT_ENABLED', message, 400);
  }
}

export class ReceiptNotUploadedError extends AppError {
  constructor(details?: Record<string, unknown>) {
    super(
      ERROR_CODES.RECEIPT_NOT_UPLOADED,
      'No uploaded file was found for this key. Upload the image before completing.',
      404,
      details,
    );
  }
}

export class ReceiptTooLargeError extends AppError {
  constructor(maxBytes?: number) {
    super(
      ERROR_CODES.RECEIPT_TOO_LARGE,
      'The uploaded file exceeds the maximum allowed size.',
      400,
      maxBytes ? { maxBytes } : undefined,
    );
  }
}

export class ReceiptInvalidTypeError extends AppError {
  constructor(mimeType?: string) {
    super(
      ERROR_CODES.RECEIPT_INVALID_TYPE,
      'Only JPEG, PNG, and WebP receipt images are accepted.',
      400,
      mimeType ? { mimeType } : undefined,
    );
  }
}

export class ReceiptHashMismatchError extends AppError {
  constructor() {
    super(
      ERROR_CODES.RECEIPT_HASH_MISMATCH,
      'The uploaded file does not match the sha256 checksum you provided.',
      400,
    );
  }
}

export class ReceiptNotFoundError extends AppError {
  constructor() {
    super(ERROR_CODES.RECEIPT_NOT_FOUND, 'Receipt not found.', 404);
  }
}

export class StorageDriverError extends AppError {
  constructor(driver: string, reason?: string) {
    super(
      ERROR_CODES.STORAGE_DRIVER_ERROR,
      'The storage backend could not complete this request.',
      502,
      reason ? { driver, reason } : { driver },
    );
  }
}

export class OcrProviderError extends AppError {
  constructor(provider: string, reason?: string) {
    super(
      ERROR_CODES.OCR_PROVIDER_ERROR,
      'The OCR provider could not process this image.',
      502,
      reason ? { provider, reason } : { provider },
    );
  }
}

export class BankAdapterNotFoundError extends AppError {
  constructor(bankCode: string) {
    super(ERROR_CODES.BANK_ADAPTER_NOT_FOUND, 'No bank adapter is registered for this bank.', 400, {
      bankCode,
    });
  }
}

export class BankAdapterTimeoutError extends AppError {
  constructor(bankCode: string, timeoutMs?: number) {
    super(
      ERROR_CODES.BANK_ADAPTER_TIMEOUT,
      'The bank adapter did not respond in time.',
      504,
      timeoutMs ? { bankCode, timeoutMs } : { bankCode },
    );
  }
}

export class BankAdapterError extends AppError {
  constructor(bankCode: string, reason?: string) {
    super(
      ERROR_CODES.BANK_ADAPTER_ERROR,
      'The bank adapter failed unexpectedly.',
      502,
      reason ? { bankCode, reason } : { bankCode },
    );
  }
}

export class BankAdapterUnavailableError extends AppError {
  constructor(bankCode: string) {
    super(ERROR_CODES.BANK_ADAPTER_UNAVAILABLE, 'The bank adapter is currently unavailable.', 503, {
      bankCode,
    });
  }
}

export class BankReferenceNotFoundError extends AppError {
  constructor(bankCode: string) {
    super(
      ERROR_CODES.BANK_REFERENCE_NOT_FOUND,
      'No transaction reference could be extracted from this receipt.',
      422,
      { bankCode },
    );
  }
}

export class BankReferenceInvalidError extends AppError {
  constructor(bankCode: string, reference?: string) {
    super(
      ERROR_CODES.BANK_REFERENCE_INVALID,
      "The extracted reference does not match this bank's format.",
      422,
      reference ? { bankCode, reference } : { bankCode },
    );
  }
}

/**
 * A bank needs an extra input (e.g. Abyssinia's account suffix) before it
 * can verify. Non-retryable: the client must PROMPT the user and resubmit
 * with the field, so it maps to 400 with the field name in details.
 */
export class BankSupplementaryRequiredError extends AppError {
  constructor(bankCode: string, field: string) {
    super(
      ERROR_CODES.BANK_SUPPLEMENTARY_REQUIRED,
      'This bank requires an additional input before verification can run.',
      400,
      { bankCode, field },
    );
  }
}

/** The supplementary field was provided but in the wrong shape (e.g. not 5 digits). */
export class BankSupplementaryInvalidError extends AppError {
  constructor(bankCode: string, field: string) {
    super(
      ERROR_CODES.BANK_SUPPLEMENTARY_INVALID,
      'The additional bank input has an invalid format.',
      400,
      { bankCode, field },
    );
  }
}

export class OcrEmptyResultError extends AppError {
  constructor(provider: string) {
    super(ERROR_CODES.OCR_EMPTY_RESULT, 'The OCR provider returned no text for this image.', 422, {
      provider,
    });
  }
}

export class OnboardingRequiredError extends AppError {
  readonly step: string;
  readonly pendingInvite?: { id: string; merchantName: string; branchLabel?: string };

  constructor(
    step: string,
    pendingInvite?: { id: string; merchantName: string; branchLabel?: string },
  ) {
    super('ONBOARDING_REQUIRED', `Onboarding required: ${step}`, 403, { step, pendingInvite });
    this.step = step;
    this.pendingInvite = pendingInvite;
  }
}

/** A verification id was not found. */
export class VerificationNotFoundError extends AppError {
  constructor(verificationId: string) {
    super(ERROR_CODES.VERIFICATION_NOT_FOUND, 'Verification not found.', 404, { verificationId });
  }
}

/** process() was called on a verification whose status is not PENDING. */
export class VerificationNotPendingError extends AppError {
  constructor(verificationId: string, status?: string) {
    super(
      ERROR_CODES.VERIFICATION_NOT_PENDING,
      'This verification has already been processed.',
      409,
      { verificationId, ...(status ? { status } : {}) },
    );
  }
}

/** The receipt backing a pending verification is gone from storage records. */
export class VerificationReceiptMissingError extends AppError {
  constructor(verificationId: string, receiptId: string) {
    super(
      ERROR_CODES.VERIFICATION_RECEIPT_MISSING,
      'The receipt for this verification no longer exists.',
      422,
      { verificationId, receiptId },
    );
  }
}
