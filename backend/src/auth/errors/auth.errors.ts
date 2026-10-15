// ============================================================
// Yene Verify — Auth Domain Errors
// Typed error classes mapping to centralized error codes.
// ============================================================

import { AppError } from '../../common/errors/app-error';

export class InvalidOtpError extends AppError {
  constructor(message = 'The OTP entered is incorrect.') {
    super('AUTH_INVALID_OTP', message, 400);
  }
}

export class OtpExpiredError extends AppError {
  constructor(message = 'The OTP has expired. Please request a new one.') {
    super('AUTH_OTP_EXPIRED', message, 400);
  }
}

export class OtpMaxAttemptsError extends AppError {
  readonly retryAfter: number;
  constructor(retryAfter: number = 900) {
    super(
      'AUTH_OTP_MAX_ATTEMPTS',
      `Too many incorrect OTP attempts. Please wait ${Math.ceil(retryAfter / 60)} minutes before trying again.`,
      429,
    );
    this.retryAfter = retryAfter;
  }
}

export class OtpRateLimitedError extends AppError {
  readonly retryAfter: number;
  constructor(retryAfter: number) {
    super(
      'AUTH_OTP_RATE_LIMITED',
      `Too many OTP requests. Please wait ${Math.ceil(retryAfter / 60)} minutes before requesting again.`,
      429,
    );
    this.retryAfter = retryAfter;
  }
}

export class AccountBannedError extends AppError {
  constructor(message = 'This account has been banned.') {
    super('AUTH_ACCOUNT_BANNED', message, 403);
  }
}

export class AccountSuspendedError extends AppError {
  constructor(message = 'This account has been suspended.') {
    super('AUTH_ACCOUNT_SUSPENDED', message, 403);
  }
}

export class AccountDeletedError extends AppError {
  constructor(message = 'This account no longer exists.') {
    super('AUTH_ACCOUNT_DELETED', message, 403);
  }
}

export class DeviceLimitExceededError extends AppError {
  readonly activeDevices: Array<{ id: string; fingerprint: string }>;
  constructor(devices: Array<{ id: string; fingerprint: string }>) {
    super(
      'AUTH_DEVICE_LIMIT',
      `Maximum of 3 active devices reached. Please remove an existing device.`,
      403,
    );
    this.activeDevices = devices;
  }
}

export class DeviceRevokedError extends AppError {
  constructor(message = 'This device has been revoked. Please log in again.') {
    super('AUTH_DEVICE_REVOKED', message, 401);
  }
}

export class InvalidTokenError extends AppError {
  constructor(message = 'Access token is invalid or expired.') {
    super('AUTH_TOKEN_INVALID', message, 401);
  }
}

export class TokenExpiredError extends AppError {
  constructor(message = 'Access token has expired. Please refresh.') {
    super('AUTH_TOKEN_EXPIRED', message, 401);
  }
}

export class RefreshTokenInvalidError extends AppError {
  constructor(message = 'Refresh token is invalid or has been revoked.') {
    super('AUTH_REFRESH_INVALID', message, 401);
  }
}

export class RefreshTokenExpiredError extends AppError {
  constructor(message = 'Refresh token has expired. Please log in again.') {
    super('AUTH_REFRESH_EXPIRED', message, 401);
  }
}

export class RefreshTokenReuseDetectedError extends AppError {
  constructor(message = 'Refresh token reuse detected. All sessions have been revoked.') {
    super('AUTH_REFRESH_REUSE_DETECTED', message, 401);
  }
}

export class PinNotSetError extends AppError {
  constructor(message = 'PIN has not been set for this account.') {
    super('AUTH_PIN_NOT_SET', message, 400);
  }
}

export class PinInvalidError extends AppError {
  constructor(message = 'Incorrect PIN.') {
    super('AUTH_PIN_INVALID', message, 400);
  }
}

export class PinMaxAttemptsError extends AppError {
  constructor(message = 'Too many incorrect PIN attempts. Account temporarily locked.') {
    super('AUTH_PIN_MAX_ATTEMPTS', message, 429);
  }
}
