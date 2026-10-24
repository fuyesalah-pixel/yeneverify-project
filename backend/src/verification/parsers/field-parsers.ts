// ============================================================
// Yene Verify — Shared Receipt Field Parsers
//
// Field-level parsers shared by every bank adapter (13D.1+):
// amounts ("5,500.00 ETB" → 550000n) and dates in Ethiopian
// wall-clock formats. Pure functions — no services, no I/O.
//
// Extracted from cbe.parser.ts in 13D.2 so Telebirr and later
// adapters reuse the exact same semantics (CBE behavior unchanged,
// proven by its tests).
// ============================================================

import { dayjs, APP_TZ } from '../../common/utils/date.util';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

/** Default wall-clock formats seen on Ethiopian bank receipt pages. */
export const ADDIS_DATE_FORMATS = [
  'DD/MM/YYYY h:mm A',
  'DD/MM/YYYY hh:mm A',
  'DD MMM YYYY, h:mm A',
  'DD MMM YYYY, hh:mm A',
  'YYYY-MM-DD HH:mm:ss',
];

/**
 * '5,500.00 ETB' | 'ETB 5500.00' | '5500.00' → 550000n.
 * Returns null when the text holds no usable number.
 */
export function parseAmount(raw: string): bigint | null {
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (cleaned.length === 0) {
    return null;
  }
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) {
    return null;
  }
  return BigInt(Math.round(value * 100));
}

/**
 * Parse a bank-supplied date. ISO-shaped values are UTC instants
 * (bank servers emit UTC); other strings are interpreted with the
 * supplied formats as wall time in Africa/Addis_Ababa (UTC+3).
 * Returns null when nothing matches.
 */
export function parseDate(raw: string, formats: string[] = ADDIS_DATE_FORMATS): Date | null {
  const text = raw.trim();
  if (text.length === 0) {
    return null;
  }

  // 2026-07-14T11:08:00Z / 2026-07-14 11:08:00 / 2026-07-14
  const isoMatch = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::(\d{2}))?)?/.exec(text);
  if (isoMatch) {
    const parsedIso = dayjs.utc(text);
    return parsedIso.isValid() ? parsedIso.toDate() : null;
  }

  for (const format of formats) {
    const parsed = dayjs.tz(text, format, APP_TZ);
    if (parsed.isValid()) {
      return parsed.toDate();
    }
  }

  const fallback = dayjs.tz(text, APP_TZ);
  return fallback.isValid() ? fallback.toDate() : null;
}
