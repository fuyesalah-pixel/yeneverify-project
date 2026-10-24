// ============================================================
// Yene Verify — CBE Bank Adapter
//
// Reference implementation for all 13D.* bank adapters.
// CBE exposes the simplest public endpoint of the 7 banks: an
// HTML receipt page keyed by the FT reference — no login, no JS.
//
// Contract with 13E: this adapter's job is ONLY "reference
// resolves → here is the real receipt". Whether the receipt
// matches what the merchant expected (amount, receiver, date) is
// the verification service's comparison, not the adapter's.
// ============================================================

import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import type { AppConfigService } from '../../../config/config.service';
import type { BankAdapter, VerifyInput, VerifyResult } from '../adapter.interface';
import { AdapterBase } from '../adapter.base';
import { REFERENCE_PATTERNS, normalizeReference } from '../../regex/reference-patterns';
import { parseCbeReceipt } from './cbe.parser';
import { ERROR_CODES } from '../../../common/constants/error-codes';

const CBE_BASE_URL = 'https://apps.cbe.com.et:100';
const HEALTH_TIMEOUT_MS = 3000;
const ACCOUNT_SUFFIX_RE = /(?:account|acct)[:\s]{0,10}(?:ending|last)?[\s:]{0,5}(\d{4,8})\b/i;

@Injectable()
export class CbeAdapter extends AdapterBase implements BankAdapter {
  readonly bankCode = 'CBE' as const;
  readonly displayName = 'Commercial Bank of Ethiopia';

  constructor(
    private readonly httpClient: HttpService,
    private readonly config: AppConfigService,
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
   * CBE sometimes requires the last digits of the recipient's
   * account alongside the reference; OCR text that carries an
   * "account ending 1234" line supplies them here.
   */
  extractSupplementary(rawOcrText: string): Record<string, string> {
    const match = rawOcrText.match(ACCOUNT_SUFFIX_RE);
    return match ? { accountSuffix: match[1] } : {};
  }

  protected async doVerify(input: VerifyInput): Promise<VerifyResult> {
    const url = `${CBE_BASE_URL}/?id=${encodeURIComponent(input.referenceNormalized)}`;
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
        errorMessage: 'CBE endpoint request failed',
        retryable: true,
        metadata: { httpStatus: status },
      };
    }

    const parsed = parseCbeReceipt(html);
    if (!parsed.found) {
      return {
        status: 'FAKE',
        errorCode: 'BANK_REFERENCE_NOT_FOUND',
        errorMessage: 'Receipt not found on CBE server',
        retryable: false,
        metadata: { reference: input.referenceNormalized },
      };
    }

    // Resolved page but the fields we need are absent — a parser or
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
      metadata: { source: 'cbe-html' },
    };
  }

  async health(): Promise<boolean> {
    try {
      await firstValueFrom(
        this.httpClient.head(`${CBE_BASE_URL}/`, {
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
