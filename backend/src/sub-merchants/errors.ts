// ============================================================
// Yene Verify — Sub-Merchants Domain Errors
// Thrown by services; converted to the API error envelope by
// AllExceptionsFilter. Only pre-existing ERROR_CODES are used.
// ============================================================

import { AppError } from '../common/errors/app-error';
import { ERROR_CODES } from '../common/constants/error-codes';

export class SubMerchantExistsError extends AppError {
  constructor(details?: Record<string, unknown>) {
    super(
      ERROR_CODES.SUB_MERCHANT_ALREADY_EXISTS,
      'A sub-merchant with this phone already exists.',
      409,
      details,
    );
  }
}

export class PlanLimitSubMerchantsError extends AppError {
  constructor(details?: Record<string, unknown>) {
    super(
      ERROR_CODES.PLAN_LIMIT_SUB_MERCHANTS,
      'Your plan does not allow more sub-merchants.',
      403,
      details,
    );
  }
}

export class InvalidInviteError extends AppError {
  constructor(details?: Record<string, unknown>) {
    super(ERROR_CODES.AUTH_INVITE_INVALID, 'This invite is invalid.', 400, details);
  }
}

export class InviteExpiredError extends AppError {
  constructor(details?: Record<string, unknown>) {
    super(ERROR_CODES.AUTH_INVITE_EXPIRED, 'This invite has expired.', 400, details);
  }
}

export class InviteConsumedError extends AppError {
  constructor(details?: Record<string, unknown>) {
    super(ERROR_CODES.AUTH_INVITE_CONSUMED, 'This invite has already been used.', 409, details);
  }
}

export class SubMerchantNotFoundError extends AppError {
  constructor(details?: Record<string, unknown>) {
    super(ERROR_CODES.SUB_MERCHANT_NOT_FOUND, 'Sub-merchant not found.', 404, details);
  }
}
