// ============================================================
// Yene Verify â€” Google Auth Domain Errors
// ============================================================

import { AppError } from '../../common/errors/app-error';
import { ERROR_CODES } from '../../common/constants/error-codes';

export class GoogleNotLinkedError extends AppError {
  constructor() {
    super(
      ERROR_CODES.AUTH_GOOGLE_NOT_LINKED,
      'No account is linked to this Google account. Sign in with phone first, then link Google in Settings.',
      403,
    );
  }
}

export class GoogleAlreadyLinkedError extends AppError {
  constructor() {
    super(
      ERROR_CODES.AUTH_GOOGLE_ALREADY_LINKED,
      'This Google account is already linked to a different user.',
      409,
    );
  }
}

export class GoogleEmailUnverifiedError extends AppError {
  constructor() {
    super(
      ERROR_CODES.AUTH_GOOGLE_EMAIL_UNVERIFIED,
      'The Google email address is not verified. Please verify it with Google first.',
      401,
    );
  }
}

export class GoogleTokenInvalidError extends AppError {
  constructor() {
    super(ERROR_CODES.AUTH_GOOGLE_TOKEN_INVALID, 'The Google ID token is invalid or expired.', 401);
  }
}

export class GoogleAlreadyPairedError extends AppError {
  constructor() {
    super(
      ERROR_CODES.AUTH_GOOGLE_ALREADY_PAIRED,
      'This Google account is already paired to a phone number.',
      409,
    );
  }
}

export class DeviceLimitPairsError extends AppError {
  constructor(existingPhones: string[]) {
    super(
      ERROR_CODES.AUTH_DEVICE_LIMIT_PAIRS,
      'This device already has 2 paired accounts. Sign out one before adding another.',
      403,
      { existingPhones },
    );
  }
}

export class PhoneAlreadyPairedError extends AppError {
  constructor() {
    super(
      ERROR_CODES.AUTH_PHONE_ALREADY_PAIRED,
      'This phone number is already paired to another account.',
      409,
    );
  }
}

export class PhoneInvalidFormatError extends AppError {
  constructor() {
    super(
      ERROR_CODES.AUTH_PHONE_INVALID_FORMAT,
      'Invalid Ethiopian phone number format. Use +2519XXXXXXXX or +2517XXXXXXXX.',
      400,
    );
  }
}
