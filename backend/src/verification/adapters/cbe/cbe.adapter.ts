// ============================================================
// Yene Verify — CBE Bank Adapter
//
// Reference implementation for all 13D.* bank adapters.
//
// CBE's public receipt endpoint requires BOTH the FT reference
// and the last 8 digits of the receiving account:
//
//   /BranchReceipt/{FT_REF}&{LAST_8_DIGITS}
//
// The endpoint answers with a viewable HTML page or a PDF, so the
// adapter sniffs the content type and parses either.
//
// Newer receipts carry a QR code pointing at
// https://mbreciept.cbe.com.et/{SHORT_ID}, which resolves through a
// public JSON API (no account digits, no PDF). When the scan handed
// us that URL, the JSON system is tried first and the old endpoint
// is only a fallback.
//
// Contract with 13E: this adapter's job is ONLY "reference
// resolves → here is the real receipt". Whether the receipt
// matches what the merchant expected (amount, receiver, date) is
// the verification service's comparison, not the adapter's.
// ============================================================

import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import type { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../config/config.service';
import type { BankAdapter, VerifyInput, VerifyResult } from '../adapter.interface';
import { AdapterBase } from '../adapter.base';
import { REFERENCE_PATTERNS, normalizeReference } from '../../regex/reference-patterns';
import { extractCbeNewShortId } from '../../qr/cbe-receipt-url';
import { extractPdfText } from '../../parsers/pdf.parser';
import { parseCbeReceipt, type CbeParsedReceipt } from './cbe.parser';
import { CbeNewClient, type CbeNewReceipt } from './cbe-new.client';
import { parseCbeNewReceipt } from './cbe-new.parser';
import { ERROR_CODES } from '../../../common/constants/error-codes';

const CBE_BASE_URL = 'https://apps.cbe.com.et:100';
const BRANCH_RECEIPT_PATH = '/BranchReceipt';
const HEALTH_TIMEOUT_MS = 3000;
const LAST8_RE = /^\d{8}$/;
/** OCR fallback: "Account ending 12345678" supplies the configured digits. */
const ACCOUNT_SUFFIX_RE = /(?:account|acct)[:\s]{0,10}(?:ending|last)?[\s:]{0,5}(\d{8})\b/i;

type ContentKind = 'html' | 'pdf' | 'unknown';

function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data));
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof data === 'string') return Buffer.from(data, 'utf8');
  return Buffer.alloc(0);
}

function contentTypeOf(response: AxiosResponse): string {
  const header = (response.headers as Record<string, unknown> | undefined)?.['content-type'];
  return typeof header === 'string' ? header.toLowerCase() : '';
}

function looksLikePdf(body: Buffer): boolean {
  return body.toString('latin1', 0, 4) === '%PDF';
}

function looksLikeHtml(body: Buffer): boolean {
  const head = body.toString('utf8', 0, 512).trimStart().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html') || head.includes('<html');
}

/** HTTP status carried by an axios error, or null for transport failures. */
function httpStatusOf(err: unknown): number | null {
  return err && typeof err === 'object' && 'response' in err
    ? ((err as { response?: { status?: number } }).response?.status ?? null)
    : null;
}

/**
 * Content-Type is advisory: CBE has served receipts as
 * `application/octet-stream` and with no header at all. Magic bytes
 * decide when the header is ambiguous.
 */
function contentKind(contentType: string, body: Buffer): ContentKind {
  if (contentType.includes('application/pdf')) return 'pdf';
  if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
    return 'html';
  }
  if (looksLikePdf(body)) return 'pdf';
  if (looksLikeHtml(body)) return 'html';
  return 'unknown';
}

@Injectable()
export class CbeAdapter extends AdapterBase implements BankAdapter {
  readonly bankCode = 'CBE' as const;
  readonly displayName = 'Commercial Bank of Ethiopia';

  constructor(
    private readonly httpClient: HttpService,
    private readonly config: AppConfigService,
    private readonly newClient: CbeNewClient,
  ) {
    super(config);
  }

  detect(rawOcrText: string): boolean {
    return /\b(commercial\s+bank\s+of\s+ethiopia|cbe|cbe\s+birr)\b/i.test(rawOcrText);
  }

  extractReference(rawOcrText: string): string | null {
    const match = rawOcrText.match(REFERENCE_PATTERNS.CBE);
    return match ? normalizeReference(match[0]) : null;
  }

  /**
   * OCR text carrying an "account ending 12345678" line supplies the
   * digits when the merchant has not configured an account.
   */
  extractSupplementary(rawOcrText: string): Record<string, string> {
    const match = rawOcrText.match(ACCOUNT_SUFFIX_RE);
    return match ? { last8: match[1] } : {};
  }

