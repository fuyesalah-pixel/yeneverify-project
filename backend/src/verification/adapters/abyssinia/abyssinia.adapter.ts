// ============================================================
// Yene Verify — Bank of Abyssinia Adapter
//
// The first "supplementary field required" bank: the receipt
// lookup needs the transaction reference AND the last 5 digits
// of the destination account (supplementary.accountSuffix).
//
// Order of operations, on purpose:
//   1. Validate the suffix BEFORE any HTTP call — without it the
//      endpoint cannot answer, so calling would be a wasted
//      round-trip against an already-flaky cs. domain.
//   2. Then the Dashen multi-endpoint pattern: try each
//      configured endpoint in order (ABYSSINIA_ENDPOINTS), first
//      definitive answer wins, transport-level failure keeps
//      looking, all-transport-failure → retryable ERROR.
//
//   one endpoint DEFINITIVELY fails (no record / bad suffix) → FAKE
//   all endpoints transport-failed or ambiguous              → ERROR
// ============================================================

import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../config/config.service';
import type { BankAdapter, VerifyInput, VerifyResult } from '../adapter.interface';
import { AdapterBase } from '../adapter.base';
import { REFERENCE_PATTERNS, normalizeReference } from '../../regex/reference-patterns';
import {
  parseAbyssiniaReceipt,
  type AbyssiniaNotFoundReason,
  type AbyssiniaParsedReceipt,
} from './abyssinia.parser';
import { ERROR_CODES } from '../../../common/constants/error-codes';

/** The suffix this bank requires before any lookup attempt. */
export const ACCOUNT_SUFFIX_LENGTH = 5;

@Injectable()
export class AbyssiniaAdapter extends AdapterBase implements BankAdapter {
  readonly bankCode = 'ABYSSINIA' as const;
  readonly displayName = 'Bank of Abyssinia';

  constructor(
    private readonly httpClient: HttpService,
    private readonly config: AppConfigService,
  ) {
    super(config);
  }

  detect(rawOcrText: string): boolean {
    return /bank\s+of\s+abyssinia|\babyssinia\b|\bboa\b/i.test(rawOcrText);
  }

  extractReference(rawOcrText: string): string | null {
    const raw = rawOcrText.match(REFERENCE_PATTERNS.ABYSSINIA)?.[0];
    return raw ? normalizeReference(raw) : null;
  }

  /** Supplementary validation happens BEFORE any HTTP call. */
  private suffixOf(input: VerifyInput): { error: VerifyResult } | { suffix: string } {
    const suffix = input.supplementary?.accountSuffix?.trim() ?? '';

    if (suffix.length === 0) {
      return {
        error: {
          status: 'ERROR',
          // Client-facing: 13E maps this to "enter the last 5 digits of the
          // account that received the payment" and resubmits with the field.
          errorCode: ERROR_CODES.BANK_SUPPLEMENTARY_REQUIRED,
          errorMessage: `${this.displayName} requires the last ${ACCOUNT_SUFFIX_LENGTH} digits of the destination account`,
          retryable: false,
          metadata: { field: 'accountSuffix', length: ACCOUNT_SUFFIX_LENGTH },
        },
      };
    }
    if (!/^\d{5}$/.test(suffix)) {
      return {
        error: {
          status: 'ERROR',
          errorCode: ERROR_CODES.BANK_SUPPLEMENTARY_INVALID,
          errorMessage: `${this.displayName} account suffix must be exactly ${ACCOUNT_SUFFIX_LENGTH} digits`,
          retryable: false,
          metadata: { field: 'accountSuffix', received: suffix.length },
        },
      };
    }
    return { suffix };
  }

  protected async doVerify(input: VerifyInput): Promise<VerifyResult> {
    const validated = this.suffixOf(input);
    if ('error' in validated) {
      return validated.error;
    }
    const suffix = validated.suffix;

    const endpoints = this.config.abyssinia.endpoints;
    if (endpoints.length === 0) {
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_UNAVAILABLE,
        errorMessage: 'No Abyssinia endpoints configured',
        retryable: true,
      };
    }

    const errors: {
      url: string;
      kind: 'not-found' | 'invalid-suffix' | 'transport';
      detail?: string;
    }[] = [];
    for (const base of endpoints) {
      const url = `${base.replace(/\/+$/, '')}/${encodeURIComponent(input.referenceNormalized)}/${suffix}`;
      try {
        const response = await firstValueFrom(
          this.httpClient.get<string>(url, {
            timeout: this.config.bankAdapters.timeoutMs,
            responseType: 'text',
            headers: {
              'User-Agent': this.config.bankAdapters.userAgent,
              Accept: 'text/html',
            },
            // Body-qualified endpoints: the parser decides found/not-found,
            // the HTTP status still classifies server failures.
            validateStatus: () => true,
          }),
        );

        const parsed = parseAbyssiniaReceipt(response.data ?? '', suffix);
        if (parsed.found) {
          return this.successOf(parsed, input, base);
        }
        if (parsed.notFound) {
          // Definitive bank verdict from this endpoint — recorded first,
          // later endpoints are only confirmation attempts.
          errors.push({ url, kind: parsed.notFoundReason ?? 'not-found' });
          continue;
        }
        // Ambiguous page (gateway 500 HTML, empty shell, drifted shape):
        // NOT a verdict — handle it like a transient failure.
        errors.push({
          url,
          kind: 'transport',
          detail: `HTTP ${response.status} — ambiguous page`,
        });
      } catch (err) {
        errors.push({
          url,
          kind: 'transport',
          detail: err instanceof Error ? err.message : 'unknown error',
        });
      }
    }

    // Anti-DoS rule: one definitive failed lookup outweighs any number of
    // transport failures. Retrying a genuinely fake reference would let an
    // attacker multiply requests against the bank.
    const firstReason = (reason: AbyssiniaNotFoundReason) =>
      errors.find((entry) => entry.kind === reason);
    const suffixReason = firstReason('invalid-suffix');
    const notFoundReason = firstReason('not-found');
    if (suffixReason || notFoundReason) {
      return {
        status: 'FAKE',
        errorCode: ERROR_CODES.BANK_REFERENCE_NOT_FOUND,
        errorMessage: suffixReason
          ? 'The destination account suffix does not match this Abyssinia receipt'
          : 'Abyssinia receipt lookup definitively failed on a reachable endpoint',
        retryable: false,
        // Same FAKE status; the client renders a different message for a
        // wrong reference versus wrong account digits (13E).
        metadata: {
          reason: suffixReason ? 'invalid-suffix' : 'not-found',
          errors,
          reference: input.referenceNormalized,
        },
      };
    }

    return {
      status: 'ERROR',
      errorCode: ERROR_CODES.BANK_ADAPTER_UNAVAILABLE,
      errorMessage: 'All Abyssinia endpoints failed at transport level',
      retryable: true,
      metadata: { errors },
    };
  }

  private successOf(
    parsed: AbyssiniaParsedReceipt,
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
        errorMessage: 'Abyssinia receipt parsed but required fields missing',
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
      metadata: { source: 'abyssinia-html', endpoint },
    };
  }

  async health(): Promise<boolean> {
    const endpoints = this.config.abyssinia.endpoints;
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
