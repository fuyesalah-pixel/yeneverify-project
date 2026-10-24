// ============================================================
// Yene Verify — Awash Receipt Parser
//
// Turns the HTML from https://awashpay.awashbank.com:8225/{ref}
// into structured receipt data. Same rules as the CBE parser:
// pure function layer, never throws, degrades to found: false.
//
// Awash label variants (older vs newer receipt layouts) are
// handled through ordered alias lists — see the fixtures for
// both shapes.
// ============================================================

import { parseAmount, parseDate } from '../../parsers/field-parsers';
import type { HtmlTableRow } from '../../parsers/html.parser';
import { extractTableRows, findRow } from '../../parsers/html.parser';

export interface AwashParsedReceipt {
  found: boolean;
  reference: string;
  amountMinor: bigint | null;
  currency: 'ETB';
  senderName: string;
  receiverName: string;
  paidAt: Date | null;
}

/** Label aliases per field, tried in order (lowercase-normalized). */
const SENDER_LABELS = ['sender name', 'payer name', 'sender', 'from'];
const RECEIVER_LABELS = ['receiver name', 'payee name', 'beneficiary', 'receiver', 'to'];
const AMOUNT_LABELS = ['amount', 'transaction amount', 'transferred amount'];
const DATE_LABELS = ['transaction date', 'date & time', 'datetime', 'date'];
const REFERENCE_LABELS = ['transaction id', 'txn ref', 'reference', 'receipt no'];

const NOT_FOUND_RE =
  /not\s+found|no\s+record|does\s+not\s+exist|invalid\s+receipt|invalid\s+reference|receipt\s+expired|expired/i;

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
 * Extract receipt data from an Awash receipt page.
 * Not-found/no-record/malformed → { found: false }. Never throws.
 */
export function parseAwashReceipt(html: string): AwashParsedReceipt {
  const empty: AwashParsedReceipt = {
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

    // Empty shell, error page, or a shape-drifted layout — unresolved,
    // not a verdict against the reference.
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
