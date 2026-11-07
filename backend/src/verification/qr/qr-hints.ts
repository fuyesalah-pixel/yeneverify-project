// ============================================================
// Yene Verify — QR Hints (v1.8.4)
//
// Turns the QR payload scanned on-device into a bank hint and a
// reference hint. Pure data module — no NestJS, no I/O — so the
// pipeline fast path and the DTO can both rely on it.
//
// SECURITY: a QR payload is CLIENT-SUPPLIED. It can only suggest
// which bank adapter to use and which reference to look up; the
// adapter still decides the verdict. Nothing here ever produces a
// PASS/VERIFIED result on its own, and raw QR content is never
// logged or stored in audit metadata (it may carry PII or tokens).
// ============================================================

import type { BankCode } from '@prisma/client';
import { normalizeReference } from '../regex/reference-patterns';
import { extractCbeNewShortId } from './cbe-receipt-url';

export const QR_CONTENT_TYPES = ['reference', 'url', 'json', 'unknown'] as const;
export type QrContentType = (typeof QR_CONTENT_TYPES)[number];

export type QrHints = {
  contentType: QrContentType;
  /** Bank identified from the payload text/host, if the adapter ships. */
  bankCode: BankCode | null;
  /** Reference exactly as it appeared in the payload. */
  reference: string | null;
  /** Uppercased, separator-free reference. */
  referenceNormalized: string | null;
  /**
   * Receipt URL carried by the payload (bank-specific lookup links).
   * Only set when the payload IS a URL or wraps one. Raw QR content
   * is never persisted; this is passed to the adapter, not audited.
   */
  url: string | null;
};

/**
 * Reference shapes the real adapters understand. Kept intentionally
 * identical to REFERENCE_PATTERNS so a QR hint can never hand an
 * adapter a shape its own extractor would reject.
 */
const REFERENCE_CANDIDATE_RE = new RegExp(
  [
    '\\bFT[0-9A-Z]{10,22}\\b',
    '\\b(?:DEV|TBR)[0-9A-Z]{8,16}\\b',
    '\\bDSH[0-9A-Z]{6,20}\\b',
    '\\b108[0-9A-Z]{9,20}\\b',
    '\\b[0-9A-Z]{10,12}-[0-9A-Z]{5,8}\\b',
  ].join('|'),
  'i',
);

/**
 * A reference-looking value supplied by a query param or JSON field.
 * Requires a digit so a URL path/field word ("welcome") can never be
 * mistaken for a transaction reference.
 */
const LOOSE_REFERENCE_RE = /^(?=.*\d)[A-Z0-9][A-Z0-9-]{5,39}$/i;

const BANK_BY_TEXT: ReadonlyArray<readonly [BankCode, RegExp]> = [
  ['CBE', /commercial\s+bank\s+of\s+ethiopia|\bcbe\b|cbe\s+birr/i],
  ['ABYSSINIA', /bank\s+of\s+abyssinia|\babyssinia\b|\bboa\b/i],
  ['AWASH', /\bawash(?:pay)?\b/i],
  ['TELEBIRR', /\btelebirr\b|ethio\s*telecom|ethiotelecom/i],
  ['DASHEN', /\bdashen\b/i],
  ['MPESA', /\bm[\s-]?pesa\b|\bsafaricom\b/i],
  ['ZEMEN', /\bzemen\b/i],
];

const BANK_BY_HOST: ReadonlyArray<readonly [BankCode, RegExp]> = [
  ['CBE', /(^|\.)cbe\.com\.et$|(^|\.)combanketh\.et$/i],
  ['ABYSSINIA', /(^|\.)bankofabyssinia\.com$/i],
  ['AWASH', /(^|\.)awashbank\.com$|(^|\.)awashpay\.com$/i],
  ['TELEBIRR', /(^|\.)ethiotelecom\.et$/i],
  ['DASHEN', /(^|\.)dashenbanksc\.com$/i],
  ['MPESA', /(^|\.)safaricom\.co\.ke$/i],
  ['ZEMEN', /(^|\.)zemenbank\.com$/i],
];

const URL_REFERENCE_PARAMS = [
  'id',
  'ref',
  'reference',
  'txn',
  'trx',
  'txnref',
  'transactionreference',
  'bankreference',
];

const JSON_REFERENCE_KEYS = ['reference', 'ref', 'transactionReference', 'bankReference', 'txnRef'];

/** Bank name mentioned in a free-form payload or URL string. */
function bankFromText(text: string): BankCode | null {
  for (const [code, re] of BANK_BY_TEXT) {
    if (re.test(text)) return code;
  }
  return null;
}

function bankFromHost(hostname: string): BankCode | null {
  for (const [code, re] of BANK_BY_HOST) {
    if (re.test(hostname)) return code;
  }
  return null;
}

