// ============================================================
// Yene Verify — Test-Only Stub Adapter
//
// NOT a real bank. Exists only so the verification pipeline (13E)
// can be built and tested before any real adapter (13D.*) exists,
// and so registry/base specs have a predictable subject.
//
// Import surface: `src/verification/adapters/testing/stub.adapter`.
// It is deliberately not exported from VerificationModule and never
// registered outside test setup.
// ============================================================

import type {
  AdapterRuntimeOptions,
  AdapterConfigSource,
  AdapterMetricsSink,
} from '../adapter.base';
import { AdapterBase } from '../adapter.base';
import type { AdapterBankCode, VerifyInput, VerifyResult } from '../adapter.interface';

export interface StubAdapterOptions {
  /** Override the default TEST_BANK code so registry specs can use several. */
  bankCode?: AdapterBankCode;
  /** Substrings whose presence makes detect() true. */
  detectKeywords?: string[];
  /** Reference shape matched against OCR text. */
  referencePattern?: RegExp;
  /** Full verify() handler; defaults to a deterministic VERIFIED result. */
  verifyHandler?: (input: VerifyInput) => Promise<VerifyResult>;
  /** Runtime overrides (timeoutMs / retries / backoffBaseMs) for tests. */
  runtime?: Partial<AdapterRuntimeOptions>;
}

export class StubAdapter extends AdapterBase {
  readonly bankCode: AdapterBankCode = 'TEST_BANK';
  readonly displayName = 'Test Bank';

  constructor(
    config: AdapterConfigSource,
    private readonly opts: StubAdapterOptions = {},
    metricsSink?: AdapterMetricsSink,
  ) {
    super(config, opts.runtime, metricsSink);
    this.bankCode = opts.bankCode ?? 'TEST_BANK';
  }

  detect(rawOcrText: string): boolean {
    const keywords = this.opts.detectKeywords;
    if (!keywords || keywords.length === 0) return false;
    return keywords.some((keyword) => rawOcrText.includes(keyword));
  }

  detectConfidence(rawOcrText: string): number {
    // Rank by the longest actually-matched keyword's length so the
    // registry's "longest keyword wins" ordering is observable.
    const matched = this.opts.detectKeywords?.filter((k) => rawOcrText.includes(k)) ?? [];
    if (matched.length === 0) return 0;
    const longest = matched.reduce((max, k) => Math.max(max, k.length), 0);
    return Math.min(0.99, 0.1 + longest / 100);
  }

  extractReference(rawOcrText: string): string | null {
    return rawOcrText.match(this.opts.referencePattern ?? /TESTREF-\d+/)?.[0] ?? null;
  }

  protected async doVerify(input: VerifyInput): Promise<VerifyResult> {
    if (this.opts.verifyHandler) {
      return this.opts.verifyHandler(input);
    }
    return {
      status: 'VERIFIED',
      bankReference: input.reference,
      amountMinor: 550_000n,
      currency: 'ETB',
      senderName: 'Test Sender',
      receiverName: 'Test Receiver',
      paidAt: new Date(),
      metadata: {},
    };
  }

  async health(): Promise<boolean> {
    return true;
  }
}
