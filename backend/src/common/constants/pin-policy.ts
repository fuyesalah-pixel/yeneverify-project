// ============================================================
// Yene Verify — PIN Policy Constants
// Centralized weak PIN list and validation rules.
// ============================================================

/** Minimum and maximum allowed PIN length. */
import { AuthWeakPinError, ValidationError } from '../errors/domain-errors';

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

/** Maximum failed attempts before lockout. */
export const PIN_MAX_FAILED_ATTEMPTS = 5;

/** Lockout duration in seconds (15 minutes). */
export const PIN_LOCKOUT_SECONDS = 15 * 60;

/** bcrypt rounds for PIN hashing (reuse OTP rounds). */
export const PIN_HASH_ROUNDS = 10;

/** Maximum rate limit for PIN verification attempts per 5 minutes. */
export const PIN_RATE_LIMIT_ATTEMPTS_PER_5MIN = 10;

/** Step-up token TTL in seconds (2 minutes). */
export const STEP_UP_TOKEN_TTL_SECONDS = 120;

/**
 * Why a PIN was rejected as weak. Returned in the AUTH_WEAK_PIN error's
 * `details.reason` so clients can explain the specific problem.
 */
export type WeakPinReason = 'repeated' | 'sequential' | 'common';

/** All-same digits (1111, 222222) or a repeated block (1212, 123123). */
const REPEATED_PATTERNS: RegExp[] = [/^(\d)\1+$/, /^(\d+)\1+$/];

/** Ascending/descending runs (1234, 23456, 9876543210). */
const SEQUENTIAL_PATTERNS: RegExp[] = [
  /^(?:0123456789|9876543210)/, // Sequential ascending/descending
  /(?:1234567890|876543210)$/,
  /^(?:1234|2345|3456|4567|5678|6789)/, // Common 4-digit sequences
  /^(?:12345|23456|34567|45678|56789)/, // Common 5-digit sequences
  /^(?:123456|654321)$/, // Common 6-digit
];

/** Common PINs that are neither repeated nor sequential (keypad columns). */
const COMMON_PATTERNS: RegExp[] = [/^(?:2580|8520)$/];

/**
 * Classifies a weak PIN, or returns null when it passes the pattern checks.
 * Length is not judged here (see [validatePin]).
 */
export function classifyWeakPin(pin: string): WeakPinReason | null {
  if (REPEATED_PATTERNS.some((pattern) => pattern.test(pin))) return 'repeated';
  if (SEQUENTIAL_PATTERNS.some((pattern) => pattern.test(pin))) return 'sequential';
  if (COMMON_PATTERNS.some((pattern) => pattern.test(pin))) return 'common';

  // Repeating block (e.g., 1212, 123123).
  if (pin.length >= 4 && pin.length % 2 === 0) {
    const half = pin.length / 2;
    if (pin.slice(0, half) === pin.slice(half)) return 'repeated';
  }

  return null;
}

/**
 * Checks if a PIN is weak (matches common patterns or has an invalid length).
 * Returns true if the PIN should be rejected.
 */
export function isWeakPin(pin: string): boolean {
  if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) return true;
  return classifyWeakPin(pin) !== null;
}

/**
 * Validates a PIN against policy.
 * Throws typed domain errors: ValidationError for malformed input and
 * AuthWeakPinError (AUTH_WEAK_PIN) for predictable PINs.
 */
export function validatePin(pin: string): void {
  if (!pin || !/^\d+$/.test(pin)) {
    throw new ValidationError('PIN must contain only digits', { field: 'pin' });
  }
  if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
    throw new ValidationError(`PIN must be ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} digits`, {
      field: 'pin',
    });
  }

  const reason = classifyWeakPin(pin);
  if (reason) {
    throw new AuthWeakPinError({ reason });
  }
}
