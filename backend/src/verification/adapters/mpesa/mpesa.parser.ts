// ============================================================
// Yene Verify — M-Pesa Receipt Parser
//
// A thin wrapper over the shared PDF extractor: M-Pesa's labels
// are "Payer Name / Receiver Name / Amount / Transaction ID /
// Transaction Date" and failure pages bake 'not found'-style
// phrases into the PDF text itself. Reusing parsePdfTextReceipt
// gives M-Pesa the same three-state classification as the HTML
// banks (found / definitive / ambiguous) for free.
// ============================================================

import {
  parsePdfTextReceipt,
  type PdfLabelConfig,
  type PdfNotFoundReason,
  type ParsedPdfReceipt,
} from '../../parsers/pdf-field-extractor';

export type MpesaNotFoundReason = PdfNotFoundReason;

/** Shape-validated after normalization, per REFERENCE_PATTERNS.MPESA. */
const MPESA_LABELS: PdfLabelConfig = {
  pdfName: 'M-Pesa',
  referenceLabels: ['transaction id', 'transaction reference', 'receipt id', 'reference'],
  amountLabels: ['amount', 'transaction amount'],
  dateLabels: ['transaction date', 'date & time', 'datetime', 'date', 'processed on'],
  senderLabels: ['payer name', 'sender name', 'payer', 'sender'],
  receiverLabels: ['receiver name', 'payee name', 'beneficiary', 'receiver'],
  referenceShape: /^[A-Z][0-9A-Z]{9}$/,
};

/** Phrases the failure-lookup PDF prints. */
const NOT_FOUND_RE =
  /not\s+found|does\s+not\s+exist|transaction\s+not\s+available|invalid\s+transaction/i;

export interface MpesaParsedReceipt extends ParsedPdfReceipt {
  currency: 'ETB';
}

/**
 * Parse an M-Pesa PDF's extracted text. `expectedReference` is the
 * reference the lookup was made with; a PDF whose transaction ID
 * differs is a definitive mismatch verdict.
 * Never throws: garbage text → { found: false, notFound: false }.
 */
export function parseMpesaReceipt(text: string, expectedReference?: string): MpesaParsedReceipt {
  return parsePdfTextReceipt(text, {
    cfg: MPESA_LABELS,
    notFoundRe: NOT_FOUND_RE,
    expectedReference,
  });
}

/** M-Pesa label config shared for tests that assert on the wrapper. */
export const MPESA_LABELS_EXPORT = MPESA_LABELS;
