// ============================================================
// Yene Verify — Zemen Bank Adapter
//
// Second PDF bank of the 13D.6+7 bundle. Zemen streams the
// receipt PDF directly (no JSON wrapper), so after the shared
// fetcher this adapter is the same endpoint loop, the same
// three-state classification and the same anti-DoS FAKE rule —
// the only differences from M-Pesa are the URL pattern's config
// source (ZEMEN_ENDPOINTS), the parser's labels, and the
// metadata source tag.
// ============================================================

import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../config/config.service';
import type { BankAdapter, VerifyInput, VerifyResult } from '../adapter.interface';
import { AdapterBase } from '../adapter.base';
import { REFERENCE_PATTERNS, normalizeReference } from '../../regex/reference-patterns';
import { extractLabeledValue } from '../shared/label-extractor';
import { fetchPdf, extractPdfText } from '../shared/pdf-fetcher';
import { parseZemenReceipt, type ZemenParsedReceipt } from './zemen.parser';
import { ERROR_CODES } from '../../../common/constants/error-codes';

@Injectable()
export class ZemenAdapter extends AdapterBase implements BankAdapter {
  readonly bankCode = 'ZEMEN' as const;
  readonly displayName = 'Zemen Bank';

  constructor(
    private readonly httpClient: HttpService,
    private readonly config: AppConfigService,
  ) {
    super(config);
  }

  detect(rawOcrText: string): boolean {
    return /\bzemen\b/i.test(rawOcrText);
  }

  extractReference(rawOcrText: string): string | null {
    const labeled = extractLabeledValue(rawOcrText, {
      labels: ['Transaction ID', 'Reference Number', 'FT Reference'],
      validator: REFERENCE_PATTERNS.ZEMEN,
    });
    if (labeled) return normalizeReference(labeled);

    const match = rawOcrText.match(REFERENCE_PATTERNS.ZEMEN);
    return match ? normalizeReference(match[0]) : null;
  }

  protected pdfOutcome(text: string, reference: string): ZemenParsedReceipt {
    return parseZemenReceipt(text, reference);
  }

  protected sourceTag(): string {
    return 'zemen-pdf';
  }

  protected async doVerify(input: VerifyInput): Promise<VerifyResult> {
    const endpoints = this.config.zemen.endpoints;
    if (endpoints.length === 0) {
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_UNAVAILABLE,
        errorMessage: 'No Zemen endpoints configured',
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

    if (errors.some((entry) => entry.kind === 'not-found' || entry.kind === 'reference-mismatch')) {
      const mismatch = errors.some((entry) => entry.kind === 'reference-mismatch');
      return {
        status: 'FAKE',
        errorCode: ERROR_CODES.BANK_REFERENCE_NOT_FOUND,
        errorMessage: mismatch
          ? 'The receipt returned by Zemen carries a different reference'
          : 'Zemen lookup definitively failed on a reachable endpoint',
        retryable: false,
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
      errorMessage: 'All Zemen endpoints failed or returned ambiguous content',
      retryable: true,
      metadata: { errors },
    };
  }

  private successOf(
    parsed: ZemenParsedReceipt,
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
        errorMessage: 'Zemen receipt parsed but required fields missing',
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
      metadata: { source: this.sourceTag(), endpoint },
    };
  }

  async health(): Promise<boolean> {
    const endpoints = this.config.zemen.endpoints;
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
