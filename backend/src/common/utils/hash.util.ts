import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

// ── bcrypt (OTP hashing, PIN hashing) ────────────────────────────────────

export async function hashBcrypt(value: string, rounds = 10): Promise<string> {
  return bcrypt.hash(value, rounds);
}

export async function compareBcrypt(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

// ── SHA-256 (token fingerprints, duplicate fingerprints) ─────────────────

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Builds the duplicate fingerprint for a bank transaction.
 * Format: sha256("BANKCODE:NORMALIZED_REFERENCE")
 */
export function buildDuplicateFingerprint(bankCode: string, referenceNormalized: string): string {
  return sha256(`${bankCode}:${referenceNormalized}`);
}

// ── SHA-256 of a refresh token (for storage) ─────────────────────────────

export function hashRefreshToken(token: string): string {
  return sha256(token);
}
