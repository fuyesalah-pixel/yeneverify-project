// ============================================================
// Yene Verify — Awash Bank Adapter
//
// Third HTTP-fetch bank: Awash exposes a plain HTML receipt page
// keyed by the transaction reference (e.g. 2KEX10DJ7F-575JQI).
// No login, no JS. Same flow as CBE: fetch → shared parser →
// VERIFIED / FAKE / ERROR.
//
// Contract with 13E: this adapter only reports what the bank
// receipt says. Comparing it with the merchant's expectation is
// the verification service's job.
// ============================================================

import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../config/config.service';
import type { BankAdapter, VerifyInput, VerifyResult } from '../adapter.interface';
import { AdapterBase } from '../adapter.base';
import { REFERENCE_PATTERNS, normalizeReference } from '../../regex/reference-patterns';
import { parseAwashReceipt } from './awash.parser';
import { ERROR_CODES } from '../../../common/constants/error-codes';

const AWASH_BASE_URL = 'https://awashpay.awashbank.com:8225';
const HEALTH_TIMEOUT_MS = 3000;

@Injectable()
export class AwashAdapter extends AdapterBase implements BankAdapter {
  readonly bankCode = 'AWASH' as const;
  readonly displayName = 'Awash Bank';

  constructor(
    private readonly httpClient: HttpService,
    private readonly config: AppConfigService,
  ) {
    super(config);
  }

  detect(rawOcrText: string): boolean {
    return /\b(awash|awashpay)\b/i.test(rawOcrText);
  }

  extractReference(rawOcrText: string): string | null {
    const match = rawOcrText.match(REFERENCE_PATTERNS.AWASH);
    return match ? normalizeReference(match[0]) : null;
  }

  protected async doVerify(input: VerifyInput): Promise<VerifyResult> {
    const url = `${AWASH_BASE_URL}/${encodeURIComponent(input.referenceNormalized)}`;
    const { timeoutMs, userAgent } = this.config.bankAdapters;

    let html: string;
    try {
      const response = await firstValueFrom(
        this.httpClient.get<string>(url, {
          timeout: timeoutMs,
          responseType: 'text',
          headers: {
            'User-Agent': userAgent,
            Accept: 'text/html',
          },
          // 4xx responses carry the same HTML error page structure;
          // the parser decides found/not-found from the body.
          validateStatus: () => true,
        }),
      );
      html = response.data;
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { status?: number } }).response?.status ?? null)
          : null;
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_ERROR,
        errorMessage: 'Awash endpoint request failed',
        retryable: true,
        metadata: { httpStatus: status },
      };
    }

    const parsed = parseAwashReceipt(html);
    if (!parsed.found) {
      return {
        status: 'FAKE',
        errorCode: 'BANK_REFERENCE_NOT_FOUND',
        errorMessage: 'Receipt not found on Awash server',
        retryable: false,
        metadata: { reference: input.referenceNormalized },
      };
    }

    const missing: string[] = [];
    if (parsed.amountMinor === null) missing.push('amount');
    if (!parsed.senderName) missing.push('sender');
    if (!parsed.receiverName) missing.push('receiver');
    if (!parsed.paidAt) missing.push('date');
    if (missing.length > 0) {
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_ERROR,
        errorMessage: 'Awash receipt parsed but required fields missing',
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
      metadata: { source: 'awash-html' },
    };
  }

  async health(): Promise<boolean> {
    try {
      await firstValueFrom(
        this.httpClient.head(`${AWASH_BASE_URL}/`, {
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
