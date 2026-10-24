// ============================================================
// Yene Verify — Dashen Receipt Parser
//
// Same rules as the CBE/Awash parsers, with one extra signal
// Dashen specifically needs: the parser must distinguish a page
// that definitively says "no record" (a FAKE verdict) from an
// ambiguous/gateway-error page (NOT a verdict — the adapter must
// retry or fall through to another endpoint).
//
//   found=true                  → receipt parsed
//   found=false, notFound=true  → definitive no-record page
//   found=false, notFound=false → ambiguous (500 page, no rows, drift)
//
// Shares the label alias set with CBE/Awash plus the amounts and
// dates from the shared field parsers. Never throws.
// ============================================================

import { parseAmount, parseDate } from '../../parsers/field-parsers';
import type { HtmlTableRow } from '../../parsers/html.parser';
import { extractTableRows, findRow } from '../../parsers/html.parser';

export interface DashenParsedReceipt {
  found: boolean;
  /** True only when the page definitively says the receipt is unknown. */
  notFound: boolean;
  reference: string;
  amountMinor: bigint | null;
  currency: 'ETB';
  senderName: string;
  receiverName: string;
  paidAt: Date | null;
}

/** Label aliases per field, tried in order (lowercase-normalized). */
const SENDER_LABELS = ['sender name', 'payer name', 'payer', 'sender', 'from'];
const RECEIVER_LABELS = ['receiver name', 'payee name', 'beneficiary', 'receiver', 'to'];
const AMOUNT_LABELS = ['amount', 'transaction amount', 'transferred amount'];
const DATE_LABELS = ['transaction date', 'date & time', 'datetime', 'date', 'processed on'];
const REFERENCE_LABELS = [
  'transaction id',
  'txn ref',
  'reference',
  'reference number',
  'receipt no',
];

const NOT_FOUND_RE =
  /not\s+found|no\s+record|does\s+not\s+exist|invalid\s+receipt|receipt\s+not\s+available/i;

function firstRowValue(rows: HtmlTableRow[], labels: string[]): string | null {
  for (const label of labels) {
    const row = findRow(rows, label);
    if (row && row.value.length > 0) {
      return row.value;
    }
  }
  return null;
}

function empty(notFound: boolean): DashenParsedReceipt {
  return {
    found: false,
    notFound,
    reference: '',
    amountMinor: null,
    currency: 'ETB',
    senderName: '',
    receiverName: '',
    paidAt: null,
  };
}

/**
 * Extract receipt data from a Dashen receipt page.
 * Never throws: malformed HTML → { found: false, notFound: false }.
 */
export function parseDashenReceipt(html: string): DashenParsedReceipt {
  try {
    if (NOT_FOUND_RE.test(html)) {
      return empty(true);
    }

    const rows = extractTableRows(html);
    const reference = firstRowValue(rows, REFERENCE_LABELS) ?? '';
    const amountRaw = firstRowValue(rows, AMOUNT_LABELS);
    const amountMinor = amountRaw === null ? null : parseAmount(amountRaw);
    const senderName = firstRowValue(rows, SENDER_LABELS) ?? '';
    const receiverName = firstRowValue(rows, RECEIVER_LABELS) ?? '';
    const paidAtRaw = firstRowValue(rows, DATE_LABELS);
    const paidAt = paidAtRaw === null ? null : parseDate(paidAtRaw);

    // No recognizable rows and no definitive phrase — most likely a
    // gateway/500 page or a shape-drifted layout. Ambiguous on purpose:
    // this must read as transient, never as a verdict.
    if (rows.length === 0 || (reference === '' && amountMinor === null)) {
      return empty(false);
    }

    return {
      found: true,
      notFound: false,
      reference,
      amountMinor,
      currency: 'ETB',
      senderName,
      receiverName,
      paidAt,
    };
  } catch {
    // External bytes crossing the trust boundary — stay deterministic.
    return empty(false);
  }
}
