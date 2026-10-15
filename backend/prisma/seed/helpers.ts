// ============================================================
// Yene Verify — Seed Helpers
//
// Shared utilities used by all seed modules.
// ============================================================

import type { SeedProfile } from './profiles';

// ── Timing ───────────────────────────────────────────────────────────────

const seedStart = Date.now();

// ── Logging ───────────────────────────────────────────────────────────────

const counts: Record<string, number> = {};

/**
 * Log a seed module completion with its entity count.
 * Never logs actual values — only the entity name and count.
 */
export function log(module: string, count: number): void {
  counts[module] = count;
  const padded = module.padEnd(30, ' ');
  console.log(`[seed] ${padded} upserted ${count}`);
}

/**
 * Print the final summary after all modules complete.
 */
export function logSummary(profile: SeedProfile): void {
  const elapsed = ((Date.now() - seedStart) / 1000).toFixed(2);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log('');
  console.log(`[seed] ──────────────────────────────────────────`);
  console.log(`[seed] done in ${elapsed}s (profile=${profile}, total=${total} rows)`);
  console.log('');
}

// ── Phone masking ─────────────────────────────────────────────────────────

/**
 * Mask a phone number for safe logging.
 * +251911111111 → +2519*****11
 */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return '***';
  return phone.slice(0, 5) + '*'.repeat(phone.length - 7) + phone.slice(-2);
}

// ── Date helpers ──────────────────────────────────────────────────────────

/**
 * Returns a Date that is `days` days before now.
 */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Returns a Date that is `days` days after now.
 */
export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Returns a Date that is `hours` hours before now.
 */
export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

// ── Amount helpers ────────────────────────────────────────────────────────

/**
 * Converts ETB (as a number) to santim (BigInt minor units).
 * 199.00 ETB → 19900n
 */
export function etbToMinor(etb: number): bigint {
  return BigInt(Math.round(etb * 100));
}

// ── Fake OCR text ──────────────────────────────────────────────────────────

/**
 * Generates plausible OCR text for a seed receipt.
 */
export function fakeOcrText(opts: {
  bank: string;
  reference: string;
  amountEtb: number;
  sender: string;
  receiver: string;
  date: string;
}): string {
  return (
    `${opts.bank} Bank\n` +
    `Transaction Reference: ${opts.reference}\n` +
    `Amount: ETB ${opts.amountEtb.toFixed(2)}\n` +
    `From: ${opts.sender}\n` +
    `To: ${opts.receiver}\n` +
    `Date: ${opts.date}\n` +
    `Status: Success`
  );
}
