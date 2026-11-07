// ============================================================
// Yene Verify — CBE Receipt Parser
//
// Turns the content from
// https://apps.cbe.com.et:100/BranchReceipt/{reference}&{last8}
// into structured receipt data. CBE answers with either a
// viewable HTML receipt or a PDF, so parseCbeReceipt() accepts
// both formats. Pure function layer — no HTTP, no services — so
// it is instantly unit-testable and adapter code stays thin.
//
// Hard rule: malformed or incomplete content NEVER throws. It
// degrades to found: false so the adapter can answer deterministically.
// ============================================================

import { ADDIS_DATE_FORMATS, parseAmount, parseDate } from '../../parsers/field-parsers';
import type { HtmlTableRow } from '../../parsers/html.parser';
import { extractTableRows, findRow } from '../../parsers/html.parser';

// compatibility aliases (13D.1-era names used by cbe.parser.spec.ts)
export { parseAmount as amountToMinor, parseDate as parseCbeDate };

export type CbeReceiptFormat = 'html' | 'pdf';
export type CbeNotFoundReason = 'not-found' | 'reference-mismatch';

export interface CbeParsedReceipt {
  found: boolean;
  /** True only when the content definitively declares the lookup failed. */
  notFound: boolean;
  notFoundReason?: CbeNotFoundReason;
  /** True when the bank says the last 8 digits do not match the receipt. */
  accountMismatch: boolean;
  reference: string;
  amountMinor: bigint | null;
  currency: 'ETB';
  senderName: string;
  receiverName: string;
  paidAt: Date | null;
  format: CbeReceiptFormat;
}

/** Label aliases per field, tried in order (lowercase-normalized). */
const SENDER_LABELS = ['sender name', 'payer name', 'payer'];
const RECEIVER_LABELS = ['receiver name', 'payee name', 'beneficiary', 'receiver'];
const AMOUNT_LABELS = ['amount', 'transaction amount'];
const DATE_LABELS = ['transaction date', 'date', 'processed on'];
const REFERENCE_LABELS = ['transaction reference', 'reference', 'receipt no'];

/** Phrases CBE prints for a failed reference lookup. */
export const CBE_NOT_FOUND_RE =
  /receipt\s+not\s+found|no\s+receipt|invalid\s+reference|does\s+not\s+exist/i;

/** Phrases CBE prints when the account digits do not match the receipt. */
export const CBE_ACCOUNT_MISMATCH_RE = /invalid\s+account|account\s+mismatch/i;

// The PDF prints its label column and value column as one line:
// "Reference No. (VAT Invoice No)FT26308B3ZN3". Every label matcher
// below therefore allows punctuation/whitespace (not just ':') between
// the label and the value, and tolerates trailing content.
const PDF_REFERENCE_RES = [
  /^\s*(?:Transaction\s+)?Reference(?:\s*(?:No\.?|Number))?\s*(?:\([^)]*\))?\s*[:\-\u2013\u2014]*\s*(FT[0-9A-Z]{6,})\s*$/im,
  /\bFT[0-9A-Z]{6,}\b/i,
];
const PDF_AMOUNT_RE =
  /^\s*(?:Transferred\s+Amount|Transaction\s+Amount|Amount)\s*[:\-\u2013\u2014]*\s*([^\n]*)$/gim;
const PDF_DATE_RE =
  /^\s*(?:Payment\s+Date(?:\s*&\s*Time)?|Transaction\s+Date(?:\s*&\s*Time)?|Date\s*&\s*Time|Date)\s*[:\-\u2013\u2014]*\s*([^\n]+)$/gim;
const PDF_SENDER_RE = /^\s*(?:Payer|Sender)(?:\s*Name)?\s*[:\-\u2013\u2014]*\s*([^\n]+)$/im;
const PDF_RECEIVER_RE =
  /^\s*(?:Receiver|Beneficiary|Payee)(?:\s*Name)?\s*[:\-\u2013\u2014]*\s*([^\n]+)$/im;

/** CBE PDFs add seconds and a comma after a month-first date (7/24/2026). */
const CBE_PDF_DATE_FORMATS = [
  'D/M/YYYY h:mm:ss A',
  'DD/MM/YYYY h:mm:ss A',
  'D/M/YYYY h:mm A',
  ...ADDIS_DATE_FORMATS,
];

/** "7/24/2026, 3:51:00 PM" — numeric date, 12-hour clock. */
const PDF_NUMERIC_DATE_RE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i;

/**
 * Rewrite a CBE PDF date as day-first. dayjs rolls invalid components
 * over (7/24 → month 24 → Dec 2027), so the order is resolved here:
 * CBE prints month-first; a value above 12 in the first slot is read
 * day-first instead. Returns null when neither slot is a valid month.
 */
