// ============================================================
// Yene Verify — Auth Errors Barrel Export
// ============================================================

export {
  InvalidOtpError,
  OtpExpiredError,
  OtpMaxAttemptsError,
  OtpRateLimitedError,
  AccountBannedError,
  AccountSuspendedError,
  AccountDeletedError,
  DeviceLimitExceededError,
  DeviceRevokedError,
  InvalidTokenError,
  TokenExpiredError,
  RefreshTokenInvalidError,
  RefreshTokenExpiredError,
  RefreshTokenReuseDetectedError,
  PinNotSetError,
  PinInvalidError,
  PinMaxAttemptsError,
} from './auth.errors';

export {
  InvalidPinError,
  PinAlreadySetError,
  PinLockedError,
  TokenTooOldError,
} from '../../common/errors/domain-errors';
