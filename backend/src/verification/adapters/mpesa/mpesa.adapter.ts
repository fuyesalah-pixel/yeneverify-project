// ============================================================
// Yene Verify — M-Pesa (Safaricom Ethiopia) Adapter
//
// Last two banks of the matrix (13D.6+7). The receipt API answers
// with either a raw PDF stream or a JSON { pdfBase64 } wrapper —
// the shared pdf-fetcher normalizes both before parsing, which
// means this adapter carries no PDF-specific logic at all: the
// three-state classification (definitive no-record → FAKE, all
// transport failures → retryable ERROR) matches Dashen/Abyssinia.
//
// Endpoints stay env-configurable (MPESA_ENDPOINTS) for the same
// reason as every bank: domains change, code deploys shouldn't.
// ============================================================

import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../config/config.service';
import type { BankAdapter, VerifyInput, VerifyResult } from '../adapter.interface';
import { AdapterBase } from '../adapter.base';
import { REFERENCE_PATTERNS, normalizeReference } from '../../regex/reference-patterns';
import { extractLabeledValue } from '../shared/label-extractor';
import { fetchPdf, extractPdfText } from '../shared/pdf-fetcher';
import { parseMpesaReceipt, type MpesaParsedReceipt } from './mpesa.parser';
// (zemen.adapter.ts shares this endpoint-loop shape)
import { ERROR_CODES } from '../../../common/constants/error-codes';

@Injectable()
export class MpesaAdapter extends AdapterBase implements BankAdapter {
  readonly bankCode = 'MPESA' as const;
  readonly displayName = 'M-Pesa Ethiopia';

  constructor(
    private readonly httpClient: HttpService,
    private readonly config: AppConfigService,
  ) {
    super(config);
  }

  detect(rawOcrText: string): boolean {
    return /\bm[\s-]?pesa\b|\bsafaricom\b/i.test(rawOcrText);
  }

  extractReference(rawOcrText: string): string | null {
    const labeled = extractLabeledValue(rawOcrText, {
      labels: ['Transaction ID', 'M-Pesa Code', 'Reference'],
      validator: REFERENCE_PATTERNS.MPESA,
    });
    if (labeled) return normalizeReference(labeled);

    const match = rawOcrText.match(REFERENCE_PATTERNS.MPESA);
    return match ? normalizeReference(match[0]) : null;
  }

  protected pdfOutcome(text: string, reference: string): MpesaParsedReceipt {
    return parseMpesaReceipt(text, reference);
  }

  protected async doVerify(input: VerifyInput): Promise<VerifyResult> {
    const endpoints = this.config.mpesa.endpoints;
    if (endpoints.length === 0) {
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_UNAVAILABLE,
        errorMessage: 'No M-Pesa endpoints configured',
        retryable: true,
      };
    }

    const errors: { url: string; kind: string; detail?: string }[] = [];
    for (const base of endpoints) {
      const url = `${base.replace(/\/+$/, '')}/${encodeURIComponent(input.referenceNormalized)}`;
      const fetched = await fetchPdf(this.httpClient, url, {
        timeoutMs: this.config.bankAdapters.timeoutMs,
        userAgent: this.config.bankAdapters.userAgent,
      });
      if (!fetched.ok) {
        // transport AND invalid-response AND too-large are all
        // non-verdicts: the endpoint never got to rule on the ref.
        errors.push({ url, kind: 'transport', detail: `${fetched.reason}: ${fetched.details}` });
        continue;
      }

      try {
        const text = await extractPdfText(fetched.pdf);
        const parsed = this.pdfOutcome(text, input.referenceNormalized);
        if (parsed.found) {
          return this.successOf(parsed, input, base);
        }
        if (parsed.notFound) {
          // Definitive bank verdict printed in the PDF text itself.
          errors.push({ url, kind: parsed.notFoundReason ?? 'not-found' });
          continue;
        }
        errors.push({
          url,
          kind: 'transport',
          detail: `HTTP 200 — ambiguous PDF text on ${base}`,
        });
      } catch (err) {
        errors.push({
          url,
          kind: 'transport',
          detail: `pdf-parse-error: ${err instanceof Error ? err.message : 'unknown'}`,
        });
      }
    }

    // Anti-DoS rule: one definitive failed lookup outweighs any number
    // of transport failures; retrying a genuinely fake reference would
    // multiply requests against the bank.
    if (errors.some((entry) => entry.kind === 'not-found' || entry.kind === 'reference-mismatch')) {
      const mismatch = errors.some((entry) => entry.kind === 'reference-mismatch');
      return {
        status: 'FAKE',
        errorCode: ERROR_CODES.BANK_REFERENCE_NOT_FOUND,
        errorMessage: mismatch
          ? 'The receipt returned by M-Pesa carries a different transaction ID'
          : 'M-Pesa lookup definitively failed on a reachable endpoint',
        retryable: false,
        // Same FAKE status, distinct client messages (13E).
        metadata: {
          reason: mismatch ? 'reference-mismatch' : 'not-found',
          errors,
          reference: input.referenceNormalized,
        },
      };
    }

    return {
      status: 'ERROR',
      errorCode: ERROR_CODES.BANK_ADAPTER_UNAVAILABLE,
      errorMessage: 'All M-Pesa endpoints failed or returned ambiguous content',
      retryable: true,
      metadata: { errors },
    };
  }

  private successOf(
    parsed: MpesaParsedReceipt,
    input: VerifyInput,
    endpoint: string,
  ): VerifyResult {
    const missing: string[] = [];
    if (parsed.amountMinor === null) missing.push('amount');
    if (!parsed.senderName) missing.push('sender');
    if (!parsed.receiverName) missing.push('receiver');
    if (!parsed.paidAt) missing.push('date');
    if (missing.length > 0) {
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_ERROR,
        errorMessage: 'M-Pesa receipt parsed but required fields missing',
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
      metadata: { source: 'mpesa-pdf', endpoint },
    };
  }

  async health(): Promise<boolean> {
    const endpoints = this.config.mpesa.endpoints;
    if (endpoints.length === 0) {
      return false;
    }
    try {
      const fetched = await fetchPdf(this.httpClient, `${endpoints[0].replace(/\/+$/, '')}/`, {
        timeoutMs: 3000,
        userAgent: this.config.bankAdapters.userAgent,
      });
      // Any shaped answer (even invalid-response) proves reachability.
      return fetched.ok || fetched.reason === 'invalid-response' || fetched.reason === 'too-large';
    } catch {
      return false;
    }
  }
}
