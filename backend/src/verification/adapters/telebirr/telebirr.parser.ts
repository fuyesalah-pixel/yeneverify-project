// ============================================================
// Yene Verify — Telebirr Receipt Parser
//
// Parses the RENDERED HTML that Puppeteer returns from
// https://transactioninfo.ethiotelecom.et/receipt/{reference}.
// React populates the static shell by the time we read it, so
// this is plain cheerio over final markup.
//
// Hard rule: malformed or not-found HTML NEVER throws — it
// degrades to found: false, same contract as the CBE parser.
// ============================================================

import type { HtmlTableRow } from '../../parsers/html.parser';
import { extractTableRows, findRow } from '../../parsers/html.parser';
import { parseAmount, parseDate } from '../../parsers/field-parsers';

export interface TelebirrParsedReceipt {
  found: boolean;
  reference: string;
  amountMinor: bigint | null;
  currency: 'ETB';
  senderName: string;
  receiverName: string;
  paidAt: Date | null;
}

/** Label aliases per field, tried in order (lowercase-normalized). */
const SENDER_LABELS = ['payer name', 'sender name', 'payer'];
const RECEIVER_LABELS = ['receiver name', 'payee name', 'creditor name', 'receiver'];
const AMOUNT_LABELS = ['amount (etb)', 'amount[etb]', 'amount', 'transaction amount'];
const DATE_LABELS = ['telebirr transaction date', 'transaction date', 'date'];
const REFERENCE_LABELS = [
  'transaction number',
  'transaction reference',
  'reference number',
  'reference',
];

const NOT_FOUND_RE =
  /not\s+found|invalid\s+receipt|invalid\s+transaction|receipt\s+has\s+expired|expired/i;

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
 * Extract receipt data from rendered Telebirr markup.
 * Not-found/invalid/malformed → { found: false }. Never throws.
 */
export function parseTelebirrReceipt(html: string): TelebirrParsedReceipt {
  const empty: TelebirrParsedReceipt = {
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

    // No recognizable receipt rows means the JS shell never
    // populated or the page shape changed — treat as unresolved.
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
    // External bytes crossing the trust boundary — stay deterministic.
    return empty;
  }
}
