// ============================================================
// Yene Verify — PIN Policy Constants
// Centralized weak PIN list and validation rules.
// ============================================================

/** Minimum and maximum allowed PIN length. */
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

/** Weak PIN patterns that are rejected. */
export const WEAK_PIN_PATTERNS: RegExp[] = [
  /^(\d)\1+$/, // All same digits (1111, 222222)
  /^0123456789|1234567890$/, // Sequential ascending
  /^9876543210|876543210$/, // Sequential descending
  /^0000|1111|2222|3333|4444|5555|6666|7777|8888|9999$/, // Common 4-digit
  /^1234|2345|3456|4567|5678|6789$/, // Common 4-digit sequences
  /^12345|23456|34567|45678|56789$/, // Common 5-digit sequences
  /^123456|654321$/, // Common 6-digit
  /^2580|8520$/, // Keypad columns
  /^111111|222222|333333|444444|555555|666666|777777|888888|999999$/, // All same 6-digit
];

/**
 * Checks if a PIN is weak (matches common patterns).
 * Returns true if the PIN should be rejected.
 */
export function isWeakPin(pin: string): boolean {
  if (pin.length < 4 || pin.length > 6) return true;

  for (const pattern of WEAK_PIN_PATTERNS) {
    if (pattern.test(pin)) return true;
  }

  // Check for repeating pairs/triples (e.g., 1212, 123123)
  if (pin.length >= 4) {
    const half = Math.floor(pin.length / 2);
    if (pin.slice(0, half) === pin.slice(half)) return true;
  }

  return false;
}

/**
 * Validates a PIN against policy.
 * Throws if the PIN is invalid.
 */
export function validatePin(pin: string): void {
  if (!pin || !/^\d+$/.test(pin)) {
    throw new Error('PIN must contain only digits');
  }
  if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
    throw new Error(`PIN must be ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} digits`);
  }
  if (isWeakPin(pin)) {
    throw new Error('PIN is too weak. Choose a less predictable PIN.');
  }
}
