// ============================================================
// Yene Verify — Dashen Bank Adapter
//
// The "partial verification" bank: the receipt endpoint is
// publicly reachable but unreliable, and the domain has changed
// before. This adapter tries each configured endpoint in order
// (DASHEN_ENDPOINTS, CSV via AppConfigService.dashen.endpoints)
// and, when endpoints fail at the transport level, returns a
// retryable ERROR — the queue retries, and on exhaustion the
// verification lands in manual review (13E), never on the merchant.
//
// Classification contract (the anti-DoS rule from 13C):
//   at least one endpoint DEFINITIVELY said "no record"  → FAKE  (never retried)
//   all endpoints errored / ambiguous / server-crashed   → ERROR (retryable)
// ============================================================

import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../config/config.service';
import type { BankAdapter, VerifyInput, VerifyResult } from '../adapter.interface';
import { AdapterBase } from '../adapter.base';
import { REFERENCE_PATTERNS, normalizeReference } from '../../regex/reference-patterns';
import { extractLabeledValue } from '../shared/label-extractor';
import { parseDashenReceipt, type DashenParsedReceipt } from './dashen.parser';
import { ERROR_CODES } from '../../../common/constants/error-codes';

@Injectable()
export class DashenAdapter extends AdapterBase implements BankAdapter {
  readonly bankCode = 'DASHEN' as const;
  readonly displayName = 'Dashen Bank';

  constructor(
    private readonly httpClient: HttpService,
    private readonly config: AppConfigService,
  ) {
    super(config);
  }

  detect(rawOcrText: string): boolean {
    return /\bdashen\b/i.test(rawOcrText);
  }

  extractReference(rawOcrText: string): string | null {
    const labeled = extractLabeledValue(rawOcrText, {
      labels: ['FT Ref', 'Transaction Ref', 'Transaction Reference', 'Reference'],
      validator: REFERENCE_PATTERNS.DASHEN,
    });
    if (labeled) return normalizeReference(labeled);

    const match = rawOcrText.match(REFERENCE_PATTERNS.DASHEN);
    return match ? normalizeReference(match[0]) : null;
  }

  protected async doVerify(input: VerifyInput): Promise<VerifyResult> {
    const endpoints = this.config.dashen.endpoints;
    if (endpoints.length === 0) {
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_UNAVAILABLE,
        errorMessage: 'No Dashen endpoints configured',
        retryable: true,
      };
    }

    const errors: { url: string; reason: string; detail?: string }[] = [];
    for (const base of endpoints) {
      const url = `${base.replace(/\/+$/, '')}/${encodeURIComponent(input.referenceNormalized)}`;
      try {
        const response = await firstValueFrom(
          this.httpClient.get<string>(url, {
            timeout: this.config.bankAdapters.timeoutMs,
            responseType: 'text',
            headers: {
              'User-Agent': this.config.bankAdapters.userAgent,
              Accept: 'text/html',
            },
            // Body-qualified endpoints: parse decides found/not-found,
            // but the HTTP status still classifies server failures.
            validateStatus: () => true,
          }),
        );

        const parsed = parseDashenReceipt(response.data ?? '');
        if (parsed.found) {
          return this.successOf(parsed, input);
        }
        if (parsed.notFound) {
          // Definitive bank verdict from this endpoint — recorded first,
          // later endpoints only served as confirmation attempts.
          errors.push({ url, reason: 'not-found' });
          continue;
        }
        // Ambiguous page (gateway 500 HTML, empty shell, drifted shape):
        // NOT a verdict — handle it like a transient failure.
        errors.push({
          url,
          reason: 'transport',
          detail: `HTTP ${response.status} — ambiguous page`,
        });
      } catch (err) {
        errors.push({
          url,
          reason: 'transport',
          detail: err instanceof Error ? err.message : 'unknown error',
        });
      }
    }

    // Anti-DoS rule: one definitive no-record outweighs any number of
    // transport failures. Retrying a genuinely fake reference would
    // let an attacker multiply requests against flaky endpoints.
    if (errors.some((entry) => entry.reason === 'not-found')) {
      return {
        status: 'FAKE',
        errorCode: 'BANK_REFERENCE_NOT_FOUND',
        errorMessage: 'Dashen receipt not found on any reachable endpoint',
        retryable: false,
        metadata: { errors, reference: input.referenceNormalized },
      };
    }

    return {
      status: 'ERROR',
      errorCode: ERROR_CODES.BANK_ADAPTER_UNAVAILABLE,
      errorMessage: 'All Dashen endpoints failed at transport level',
      retryable: true,
      metadata: { errors },
    };
  }

  private successOf(parsed: DashenParsedReceipt, input: VerifyInput): VerifyResult {
    const missing: string[] = [];
    if (parsed.amountMinor === null) missing.push('amount');
    if (!parsed.senderName) missing.push('sender');
    if (!parsed.receiverName) missing.push('receiver');
    if (!parsed.paidAt) missing.push('date');
    if (missing.length > 0) {
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_ERROR,
        errorMessage: 'Dashen receipt parsed but required fields missing',
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
      metadata: { source: 'dashen-html' },
    };
  }

  async health(): Promise<boolean> {
    const endpoints = this.config.dashen.endpoints;
    if (endpoints.length === 0) {
      return false;
    }
    try {
      await firstValueFrom(
        this.httpClient.head(`${endpoints[0].replace(/\/+$/, '')}/`, {
          timeout: 3000,
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