function normalizeCbePdfDate(raw: string): string | null {
  const match = PDF_NUMERIC_DATE_RE.exec(raw.trim());
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  let month: number;
  let day: number;
  if (first > 12) {
    month = second;
    day = first;
  } else {
    month = first;
    day = second;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const seconds = match[6] ?? '00';
  return `${day}/${month}/${match[3]} ${match[4]}:${match[5]}:${seconds} ${match[7].toUpperCase()}`;
}

function valueOf(re: RegExp, text: string): string | null {
  const match = re.exec(text);
  const value = match?.[1]?.trim() ?? '';
  return value.length > 0 ? value : null;
}

function pdfReference(text: string): string {
  for (const re of PDF_REFERENCE_RES) {
    const value = valueOf(re, text);
    if (value) return value.toUpperCase();
  }
  return '';
}

function pdfAmountMinor(text: string): bigint | null {
  // Several labels mention "Amount" (Transferred, Amount in Word,
  // Total debited); take the first one that yields a number.
  for (const match of text.matchAll(PDF_AMOUNT_RE)) {
    const parsed = parseAmount(match[1] ?? '');
    if (parsed !== null) return parsed;
  }
  return null;
}

function pdfPaidAt(text: string): Date | null {
  for (const match of text.matchAll(PDF_DATE_RE)) {
    const raw = (match[1] ?? '').trim();

    const normalized = normalizeCbePdfDate(raw);
    const parsed = normalized ? parseDate(normalized, CBE_PDF_DATE_FORMATS) : null;
    if (parsed) return parsed;

    // A malformed numeric date must not reach the lenient parser,
    // which would roll the invalid components over into another year.
    if (PDF_NUMERIC_DATE_RE.test(raw)) continue;

    // Non-numeric shapes (e.g. "24 Jul 2026, 3:51 PM") keep the
    // lenient path; the comma is not part of those formats.
    for (const candidate of [raw, raw.replace(/,/g, ' ')]) {
      const fallback = parseDate(candidate, CBE_PDF_DATE_FORMATS);
      if (fallback) return fallback;
    }
  }
  return null;
}

function firstRowValue(rows: HtmlTableRow[], labels: string[]): string | null {
  for (const label of labels) {
    const row = findRow(rows, label);
    if (row && row.value.length > 0) {
      return row.value;
    }
  }
  return null;
}

function empty(
  format: CbeReceiptFormat,
  notFound = false,
  notFoundReason?: CbeNotFoundReason,
): CbeParsedReceipt {
  return {
    found: false,
    notFound,
    notFoundReason,
    accountMismatch: false,
    reference: '',
    amountMinor: null,
    currency: 'ETB',
    senderName: '',
    receiverName: '',
    paidAt: null,
    format,
  };
}

function parseHtmlReceipt(html: string): CbeParsedReceipt {
  const accountMismatch = CBE_ACCOUNT_MISMATCH_RE.test(html);
  if (CBE_NOT_FOUND_RE.test(html)) {
    return { ...empty('html', true, 'not-found'), accountMismatch };
  }
  if (accountMismatch) {
    return { ...empty('html'), accountMismatch: true };
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
    return empty('html');
  }

  return {
    found: true,
    notFound: false,
    accountMismatch: false,
    reference,
    amountMinor,
    currency: 'ETB',
    senderName,
    receiverName,
    paidAt,
    format: 'html',
  };
}

function parsePdfReceiptText(text: string, expectedReference?: string): CbeParsedReceipt {
  if (CBE_ACCOUNT_MISMATCH_RE.test(text)) {
    return { ...empty('pdf'), accountMismatch: true };
  }
  if (CBE_NOT_FOUND_RE.test(text)) {
    return empty('pdf', true, 'not-found');
  }

  const reference = pdfReference(text);
  const amountMinor = pdfAmountMinor(text);
  const senderName = valueOf(PDF_SENDER_RE, text) ?? '';
  const receiverName = valueOf(PDF_RECEIVER_RE, text) ?? '';
  const paidAt = pdfPaidAt(text);

  // No recognizable labelled fields — a drifted layout or a misrouted
  // PDF. Ambiguous on purpose: transient, never a verdict.
  if (reference === '' && amountMinor === null) {
    return empty('pdf');
  }

  if (expectedReference && reference && reference !== expectedReference) {
    return empty('pdf', true, 'reference-mismatch');
  }

  return {
    found: true,
    notFound: false,
    accountMismatch: false,
    reference,
    amountMinor,
    currency: 'ETB',
    senderName,
    receiverName,
    paidAt,
    format: 'pdf',
  };
}

/**
 * Extract receipt data from a CBE response body.
 *
 * `format` selects the reader: 'html' uses the table parser, 'pdf'
 * uses the shared labelled-text extractor (callers pass the text
 * already extracted from the PDF bytes). Never throws.
 */
export function parseCbeReceipt(
  content: string,
  format: CbeReceiptFormat = 'html',
  expectedReference?: string,
): CbeParsedReceipt {
  try {
    if (!content) {
      return empty(format);
    }
    return format === 'pdf'
      ? parsePdfReceiptText(content, expectedReference)
      : parseHtmlReceipt(content);
  } catch {
    // External bytes crossing the trust boundary — stay deterministic.
    return empty(format);
  }
}
