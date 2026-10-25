// ============================================================
// Yene Verify — Shared PDF Field Extractor
//
// M-Pesa and Zemen receipts are text-layout PDFs whose labeled
// fields all follow the same "Label: value" line shape; only the
// labels (and, for the reference, the value shape) differ per
// bank. This module holds that shared logic so the two bank
// parsers stay thin wrappers over bank-specific label configs.
//
// Amounts and dates reuse the shared field-parsers so a Zemen
// '14 Jul 2026 4:20 PM' parses with the same semantics as a CBE
// '14/07/2026 4:20 PM' (Africa/Addis_Ababa wall time).
//
// Plain functions, no I/O, never throws.
// ============================================================

import { parseAmount, parseDate } from './field-parsers';

export interface PdfLabelConfig {
  /** Bank label used in error-ish messages, e.g. 'Zemen'. */
  pdfName: string;
  referenceLabels: string[];
  amountLabels: string[];
  dateLabels: string[];
  senderLabels: string[];
  receiverLabels: string[];
  /**
   * Value-shape check applied to the extracted reference AFTER
   * normalization; the bank parser owns what a mismatch means.
   */
  referenceShape: RegExp;
}

export interface PdfReceiptFields {
  reference: string;
  amountMinor: bigint | null;
  senderName: string;
  receiverName: string;
  paidAt: Date | null;
}

const emptyFields = (): PdfReceiptFields => ({
  reference: '',
  amountMinor: null,
  senderName: '',
  receiverName: '',
  paidAt: null,
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Label matchers are built per label; `\b` after the label keeps
// lookalike suffixes ('Amounted …') from matching the label.
const labelLineRe = (labelLower: string): RegExp =>
  new RegExp('^\\s*' + escapeRegExp(labelLower) + '\\b\\s*[:\\-\u2013\u2014]*\\s*(.*?)\\s*$', 'im');

/**
 * Find "<label>[:] value" anywhere in the extracted PDF text. PDF
 * extraction loses table borders, so a value follows its label
 * directly on one line ("Amount: ETB 250.00").
 */
export function findPdfLabeledValue(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const labelLower = label.trim().toLowerCase();
    const match = labelLineRe(labelLower).exec(text);
    const value = match?.[1]?.trim() ?? '';
    if (value.length > 0) {
      return value;
    }
  }
  return null;
}

/** Uppercase + separator stripping, consistent with normalizeReference. */
function normalizePdfReference(raw: string | null): string {
  if (!raw) return '';
  return raw
    .toUpperCase()
    .replace(/[\s._-]+/g, '')
    .trim();
}

/**
 * Extract labeled receipt fields from a raw PDF text dump.
 * Returns raw values only — deciding found/notFound and
 * cross-checking the reference stays with the bank parser.
 */
export function extractPdfFields(text: string, cfg: PdfLabelConfig): PdfReceiptFields {
  try {
    const referenceRaw = findPdfLabeledValue(text, cfg.referenceLabels);
    const paidAtRaw = findPdfLabeledValue(text, cfg.dateLabels);
    return {
      reference: normalizePdfReference(referenceRaw),
      amountMinor: pickMinorAmount(text, cfg.amountLabels),
      senderName: findPdfLabeledValue(text, cfg.senderLabels) ?? '',
      receiverName: findPdfLabeledValue(text, cfg.receiverLabels) ?? '',
      paidAt: paidAtRaw === null ? null : parseDate(paidAtRaw),
    };
  } catch {
    return emptyFields();
  }
}

/** 'Amount: ETB 250.00' → 25000n via the shared amount parser. */
function pickMinorAmount(text: string, labels: string[]): bigint | null {
  const raw = findPdfLabeledValue(text, labels);
  return raw === null ? null : parseAmount(raw);
}

/**
 * Required fields present? The bank parser maps gaps to its
 * "resolved but fieldless" outcome, same as the HTML banks.
 */
export function pdfFieldGaps(fields: PdfReceiptFields): string[] {
  const missing: string[] = [];
  if (fields.amountMinor === null) missing.push('amount');
  if (!fields.senderName) missing.push('sender');
  if (!fields.receiverName) missing.push('receiver');
  if (!fields.paidAt) missing.push('date');
  return missing;
}

export type PdfNotFoundReason = 'not-found' | 'reference-mismatch';

export interface ParsedPdfReceipt {
  found: boolean;
  /** True only when the PDF text definitively declares failure. */
  notFound: boolean;
  /** Which definitive outcome matched, set only when notFound. */
  notFoundReason?: PdfNotFoundReason;
  reference: string;
  amountMinor: bigint | null;
  currency: 'ETB';
  senderName: string;
  receiverName: string;
  paidAt: Date | null;
}

export interface PdfParseOptions {
  cfg: PdfLabelConfig;
  /** Definitive phrases printed INSIDE a failed-lookup PDF. */
  notFoundRe: RegExp;
  /** Reference the lookup was made with, for the cross-check. */
  expectedReference?: string;
}

const emptyPdf = (notFound: boolean, notFoundReason?: PdfNotFoundReason): ParsedPdfReceipt => ({
  found: false,
  notFound,
  notFoundReason,
  reference: '',
  amountMinor: null,
  currency: 'ETB',
  senderName: '',
  receiverName: '',
  paidAt: null,
});

/**
 * Three-state classification shared by every PDF bank:
 *
 *   found=true                       → receipt parsed
 *   found=false, notFound=true       → definitive (no record / mismatch)
 *   found=false, notFound=false      → ambiguous (drifted layout, garbage)
 *
 * The expectedReference cross-check is done here, not in the adapter,
 * so every PDF bank gets it automatically: a receipt whose own
 * transaction ID disagrees with the queried reference is a definitive
 * mismatch verdict, not a trustable receipt.
 */
export function parsePdfTextReceipt(text: string, opts: PdfParseOptions): ParsedPdfReceipt {
  try {
    if (opts.notFoundRe.test(text)) {
      return emptyPdf(true, 'not-found');
    }

    const fields = extractPdfFields(text, opts.cfg);
    if (fields.reference === '' && fields.amountMinor === null) {
      // No recognizable labeled fields at all — a drifted layout or a
      // misrouted PDF. Ambiguous on purpose: transient, never a verdict.
      return emptyPdf(false);
    }

    if (opts.expectedReference && fields.reference && fields.reference !== opts.expectedReference) {
      return emptyPdf(true, 'reference-mismatch');
    }

    return {
      found: true,
      notFound: false,
      reference: fields.reference,
      amountMinor: fields.amountMinor,
      currency: 'ETB',
      senderName: fields.senderName,
      receiverName: fields.receiverName,
      paidAt: fields.paidAt,
    };
  } catch {
    // External bytes crossing the trust boundary — stay deterministic.
    return emptyPdf(false);
  }
}