/** Reference-shaped value from a param/field, normalized to the raw form. */
function referenceFromValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!LOOSE_REFERENCE_RE.test(trimmed)) return null;
  return trimmed;
}

/** First reference-shaped token inside free text. */
function referenceFromText(text: string): string | null {
  const match = text.match(REFERENCE_CANDIDATE_RE);
  return match ? match[0] : null;
}

function fromReferencePayload(raw: string): QrHints | null {
  const candidate = referenceFromText(raw) ?? referenceFromValue(raw);
  if (!candidate) return null;
  return {
    contentType: 'reference',
    bankCode: bankFromText(raw),
    reference: candidate,
    referenceNormalized: normalizeReference(candidate),
    url: null,
  };
}

function fromUrlPayload(raw: string): QrHints | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  // CBE's new receipt QR: /{SHORT_ID}. The locator is opaque, so it
  // cannot be recovered by the generic reference-shape rules below;
  // the adapter resolves it through CBE's JSON API instead.
  const cbeShortId = extractCbeNewShortId(raw);
  if (cbeShortId) {
    return {
      contentType: 'url',
      bankCode: 'CBE',
      reference: cbeShortId,
      referenceNormalized: normalizeReference(cbeShortId),
      url: raw,
    };
  }

  let candidate: string | null = null;
  for (const key of URL_REFERENCE_PARAMS) {
    // URLSearchParams is case-sensitive; check the exact and the
    // capitalized key variants used by the bank links we have seen.
    for (const name of [key, `${key[0].toUpperCase()}${key.slice(1)}`]) {
      candidate = referenceFromValue(url.searchParams.get(name));
      if (candidate) break;
    }
    if (candidate) break;
  }
  if (!candidate) {
    // Last path segment, e.g. /receipt/FT26195DBK5W81465291
    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? '';
    candidate = referenceFromText(decodeURIComponent(last));
  }
  if (!candidate) return null;

  return {
    contentType: 'url',
    bankCode: bankFromHost(url.hostname) ?? bankFromText(raw),
    reference: candidate,
    referenceNormalized: normalizeReference(candidate),
    url: raw,
  };
}

function fromJsonPayload(raw: string): QrHints | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  const nested =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {};

  for (const key of JSON_REFERENCE_KEYS) {
    const candidate = referenceFromValue(record[key]) ?? referenceFromValue(nested[key]);
    if (candidate) {
      const bankText = [record.bank, record.bankCode, nested.bank, nested.bankCode]
        .filter((v): v is string => typeof v === 'string')
        .join(' ');
      return {
        contentType: 'json',
        bankCode: bankFromText(bankText) ?? bankFromText(raw),
        reference: candidate,
        referenceNormalized: normalizeReference(candidate),
        url: null,
      };
    }
  }

  for (const key of ['url', 'verificationUrl', 'verification_url']) {
    const urlValue = record[key] ?? nested[key];
    if (typeof urlValue === 'string') {
      const fromUrl = fromUrlPayload(urlValue);
      if (fromUrl) return { ...fromUrl, contentType: 'json' };
    }
  }

  return null;
}

function autoDetect(raw: string): QrHints | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    const fromJson = fromJsonPayload(trimmed);
    if (fromJson) return fromJson;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    const fromUrl = fromUrlPayload(trimmed);
    if (fromUrl) return fromUrl;
  }
  const fromText = fromReferencePayload(trimmed);
  if (fromText) return fromText;
  return null;
}

/**
 * Resolves a scanned QR payload into hints. Returns null when the
 * payload carries nothing actionable; the caller then falls back to
 * the normal OCR pipeline.
 */
export function resolveQrHints(
  content: string | null | undefined,
  declaredType: string | null | undefined,
): QrHints | null {
  if (!content) return null;
  const raw = content.trim();
  if (raw.length === 0) return null;

  let hints: QrHints | null = null;
  switch (declaredType) {
    case 'reference':
      // A whole URL mislabelled as a reference still classifies as a URL.
      hints = /^https?:\/\//i.test(raw)
        ? (fromUrlPayload(raw) ?? fromReferencePayload(raw))
        : fromReferencePayload(raw);
      break;
    case 'url':
      hints = fromUrlPayload(raw);
      break;
    case 'json':
      hints = fromJsonPayload(raw);
      break;
    default:
      hints = null;
  }

  // A mislabelled client payload must not lose a usable hint.
  hints ??= autoDetect(raw);
  if (!hints) {
    const contentType = QR_CONTENT_TYPES.includes(declaredType as QrContentType)
      ? (declaredType as QrContentType)
      : 'unknown';
    return {
      contentType,
      bankCode: bankFromText(raw),
      reference: null,
      referenceNormalized: null,
      url: null,
    };
  }
  return hints;
}