  /** The last 8 digits are mandatory; validate BEFORE any HTTP call. */
  private last8Of(input: VerifyInput): { error: VerifyResult } | { last8: string } {
    const last8 = input.supplementary?.last8?.trim() ?? '';

    if (last8.length === 0) {
      return {
        error: {
          status: 'ERROR',
          errorCode: ERROR_CODES.BANK_SUPPLEMENTARY_REQUIRED,
          errorMessage: 'CBE requires the last 8 digits of your receiving account',
          retryable: false,
          metadata: {
            field: 'last8',
            bankCode: 'CBE',
            action: 'CONFIGURE_ACCOUNT',
            actionHint: 'Add your CBE account number in Settings → Verification Accounts',
          },
        },
      };
    }

    if (!LAST8_RE.test(last8)) {
      return {
        error: {
          status: 'ERROR',
          errorCode: ERROR_CODES.BANK_SUPPLEMENTARY_INVALID,
          errorMessage: 'Last 8 digits must be numeric',
          retryable: false,
          metadata: { field: 'last8', received: last8 },
        },
      };
    }

    return { last8 };
  }

  protected async doVerify(input: VerifyInput): Promise<VerifyResult> {
    // New-system QR wins: it needs neither account digits nor the PDF.
    const qrUrl = input.supplementary?.qrUrl?.trim();
    if (qrUrl) {
      const shortId = extractCbeNewShortId(qrUrl);
      if (shortId) {
        const newSystem = await this.verifyNewReceipt(shortId);
        if (newSystem) return newSystem;
        // Transient failure on the new system. Only a legacy FT
        // reference can still be resolved by the old endpoint.
        if (!REFERENCE_PATTERNS.CBE.test(input.referenceNormalized)) {
          return {
            status: 'ERROR',
            errorCode: ERROR_CODES.BANK_ADAPTER_ERROR,
            errorMessage: 'CBE new receipt system request failed',
            retryable: true,
            metadata: { source: 'cbe-new-json' },
          };
        }
      }
    }

    const validated = this.last8Of(input);
    if ('error' in validated) {
      return validated.error;
    }
    const last8 = validated.last8;

    // CBE URL format: /BranchReceipt/{FT_REF}&{LAST_8_DIGITS}
    const url = `${CBE_BASE_URL}${BRANCH_RECEIPT_PATH}/${encodeURIComponent(
      input.referenceNormalized,
    )}&${last8}`;
    const { timeoutMs, userAgent } = this.config.bankAdapters;

    let response: AxiosResponse;
    try {
      response = await firstValueFrom(
        this.httpClient.get<ArrayBuffer>(url, {
          timeout: timeoutMs,
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': userAgent,
            Accept: 'text/html, application/pdf',
          },
          // Body-qualified endpoint: the checks below classify the answer.
          validateStatus: () => true,
        }),
      );
    } catch (err) {
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_ERROR,
        errorMessage: 'CBE endpoint request failed',
        retryable: true,
        metadata: { httpStatus: httpStatusOf(err) },
      };
    }

    // A 404 is a definitive "no such receipt" verdict.
    if (response.status === 404) {
      return this.referenceNotFound(input);
    }

    const body = toBuffer(response.data);
    const contentType = contentTypeOf(response);
    const parsed = await this.parseResponse(body, contentType, input.referenceNormalized);

    // A wrong account suffix is definitive: the reference may be real,
    // but this merchant's configured digits do not belong to it.
    if (parsed.accountMismatch) {
      return {
        status: 'FAKE',
        errorCode: ERROR_CODES.BANK_SUPPLEMENTARY_INVALID,
        errorMessage: 'The last 8 digits do not match this CBE receipt',
        retryable: false,
        metadata: {
          reason: 'account-mismatch',
          suggestedAction: 'CHECK_ACCOUNT_DIGITS',
          reference: input.referenceNormalized,
        },
      };
    }

    if (parsed.notFound) {
      return this.referenceNotFound(input, parsed.notFoundReason);
    }

    // Server-side failures and ambiguous content are transient — NEVER
    // a verdict against the merchant's receipt.
    if (response.status >= 500) {
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_ERROR,
        errorMessage: 'CBE endpoint returned a server error',
        retryable: true,
        metadata: { httpStatus: response.status },
      };
    }
    if (response.status < 200 || response.status >= 300) {
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_ERROR,
        errorMessage: 'CBE endpoint returned an unexpected status',
        retryable: false,
        metadata: { httpStatus: response.status },
      };
    }
    if (!parsed.found) {
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_ERROR,
        errorMessage: 'CBE returned an ambiguous receipt response',
        retryable: true,
        metadata: { httpStatus: response.status, contentType, format: parsed.format },
      };
    }

    // Resolved receipt but the fields we need are absent — a parser or
    // page-shape drift, not a transient bank problem.
    const missing: string[] = [];
    if (parsed.amountMinor === null) missing.push('amount');
    if (!parsed.senderName) missing.push('sender');
    if (!parsed.receiverName) missing.push('receiver');
    if (!parsed.paidAt) missing.push('date');
    if (missing.length > 0) {
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_ERROR,
        errorMessage: 'CBE receipt parsed but required fields missing',
        retryable: false,
        metadata: { missing },
      };
    }

    return {
      status: 'VERIFIED',
      bankReference: parsed.reference || input.referenceNormalized,
      amountMinor: parsed.amountMinor!,
      currency: 'ETB',
      senderName: parsed.senderName,
      receiverName: parsed.receiverName,
      paidAt: parsed.paidAt!,
      metadata: { source: parsed.format === 'pdf' ? 'cbe-pdf' : 'cbe-html' },
    };
  }

  /**
   * JSON system: a verified answer or a definitive "not found".
   * Returns null when the call failed transiently so doVerify can
   * fall back to the old endpoint (or report a retryable error).
   */
  private async verifyNewReceipt(shortId: string): Promise<VerifyResult | null> {
    let receipt: CbeNewReceipt;
    try {
      receipt = await this.newClient.fetchReceipt(shortId);
    } catch (err) {
      if (httpStatusOf(err) === 404) {
        return {
          status: 'FAKE',
          errorCode: ERROR_CODES.BANK_REFERENCE_NOT_FOUND,
          errorMessage: 'Receipt not found on CBE server',
          retryable: false,
          metadata: { reason: 'not-found', source: 'cbe-new-json' },
        };
      }
      return null;
    }

    const parsed = parseCbeNewReceipt(receipt);
    if (parsed.missing.length > 0) {
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_ERROR,
        errorMessage: 'CBE receipt parsed but required fields missing',
        retryable: false,
        metadata: { missing: parsed.missing, source: 'cbe-new-json' },
      };
    }

    return {
      status: 'VERIFIED',
      bankReference: parsed.reference,
      amountMinor: parsed.amountMinor!,
      currency: 'ETB',
      senderName: parsed.senderName,
      receiverName: parsed.receiverName,
      paidAt: parsed.paidAt!,
      metadata: { source: 'cbe-new-json' },
    };
  }

  /**
   * HTML → cheerio, PDF → shared labelled-text extractor. When the
   * content type is ambiguous, try HTML first and fall back to PDF
   * (the spec's ordering).
   */
  private async parseResponse(
    body: Buffer,
    contentType: string,
    reference: string,
  ): Promise<CbeParsedReceipt> {
    const kind = contentKind(contentType, body);

    if (kind === 'pdf') {
      const text = await this.tryExtractPdfText(body);
      return text === null
        ? parseCbeReceipt('', 'pdf') // ambiguous: no extractable text
        : parseCbeReceipt(text, 'pdf', reference);
    }

    if (kind === 'html') {
      return parseCbeReceipt(body.toString('utf8'), 'html');
    }

    // Ambiguous: HTML first, then PDF.
    const htmlParsed = parseCbeReceipt(body.toString('utf8'), 'html');
    if (htmlParsed.found || htmlParsed.notFound || htmlParsed.accountMismatch) {
      return htmlParsed;
    }
    const pdfText = await this.tryExtractPdfText(body);
    return pdfText === null ? htmlParsed : parseCbeReceipt(pdfText, 'pdf', reference);
  }

  /** Never throws; empty/garbled PDF text means "ambiguous", not "fake". */
  private async tryExtractPdfText(body: Buffer): Promise<string | null> {
    if (body.length === 0) return null;
    try {
      const { text } = await extractPdfText(body);
      return text.trim().length > 0 ? text : null;
    } catch {
      return null;
    }
  }

  private referenceNotFound(
    input: VerifyInput,
    reason: CbeParsedReceipt['notFoundReason'] = 'not-found',
  ): VerifyResult {
    return {
      status: 'FAKE',
      errorCode: ERROR_CODES.BANK_REFERENCE_NOT_FOUND,
      errorMessage:
        reason === 'reference-mismatch'
          ? 'The receipt returned by CBE carries a different reference'
          : 'Receipt not found on CBE server',
      retryable: false,
      metadata: { reason, reference: input.referenceNormalized },
    };
  }

  async health(): Promise<boolean> {
    try {
      await firstValueFrom(
        this.httpClient.head(`${CBE_BASE_URL}${BRANCH_RECEIPT_PATH}/`, {
          timeout: HEALTH_TIMEOUT_MS,
          // Any HTTP response proves reachability; codes are irrelevant.
          validateStatus: () => true,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
