// ============================================================
// Yene Verify — AdapterBase Unit Tests
//
// Timeout/retry behavior driven through StubAdapter with jest fake
// timers. The critical rule under test: FAKE results are NEVER
// retried — they are definitive bank verdicts, and retrying them
// would amplify attacker-submitted receipts 3x against the bank.
// ============================================================

import { Logger } from '@nestjs/common';
import { StubAdapter } from './testing/stub.adapter';
import type {
  VerifyInput,
  VerifyResult,
  VerifyResultFailure,
  VerifyResultSuccess,
} from './adapter.interface';
import type { AdapterConfigSource, AdapterMetricsSink } from './adapter.base';

const configSource: AdapterConfigSource = {
  bankAdapters: { timeoutMs: 200, retries: 2 },
} as never;

const input: VerifyInput = {
  reference: 'TESTREF-001',
  referenceNormalized: 'TESTREF-001',
  rawOcrText: 'stub text mentions TESTREF-001',
  merchantId: 'merchant-1',
  requestId: 'req-42',
};

const errorResult = (errorCode: string, retryable: boolean): VerifyResultFailure => ({
  status: 'ERROR',
  errorCode,
  errorMessage: 'transient trouble',
  retryable,
});

const verified = (): VerifyResultSuccess => ({
  status: 'VERIFIED',
  bankReference: 'TESTREF-001',
  amountMinor: 550_000n,
  currency: 'ETB',
  senderName: 'S',
  receiverName: 'R',
  paidAt: new Date(),
  metadata: {},
});

/** Narrow a VerifyResult for failure assertions. */
const failureOf = (result: VerifyResult): VerifyResultFailure => {
  if (result.status === 'VERIFIED') throw new Error('expected a failure result');
  return result;
};

/** Advance fake timers enough to flush a full retry chain. */
const flushTimers = async (totalMs: number): Promise<void> => {
  await jest.advanceTimersByTimeAsync(totalMs);
};

describe('AdapterBase (unit)', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('resolves VERIFIED with attempts=1 when doVerify succeeds', async () => {
    const adapter = new StubAdapter(configSource, { runtime: { retries: 0 } });
    const success = (await adapter.verify(input)) as VerifyResultSuccess;

    expect(success.status).toBe('VERIFIED');
    expect(success.metadata.attempts).toBe(1);
    expect(success.bankReference).toBe('TESTREF-001');
    expect(success.amountMinor).toBe(550_000n);
  });

  it('fires the hard timeout and returns BANK_ADAPTER_TIMEOUT retryable=true', async () => {
    jest.useFakeTimers();

    const neverResolves = new Promise<VerifyResult>(() => undefined);
    const adapter = new StubAdapter(configSource, {
      runtime: { timeoutMs: 200, retries: 0 },
      verifyHandler: () => neverResolves,
    });

    const pending = adapter.verify(input);
    await flushTimers(1_000);
    const failure = failureOf(await pending);

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_TIMEOUT');
    expect(failure.retryable).toBe(true);
    expect(failure.metadata?.attempts).toBe(1);
  });

  it('retries transient ERROR results and returns VERIFIED on a later attempt', async () => {
    jest.useFakeTimers();

    let calls = 0;
    const adapter = new StubAdapter(configSource, {
      runtime: { timeoutMs: 5_000, retries: 2, backoffBaseMs: 20 },
      verifyHandler: async () => {
        calls += 1;
        return calls === 1 ? errorResult('BANK_ADAPTER_ERROR', true) : verified();
      },
    });

    const pending = adapter.verify(input);
    await flushTimers(5_000); // covers both attempts + all backoff timers
    const success = (await pending) as VerifyResultSuccess;

    expect(success.status).toBe('VERIFIED');
    expect(calls).toBe(2);
    expect(success.metadata.attempts).toBe(2);
  });

  it('NEVER retries FAKE results regardless of the retryable flag', async () => {
    jest.useFakeTimers();

    let calls = 0;
    const adapter = new StubAdapter(configSource, {
      runtime: { timeoutMs: 5_000, retries: 2, backoffBaseMs: 20 },
      verifyHandler: async () => {
        calls += 1;
        // Definitive verdict claiming retryability — must still run once.
        return {
          status: 'FAKE' as const,
          errorCode: 'FAKE_REFERENCE_UNKNOWN',
          errorMessage: 'unknown reference',
          retryable: true,
        };
      },
    });

    const pending = adapter.verify(input);
    await flushTimers(5_000);
    const failure = failureOf(await pending);

    expect(failure.status).toBe('FAKE');
    expect(calls).toBe(1);
    expect(failure.metadata?.attempts).toBe(1);
  });

  it('respects a non-retryable ERROR result without retry', async () => {
    jest.useFakeTimers();

    let calls = 0;
    const adapter = new StubAdapter(configSource, {
      runtime: { timeoutMs: 5_000, retries: 2, backoffBaseMs: 20 },
      verifyHandler: async () => {
        calls += 1;
        return errorResult('BANK_REFERENCE_NOT_FOUND', false);
      },
    });

    const pending = adapter.verify(input);
    await flushTimers(5_000);
    const failure = failureOf(await pending);

    expect(failure.errorCode).toBe('BANK_REFERENCE_NOT_FOUND');
    expect(calls).toBe(1);
  });

  it('normalizes an unexpected throw to BANK_ADAPTER_ERROR retryable=true', async () => {
    jest.useFakeTimers();

    const adapter = new StubAdapter(configSource, {
      runtime: { timeoutMs: 5_000, retries: 0 },
      verifyHandler: async () => {
        throw new Error('quota exceeded');
      },
    });

    const pending = adapter.verify(input);
    await flushTimers(1_000);
    const failure = failureOf(await pending);

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_ERROR');
    expect(failure.retryable).toBe(true);
    expect(failure.errorMessage).toContain('quota exceeded');
  });

  it('emits metrics through the optional sink', async () => {
    const sink: AdapterMetricsSink = { record: jest.fn() };
    const adapter = new StubAdapter(configSource, { runtime: { retries: 0 } }, sink);
    await adapter.verify(input);

    expect(sink.record).toHaveBeenCalledWith('TEST_BANK', 'VERIFIED', 1, expect.any(Number));
  });

  it('masks references in logs (never logs the full value)', async () => {
    jest.useFakeTimers();

    const adapter = new StubAdapter(configSource, { runtime: { retries: 0 } });
    const messages: string[] = [];
    // The `log` getter is on the prototype — assignment would throw.
    // Spy on the getter so every log call routes into `messages`.
    const capture = {
      log: (msg: string) => messages.push(msg),
      warn: (msg: string) => messages.push(msg),
      error: (msg: string) => messages.push(msg),
    } as unknown as Logger;
    jest.spyOn(adapter as unknown as { log: Logger }, 'log', 'get').mockReturnValue(capture);

    const pending = adapter.verify(input);
    await flushTimers(1_000);
    await pending;

    const logged = messages.join(' | ');
    expect(logged).toContain('req-42');
    expect(logged).toContain('TEST…'); // masked prefix
    expect(logged).not.toContain('TESTREF-001');
  });
});
