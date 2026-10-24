// ============================================================
// Yene Verify — AdapterBase
//
// Shared runtime concerns for every bank adapter:
//
//   • Hard per-attempt timeout (BANK_ADAPTER_TIMEOUT_MS, default 12s)
//   • Retry with exponential backoff — errors/timeouts only.
//     FAKE results are NEVER retried: they are definitive bank
//     verdicts, and retrying them would let an attacker multiply
//     requests 3x per submitted receipt.
//   • Structured logging that never logs raw OCR text or a full
//     reference (masked to a short prefix + length).
//   • Best-effort metrics counters via Redis (optional dependency
//     so unit tests can construct adapters with no I/O at all).
//   • Error normalization: any throw → BANK_ADAPTER_ERROR,
//     retryable=true → participates in retry like any error.
//
// Subclasses implement doVerify() only. verify() is final.
// Every dependency is optional/duck-typed so adapters can be
// imported in isolation without DB access.
// ============================================================

import { Logger } from '@nestjs/common';
import type { AppConfigService } from '../../config/config.service';
import type { AdapterBankCode } from './adapter.interface';
import { ERROR_CODES } from '../../common/constants/error-codes';
import type { VerifyInput, VerifyResult, VerifyResultFailure } from './adapter.interface';
import { failureFromThrownError } from './adapter.errors';

/** Drop-in runtime options resolved from config, overridable per adapter (tests). */
export interface AdapterRuntimeOptions {
  timeoutMs: number;
  retries: number;
  /** Base delay for exponential backoff, ms. retries * base stays bounded. */
  backoffBaseMs: number;
}

/** The sliver of AppConfigService AdapterBase actually needs. */
export type AdapterConfigSource = Pick<AppConfigService, 'bankAdapters'>;

/** Optional counter sink — Redis in production, absent in tests. */
export interface AdapterMetricsSink {
  record(
    bankCode: string,
    outcome: 'VERIFIED' | 'FAKE' | 'ERROR' | 'TIMEOUT',
    attempts: number,
    durationMs: number,
  ): void;
}

export function runtimeOptionsFromConfig(
  config: AdapterConfigSource,
  overrides?: Partial<AdapterRuntimeOptions>,
): AdapterRuntimeOptions {
  return {
    timeoutMs: overrides?.timeoutMs ?? config.bankAdapters.timeoutMs,
    retries: overrides?.retries ?? config.bankAdapters.retries,
    backoffBaseMs: overrides?.backoffBaseMs ?? 500,
  };
}

/** Mask a reference for logs: first 4 chars + length, never the full value. */
export function maskReference(reference: string): string {
  const head = reference.slice(0, 4);
  return `${head}…(len=${reference.length})`;
}

export abstract class AdapterBase {
  abstract readonly bankCode: AdapterBankCode;
  abstract readonly displayName: string;

  protected readonly runtime: AdapterRuntimeOptions;
  private readonly metrics?: AdapterMetricsSink;
  private logger?: Logger; // Lazy — displayName is set by the subclass.

  constructor(
    config: AdapterConfigSource,
    overrides?: Partial<AdapterRuntimeOptions>,
    metricsSink?: AdapterMetricsSink,
  ) {
    this.runtime = runtimeOptionsFromConfig(config, overrides);
    this.metrics = metricsSink;
  }

  protected get log(): Logger {
    this.logger ??= new Logger(`${this.displayName} (${this.bankCode})`);
    return this.logger;
  }

  /** Subclass hook: the bank-specific work. Throw or return a failure. */
  protected abstract doVerify(input: VerifyInput): Promise<VerifyResult>;

  /** Final wrapper — timeouts, retries, logging, metrics. Not for override. */
  async verify(input: VerifyInput): Promise<VerifyResult> {
    const maxAttempts = 1 + this.runtime.retries;
    const startedAt = Date.now();

    this.log.log(
      `verify start bank=${this.bankCode} requestId=${input.requestId} ref=${maskReference(input.reference)}`,
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let result: VerifyResult;
      try {
        result = await this.attemptWithTimeout(input, attempt);
      } catch (err) {
        // Unexpected throw → normalized, retryable, participates in retry.
        result = failureFromThrownError(err, this.bankCode, attempt);
      }

      const isFailure = result.status !== 'VERIFIED';
      const failure = isFailure ? (result as VerifyResultFailure) : null;

      if (failure && failure.status === 'FAKE') {
        // Definitive bank verdict — never retried, whatever the flag says.
        this.finish(result, attempt, startedAt, input, false);
        return this.withAttempts(result, attempt);
      }

      if (failure && failure.retryable && attempt < maxAttempts) {
        const backoff = this.runtime.backoffBaseMs * 2 ** (attempt - 1);
        this.log.warn(
          `attempt ${attempt}/${maxAttempts} failed (code=${failure.errorCode}) — retrying in ${backoff}ms`,
        );
        await this.sleep(backoff);
        continue;
      }

      this.finish(result, attempt, startedAt, input, false);
      return this.withAttempts(result, attempt);
    }

    // Unreachable: the loop always returns. Kept for exhaustiveness.
    const exhausted: VerifyResultFailure = {
      status: 'ERROR',
      errorCode: ERROR_CODES.BANK_ADAPTER_ERROR,
      errorMessage: 'Retry loop exhausted without a verdict.',
      retryable: false,
      metadata: { attempts: maxAttempts },
    };
    return exhausted;
  }

  /** Race one doVerify call against the hard timeout. */
  private async attemptWithTimeout(input: VerifyInput, attempt: number): Promise<VerifyResult> {
    return Promise.race([
      this.doVerify(input),
      new Promise<VerifyResultFailure>((resolve) => {
        void this.sleep(this.runtime.timeoutMs).then(() => {
          resolve({
            status: 'ERROR',
            errorCode: ERROR_CODES.BANK_ADAPTER_TIMEOUT,
            errorMessage: `Bank adapter did not respond within ${this.runtime.timeoutMs}ms.`,
            retryable: true,
            metadata: { attempts: attempt, timeoutMs: this.runtime.timeoutMs },
          });
        });
      }),
    ]);
  }

  private withAttempts(result: VerifyResult, attempts: number): VerifyResult {
    const metadata = { ...(result as { metadata?: Record<string, unknown> }).metadata };
    metadata.attempts = attempts;
    return { ...(result as object), metadata } as VerifyResult;
  }

  /** Best-effort log + metric emission; swallowed by design. */
  private finish(
    result: VerifyResult,
    attempts: number,
    startedAt: number,
    input: VerifyInput,
    _slow: boolean,
  ): void {
    const durationMs = Date.now() - startedAt;
    const outcome =
      result.status === 'VERIFIED'
        ? 'VERIFIED'
        : result.status === 'FAKE'
          ? 'FAKE'
          : result.errorCode === ERROR_CODES.BANK_ADAPTER_TIMEOUT
            ? 'TIMEOUT'
            : 'ERROR';

    this.log.log(
      `verify done bank=${this.bankCode} requestId=${input.requestId} outcome=${outcome} attempts=${attempts} durationMs=${durationMs}`,
    );

    this.metrics?.record(this.bankCode, outcome, attempts, durationMs);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
