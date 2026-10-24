// ============================================================
// Yene Verify — Reference Patterns
//
// Per-bank regexes used by extractReference() implementations in
// 13D.1–13D.7, plus the shared normalizer. Pure data — no imports
// of runtime services — so adapters stay instantly unit-testable.
// They are first-pass shape checks on OCR text, not final truth:
// each adapter tightens them against the bank's real format.
// ============================================================

import type { BankCode } from '@prisma/client';

export const REFERENCE_PATTERNS: Record<BankCode, RegExp> = {
  CBE: /\bFT[0-9A-Z]{10,20}\b/i,
  TELEBIRR: /\b(?:DEV|TBR)[0-9A-Z]{8,16}\b/i,
  AWASH: /\b[0-9A-Z]{10,12}-[0-9A-Z]{5,8}\b/i,
  DASHEN: /\bDSH[0-9A-Z]{6,20}\b/i,
  ABYSSINIA: /\bFT[0-9A-Z]{12,22}\b/i,
  MPESA: /\b[A-Z0-9]{10}\b/,
  ZEMEN: /\b108[0-9A-Z]{9,20}\b/i,
};

/**
 * Uppercase, trim, and strip separators (spaces, dashes, dots,
 * underscores) from a raw OCR reference. `ABC-1234` → `ABC1234`.
 */
export function normalizeReference(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[\s._-]+/g, '')
    .trim();
}

/** True when the reference matches this bank's shape (after normalization). */
export function referenceMatchesBank(referenceNormalized: string, bank: BankCode): boolean {
  return REFERENCE_PATTERNS[bank].test(referenceNormalized);
}
