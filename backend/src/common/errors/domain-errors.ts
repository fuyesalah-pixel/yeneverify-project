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
