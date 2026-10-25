// ============================================================
// Yene Verify — Abyssinia Receipt Parser
//
// Same page-shape rules as the CBE/Awash/Dashen parsers, plus two
// Abyssinia-specific behaviors:
//
//   • Suffix-aware lookup: the endpoint query includes the last 5
//     digits of the destination account, so a parsed receipt whose
//     account number does NOT end with the supplied suffix is a
//     definitive "invalid suffix" outcome, not a found receipt.
//
//   • Body-text-only phrase matching (the 13D.4 lesson): definitive
//     phrases are matched against visible text extracted by cheerio
//     (script/style stripped, comments ignored by .text() naturally)
//     — never against raw HTML, where JS strings or comments such as
//     "no record-related" would false-positive a FAKE verdict.
//
//   found=true                                       → receipt parsed
//   found=false, notFound=true  (reason below)       → definitive
//   found=false, notFound=false                      → ambiguous
// ============================================================

import * as cheerio from 'cheerio';
import { parseAmount, parseDate } from '../../parsers/field-parsers';
import type { HtmlTableRow } from '../../parsers/html.parser';
import { extractTableRows, findRow } from '../../parsers/html.parser';

export type AbyssiniaNotFoundReason = 'not-found' | 'invalid-suffix';

export interface AbyssiniaParsedReceipt {
  found: boolean;
  /** True only when the page definitively says the lookup fails. */
  notFound: boolean;
  /** Which definitive outcome matched, set only when notFound. */
  notFoundReason?: AbyssiniaNotFoundReason;
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
const ACCOUNT_LABELS = ['receiver account', 'destination account', 'account number', 'account'];
const AMOUNT_LABELS = ['amount', 'transaction amount', 'transferred amount'];
const DATE_LABELS = ['transaction date', 'date & time', 'datetime', 'date', 'processed on'];
const REFERENCE_LABELS = ['transaction reference', 'reference', 'reference number', 'receipt no'];

const NOT_FOUND_RE =
  /not\s+found|no\s+record|does\s+not\s+exist|invalid\s+receipt|receipt\s+not\s+available/i;
const INVALID_SUFFIX_RE =
  /invalid\s+account|account\s+mismatch|invalid\s+suffix|do\s+not\s+line\s+up/i;

/** Visible text only: script/style removed, comments invisible to .text(). */
function visibleBodyText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript').remove();
  const text = ($('body').text() || $.text()) ?? '';
  return text.replace(/\s+/g, ' ');
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

function empty(): AbyssiniaParsedReceipt {
  return {
    found: false,
    notFound: false,
    reference: '',
    amountMinor: null,
    currency: 'ETB',
    senderName: '',
    receiverName: '',
    paidAt: null,
  };
}

function definitive(reason: AbyssiniaNotFoundReason): AbyssiniaParsedReceipt {
  return { ...empty(), notFound: true, notFoundReason: reason };
}

/**
 * Extract receipt data from an Abyssinia receipt page. `suffix` is the
 * account-suffix value the query was made with; when the page shows an
 * account number that does not end with it, the lookup failed on the
 * suffix even though the reference exists.
 * Never throws: malformed HTML → { found: false, notFound: false }.
 */
export function parseAbyssiniaReceipt(html: string, suffix?: string): AbyssiniaParsedReceipt {
  try {
    const visible = visibleBodyText(html);
    // The suffix page names the suffix problem, so it wins precedence
    // over the generic not-found phrases when a page carries both.
    if (INVALID_SUFFIX_RE.test(visible)) {
      return definitive('invalid-suffix');
    }
    if (NOT_FOUND_RE.test(visible)) {
      return definitive('not-found');
    }

    const rows = extractTableRows(html);
    const reference = firstRowValue(rows, REFERENCE_LABELS) ?? '';
    const amountRaw = firstRowValue(rows, AMOUNT_LABELS);
    const amountMinor = amountRaw === null ? null : parseAmount(amountRaw);
    const senderName = firstRowValue(rows, SENDER_LABELS) ?? '';
    const receiverName = firstRowValue(rows, RECEIVER_LABELS) ?? '';
    const accountRaw = firstRowValue(rows, ACCOUNT_LABELS);
    const paidAtRaw = firstRowValue(rows, DATE_LABELS);
    const paidAt = paidAtRaw === null ? null : parseDate(paidAtRaw);

    // No recognizable rows and no definitive phrase — most likely a
    // gateway/500 page or a shape-drifted layout. Ambiguous on purpose:
    // this must read as transient, never as a verdict.
    if (rows.length === 0 || (reference === '' && amountMinor === null)) {
      return empty();
    }

    // Suffix cross-check against the account shown on the receipt.
    if (suffix && accountRaw) {
      const accountDigits = accountRaw.replace(/\D/g, '');
      if (accountDigits.length >= suffix.length && !accountDigits.endsWith(suffix)) {
        return definitive('invalid-suffix');
      }
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
    return empty();
  }
}
