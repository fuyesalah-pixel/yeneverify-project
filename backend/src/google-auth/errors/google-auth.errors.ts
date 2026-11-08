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
