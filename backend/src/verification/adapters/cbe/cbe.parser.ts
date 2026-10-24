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

import { parseAmount, parseDate } from '../../parsers/field-parsers';
import type { HtmlTableRow } from '../../parsers/html.parser';
import { extractTableRows, findRow } from '../../parsers/html.parser';

// compatibility aliases (13D.1-era names used by cbe.parser.spec.ts)
export { parseAmount as amountToMinor, parseDate as parseCbeDate };

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
    const amountMinor = amountRaw === null ? null : parseAmount(amountRaw);
    const senderName = firstRowValue(rows, SENDER_LABELS) ?? '';
    const receiverName = firstRowValue(rows, RECEIVER_LABELS) ?? '';
    const paidAtRaw = firstRowValue(rows, DATE_LABELS);
    const paidAt = paidAtRaw === null ? null : parseDate(paidAtRaw);

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
