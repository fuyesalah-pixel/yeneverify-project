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
  // Relaxed to the real formats from the 7-receipt report. Shape checks
  // over-match on purpose; adapters try their receipt labels first.
  TELEBIRR: /[A-Z0-9]{8,20}/,
  AWASH: /\b\d{10,16}\b/,
  DASHEN: /[A-Z0-9]{10,24}/i,
  ABYSSINIA: /FT[0-9A-Z]{8,22}/i,
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
