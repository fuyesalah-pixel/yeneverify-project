// ============================================================
// Yene Verify — Adapter Registry
//
// Keeps the registered BankAdapters and routes OCR text to the
// one that belongs to its bank. Zero adapters ship in this task
// (framework only); real ones register in 13D.1–13D.7, and the
// test-only StubAdapter registers programmatically in test setup.
//
// detectConfidence ordering: when several adapters claim the same
// OCR text, the one with the highest confidence wins. Adapters
// derive confidence from their longest matched keyword, which is
// what "prefer the longest matched keyword" means in practice.
// ============================================================

import { Injectable } from '@nestjs/common';
import type { BankCode } from '@prisma/client';
import type { AdapterBankCode, BankAdapter, VerifySelectedMatch } from './adapter.interface';
import { BankAdapterNotFoundError } from '../../common/errors/domain-errors';

/** Default confidence for adapters that do not implement detectConfidence. */
const DEFAULT_CONFIDENCE = 0.5;

/**
 * Structural minimum needed at registration time. Real BankAdapters
 * satisfy it; the test-only StubAdapter satisfies it too because its
 * bankCode is 'TEST_BANK' rather than a Prisma BankCode member.
 */
export type RegisterableAdapter = Pick<
  BankAdapter,
  'detect' | 'extractReference' | 'verify' | 'health'
> & {
  readonly bankCode: AdapterBankCode;
  readonly displayName: string;
};

@Injectable()
export class AdapterRegistry {
  private readonly adapters = new Map<AdapterBankCode, BankAdapter>();

  constructor(...adapters: BankAdapter[]) {
    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  /** Idempotent: re-registering a bank replaces its adapter. */
  register(adapter: RegisterableAdapter): void {
    this.adapters.set(adapter.bankCode, adapter);
  }

  get(bankCode: BankCode): BankAdapter {
    const adapter = this.adapters.get(bankCode);
    if (!adapter) {
      throw new BankAdapterNotFoundError(bankCode);
    }
    return adapter;
  }

  /** All adapters that claim this OCR text, sorted by confidence (desc). */
  detectAll(rawOcrText: string): VerifySelectedMatch[] {
    const matches: VerifySelectedMatch[] = [];
    for (const adapter of this.adapters.values()) {
      try {
        if (adapter.detect(rawOcrText)) {
          matches.push({
            adapter,
            confidence: adapter.detectConfidence?.(rawOcrText) ?? DEFAULT_CONFIDENCE,
          });
        }
      } catch {
        // A broken detect() must never break routing for the others.
        continue;
      }
    }
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /** Single best guess; null when no adapter claims the text. */
  detectBest(rawOcrText: string): VerifySelectedMatch | null {
    return this.detectAll(rawOcrText)[0] ?? null;
  }

  list(): AdapterBankCode[] {
    return [...this.adapters.keys()];
  }
}
