// ============================================================
// Yene Verify — CBE Receipt Parser
//
// Turns the HTML from https://apps.cbe.com.et:100/?id={reference}
// into structured receipt data. Pure function layer — no HTTP,
// no services — so it is instantly unit-testable and adapter
// code stays thin.
//
// Hard rule: malformed or incomplete HTML NEVER throws. It
// degrades to found: false so the adapter can answer deterministically.
// ============================================================

import { dayjs, APP_TZ } from '../../../common/utils/date.util';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type { HtmlTableRow } from '../../parsers/html.parser';
import { extractTableRows, findRow } from '../../parsers/html.parser';

dayjs.extend(customParseFormat);

export interface CbeParsedReceipt {
  found: boolean;
  reference: string;
  amountMinor: bigint | null;
  currency: 'ETB';
  senderName: string;
  receiverName: string;
  paidAt: Date | null;
}

/** Label aliases per field, tried in order (lowercase-normalized). */
const SENDER_LABELS = ['sender name', 'payer name', 'payer'];
const RECEIVER_LABELS = ['receiver name', 'payee name', 'beneficiary', 'receiver'];
const AMOUNT_LABELS = ['amount', 'transaction amount'];
const DATE_LABELS = ['transaction date', 'date', 'processed on'];
const REFERENCE_LABELS = ['transaction reference', 'reference', 'receipt no'];

const NOT_FOUND_RE = /receipt\s+not\s+found|no\s+receipt|invalid\s+reference|does\s+not\s+exist/i;

/**
 * Wall-clock formats observed on real CBE pages, interpreted in
 * Africa/Addis_Ababa (UTC+3). ISO strings with an explicit offset
 * are parsed as UTC instants instead.
 */
const ADDIS_FORMATS = [
  'DD/MM/YYYY h:mm A',
  'DD/MM/YYYY hh:mm A',
  'DD MMM YYYY, h:mm A',
  'DD MMM YYYY, hh:mm A',
  'YYYY-MM-DD HH:mm:ss',
];

function firstRowValue(rows: HtmlTableRow[], labels: string[]): string | null {
  for (const label of labels) {
    const row = findRow(rows, label);
    if (row && row.value.length > 0) {
      return row.value;
    }
  }
  return null;
}

/**
 * '5,500.00 ETB' | 'ETB 5500.00' | '5500.00' → 550000n.
 * Returns null when the text holds no usable number.
 */
export function amountToMinor(raw: string): bigint | null {
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
 * Parse a CBE-supplied date in Africa/Addis_Ababa wall time.
 * ISO strings (with or without offset/UTC designator) parse as UTC
 * instants. Returns null when nothing matches.
 */
export function parseCbeDate(raw: string): Date | null {
  const text = raw.trim();
  if (text.length === 0) {
    return null;
  }

  // 2026-07-14T11:08:00Z / 2026-07-14 11:08:00 / 2026-07-14 —
  // ISO-shaped values are UTC (bank servers emit UTC), regardless
  // of whether an explicit designator is present.
  const isoMatch = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::(\d{2}))?)?/.exec(text);
  if (isoMatch) {
    const parsedIso = dayjs.utc(text);
    return parsedIso.isValid() ? parsedIso.toDate() : null;
  }

  for (const format of ADDIS_FORMATS) {
    const parsed = dayjs.tz(text, format, APP_TZ);
    if (parsed.isValid()) {
      return parsed.toDate();
    }
  }

  const fallback = dayjs.tz(text, APP_TZ);
  return fallback.isValid() ? fallback.toDate() : null;
}

/**
 * Extract receipt data from a CBE receipt page.
 * Undefined/not-found/malformed → { found: false }. Never throws.
 */
export function parseCbeReceipt(html: string): CbeParsedReceipt {
  const empty: CbeParsedReceipt = {
    found: false,
    reference: '',
    amountMinor: null,
    currency: 'ETB',
    senderName: '',
    receiverName: '',
    paidAt: null,
  };

  try {
    if (NOT_FOUND_RE.test(html)) {
      return empty;
    }

    const rows = extractTableRows(html);
    const reference = firstRowValue(rows, REFERENCE_LABELS) ?? '';
    const amountRaw = firstRowValue(rows, AMOUNT_LABELS);
    const amountMinor = amountRaw === null ? null : amountToMinor(amountRaw);
    const senderName = firstRowValue(rows, SENDER_LABELS) ?? '';
    const receiverName = firstRowValue(rows, RECEIVER_LABELS) ?? '';
    const paidAtRaw = firstRowValue(rows, DATE_LABELS);
    const paidAt = paidAtRaw === null ? null : parseCbeDate(paidAtRaw);

    // A page that yields no recognizable receipt rows is treated as
    // unresolved (malformed HTML, error page, or logged out) — not
    // as a verdict against the reference.
    if (rows.length === 0 || (reference === '' && amountMinor === null)) {
      return empty;
    }

    return {
      found: true,
      reference,
      amountMinor,
      currency: 'ETB',
      senderName,
      receiverName,
      paidAt,
    };
  } catch {
    // cheerio on pathological input should not throw, but this is a
    // trust boundary with external bytes — stay deterministic.
    return empty;
  }
}
