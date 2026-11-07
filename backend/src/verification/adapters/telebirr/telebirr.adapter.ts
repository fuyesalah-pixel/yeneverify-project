// ============================================================
// Yene Verify — Telebirr Bank Adapter
//
// Telebirr's receipt page (transactioninfo.ethiotelecom.et) is a
// React shell: plain HTTP returns nothing useful, so this adapter
// is the one consumer of BrowserPool — headless render, then the
// shared parsers.
//
// Contract with 13E: this adapter only reports what the bank
// receipt says. Comparing it with the merchant's expectation
// (amount, receiver, date) is the verification service's job.
// ============================================================

import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../config/config.service';
import type { BankAdapter, VerifyInput, VerifyResult } from '../adapter.interface';
import { AdapterBase } from '../adapter.base';
import { BrowserPool } from '../../browser/browser-pool';
import { REFERENCE_PATTERNS, normalizeReference } from '../../regex/reference-patterns';
import { extractLabeledValue } from '../shared/label-extractor';
import { parseTelebirrReceipt } from './telebirr.parser';
import { ERROR_CODES } from '../../../common/constants/error-codes';

const TELEBIRR_BASE_URL = 'https://transactioninfo.ethiotelecom.et/receipt';

@Injectable()
export class TelebirrAdapter extends AdapterBase implements BankAdapter {
  readonly bankCode = 'TELEBIRR' as const;
  readonly displayName = 'Telebirr';

  constructor(
    private readonly pool: BrowserPool,
    private readonly config: AppConfigService,
  ) {
    super(config);
  }

  detect(rawOcrText: string): boolean {
    return /\b(telebirr|ethio\s*telecom|ethiotelecom)\b/i.test(rawOcrText);
  }

  extractReference(rawOcrText: string): string | null {
    const labeled = extractLabeledValue(rawOcrText, {
      labels: ['Transaction Number', 'Transaction ID', 'Reference'],
      validator: REFERENCE_PATTERNS.TELEBIRR,
    });
    if (labeled) return normalizeReference(labeled);

    const match = rawOcrText.match(REFERENCE_PATTERNS.TELEBIRR);
    return match ? normalizeReference(match[0]) : null;
  }

  protected async doVerify(input: VerifyInput): Promise<VerifyResult> {
    // Headless is disabled in bare test/dev environments without
    // Chromium — retryable so the queue can pick it up later.
    if (!this.config.telebirr.headlessEnabled) {
      return {
        status: 'ERROR',
        errorCode: ERROR_CODES.BANK_ADAPTER_UNAVAILABLE,
        errorMessage: 'Telebirr headless disabled in this environment',
        retryable: true,
      };
    }

    const url = `${TELEBIRR_BASE_URL}/${encodeURIComponent(input.referenceNormalized)}`;
    let page: Awaited<ReturnType<BrowserPool['getPage']>> | null = null;
    try {
      page = await this.pool.getPage();
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.bankAdapters.timeoutMs,
      });
      // The React app either fills the receipt table or renders an
      // invalid/missing marker. Either outcome ends the wait.
      await page
        .waitForFunction(
          () => {
            const text = document.body.innerText;
            return (
              text.includes('Payer Name') ||
              text.includes('Transaction Number') ||
              text.includes('not found') ||
              text.includes('Invalid')
            );
          },
          { timeout: 8000 },
        )
        .catch(() => {});

      const html = await page.content();
      const parsed = parseTelebirrReceipt(html);

      if (!parsed.found) {
        return {
          status: 'FAKE',
          errorCode: 'BANK_REFERENCE_NOT_FOUND',
          errorMessage: 'Telebirr receipt not found',
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
          errorMessage: 'Telebirr receipt parsed but required fields missing',
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
        metadata: { source: 'telebirr-headless' },
      };
    } catch (err) {
      // Name check, not instanceof: importing puppeteer's error class
      // as a value would pull the whole ESM bundle into every unit test.
      const isTimeout = err instanceof Error && err.name === 'TimeoutError';
      return {
        status: 'ERROR',
        errorCode: isTimeout ? ERROR_CODES.BANK_ADAPTER_TIMEOUT : ERROR_CODES.BANK_ADAPTER_ERROR,
        errorMessage: 'Telebirr headless fetch failed',
        retryable: true,
      };
    } finally {
      // Slot hygiene proof: even a throwing doVerify frees its slot,
      // so the pool keeps serving later verifications.
      if (page) {
        await page.close().catch(() => {});
        this.pool.release();
      }
    }
  }

  async health(): Promise<boolean> {
    return this.config.telebirr.headlessEnabled ? this.pool.health() : true;
  }
}
