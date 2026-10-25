// ============================================================
// Yene Verify — Zemen Receipt Parser
//
// A thin wrapper over the shared PDF extractor: Zemen's labels
// are "Sender Name / Receiver Name / Amount / Reference Number /
// Transaction Date" and references start with 108. Reusing
// parsePdfTextReceipt gives Zemen the same three-state
// classification as the HTML banks (found / definitive /
// ambiguous) for free.
// ============================================================

import {
  parsePdfTextReceipt,
  type PdfLabelConfig,
  type PdfNotFoundReason,
  type ParsedPdfReceipt,
} from '../../parsers/pdf-field-extractor';

export type ZemenNotFoundReason = PdfNotFoundReason;

/** 108 + alphanumeric, per REFERENCE_PATTERNS.ZEMEN. */
const ZEMEN_LABELS: PdfLabelConfig = {
  pdfName: 'Zemen',
  referenceLabels: ['reference number', 'transaction reference', 'reference', 'receipt no'],
  amountLabels: ['amount', 'transaction amount'],
  dateLabels: ['transaction date', 'date & time', 'datetime', 'date', 'processed on'],
  senderLabels: ['sender name', 'payer name', 'sender', 'payer'],
  receiverLabels: ['receiver name', 'beneficiary', 'payee name', 'receiver'],
  referenceShape: /^108[0-9A-Z]{9,20}$/i,
};

/** Phrases the failure-lookup PDF prints. */
const NOT_FOUND_RE =
  /no\s+record\s+found|not\s+found|does\s+not\s+exist|receipt\s+not\s+available/i;

export interface ZemenParsedReceipt extends ParsedPdfReceipt {
  currency: 'ETB';
}

/**
 * Parse a Zemen PDF's extracted text. `expectedReference` is the
 * reference the lookup was made with; a PDF whose reference
 * differs is a definitive mismatch verdict.
 * Never throws: garbage text → { found: false, notFound: false }.
 */
export function parseZemenReceipt(text: string, expectedReference?: string): ZemenParsedReceipt {
  return parsePdfTextReceipt(text, {
    cfg: ZEMEN_LABELS,
    notFoundRe: NOT_FOUND_RE,
    expectedReference,
  });
}

/** Zemen label config shared for tests that assert on the wrapper. */
export const ZEMEN_LABELS_EXPORT = ZEMEN_LABELS;
