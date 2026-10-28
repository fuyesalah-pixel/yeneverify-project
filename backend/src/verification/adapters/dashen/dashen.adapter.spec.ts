// ============================================================
// Yene Verify — Dashen Adapter Unit Tests
//
// All HTTP is mocked — no live calls to Dashen. The multi-
// endpoint fallback, FAKE-vs-ERROR split, and the anti-DoS rule
// (one definitive not-found beats any transport failures) are
// all exercised here.
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { of, throwError } from 'rxjs';
import type { AxiosResponse } from 'axios';
import { DashenAdapter } from './dashen.adapter';
import type {
  VerifyInput,
  VerifyResult,
  VerifyResultFailure,
  VerifyResultSuccess,
} from '../adapter.interface';
import { AdapterRegistry } from '../adapter.registry';

function successHtml(): string {
  return readFileSync(resolve(__dirname, '__fixtures__/receipt-success.html'), 'utf8');
}
function notFoundHtml(): string {
  return readFileSync(resolve(__dirname, '__fixtures__/receipt-not-found.html'), 'utf8');
}
function endpointDownHtml(): string {
  return readFileSync(resolve(__dirname, '__fixtures__/receipt-endpoint-down.html'), 'utf8');
}

const input: VerifyInput = {
  reference: 'DSH9021018AB34',
  referenceNormalized: 'DSH9021018AB34',
  rawOcrText: 'Dashen Bank payment DSH9021018AB34',
  merchantId: 'merchant-1',
  requestId: 'req-ds-1',
};

const baseConfig = {
  bankAdapters: { timeoutMs: 250, retries: 2, userAgent: 'yene-verify-test/1.0', mock: false },
  dashen: { endpoints: ['https://apps.dashenbank.com/receipt', 'https://receipt.dashenbank.com'] },
};

type FakeHttp = { get: jest.Mock; head: jest.Mock };

const makeAdapter = (
  http: FakeHttp,
  overrides?: {
    bankAdapters?: Partial<typeof baseConfig.bankAdapters>;
    dashen?: Partial<typeof baseConfig.dashen>;
  },
): DashenAdapter =>
  new DashenAdapter(
    http as unknown as never,
    {
      bankAdapters: { ...baseConfig.bankAdapters, ...overrides?.bankAdapters },
      dashen: { ...baseConfig.dashen, ...overrides?.dashen },
    } as never,
  );

const htmlResponse = (html: string, status = 200): AxiosResponse<string> =>
  ({
    data: html,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
  }) as AxiosResponse<string>;

const axiosError = (message: string, extra: Record<string, unknown> = {}): unknown =>
  Object.assign(new Error(message), extra);

const failureOf = (result: VerifyResult): VerifyResultFailure => {
  if (result.status === 'VERIFIED') throw new Error('expected a failure result');
  return result;
};

const successOf = (result: VerifyResult): VerifyResultSuccess => {
  if (result.status !== 'VERIFIED') throw new Error('expected a success result');
  return result;
};

describe('DashenAdapter detect/extract (unit)', () => {
  const adapter = makeAdapter({ get: jest.fn(), head: jest.fn() });

  it('detect() true for "Dashen" and "Dashen Bank"', () => {
    expect(adapter.detect('Dashen payment received')).toBe(true);
    expect(adapter.detect('receipt from dashen bank')).toBe(true);
  });

  it('detect() false for other banks', () => {
    expect(adapter.detect('CBE transfer FT26195DBK5W81465291')).toBe(false);
    expect(adapter.detect('Awash payment 2KEX10DJ7F575JQI')).toBe(false);
    expect(adapter.detect('Telebirr DEV230123HH')).toBe(false);
  });

  it('extractReference() finds DSH-prefixed references', () => {
    expect(adapter.extractReference('ref DSH9021018AB34')).toBe('DSH9021018AB34');
  });

  it('extractReference() finds bare numeric references', () => {
    expect(adapter.extractReference('dashen transfer 9021104512')).toBe('9021104512');
    expect(adapter.extractReference('dashen transfer 90211045123456')).toBe('90211045123456');
  });

  // 14.3 Part A: DSH suffix is [0-9A-Z] — G-Z letters must survive.
  it('extractReference() keeps G-Z letters (no hex-only truncation)', () => {
    expect(adapter.extractReference('ref DSH6029XY7WQ1')).toBe('DSH6029XY7WQ1');
  });

  it('extractReference() prefers DSH over numeric, null otherwise', () => {
    expect(adapter.extractReference('dsh code DSH9021018AB34 or 9021104512')).toBe(
      'DSH9021018AB34',
    );
    expect(adapter.extractReference('dashen payment to Selam Coffee')).toBeNull();
  });
});

describe('DashenAdapter doVerify (unit)', () => {
  it('VERIFIED when the first endpoint returns the receipt', async () => {
    const http = { get: jest.fn(() => of(htmlResponse(successHtml()))), head: jest.fn() };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const success = successOf(await adapter.verify(input));

    expect(success.amountMinor).toBe(175000n);
    expect(success.senderName).toBe('Abebe Kebede');
    expect(success.receiverName).toBe('Selam Coffee');
    expect(success.paidAt.toISOString()).toBe('2026-07-16T12:12:00.000Z');
    expect(success.metadata.attempts).toBe(1);

    expect(http.get).toHaveBeenCalledWith(
      'https://apps.dashenbank.com/receipt/DSH9021018AB34',
      expect.objectContaining({
        responseType: 'text',
        headers: expect.objectContaining({ 'User-Agent': 'yene-verify-test/1.0' }),
      }),
    );
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('VERIFIED when the first endpoint says not-found and the second succeeds', async () => {
    const http = {
      // First endpoint: definitive not-found page; second: real receipt.
      get: jest
        .fn()
        .mockReturnValueOnce(of(htmlResponse(notFoundHtml())))
        .mockReturnValueOnce(of(htmlResponse(successHtml()))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const success = successOf(await adapter.verify(input));

    expect(success.amountMinor).toBe(175000n);
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.get).toHaveBeenLastCalledWith(
      'https://receipt.dashenbank.com/DSH9021018AB34',
      expect.anything(),
    );
  });

  it('FAKE (definitive, no retry) when all endpoints say not-found', async () => {
    const http = { get: jest.fn(() => of(htmlResponse(notFoundHtml()))), head: jest.fn() };
    const adapter = makeAdapter(http); // retries: 2 — must NOT change attempts

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('FAKE');
    expect(failure.errorCode).toBe('BANK_REFERENCE_NOT_FOUND');
    expect(failure.retryable).toBe(false);
    expect(failure.metadata?.attempts).toBe(1);
    expect(http.get).toHaveBeenCalledTimes(2); // both endpoints, no retries
  });

  it('ERROR retryable when every endpoint times out at transport level', async () => {
    const http = {
      get: jest.fn(() => throwError(() => axiosError('timeout of 250ms exceeded'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_UNAVAILABLE');
    expect(failure.retryable).toBe(true);
    expect(failure.metadata?.errors).toHaveLength(2);
  });

  it('FAKE (not retryable) when one endpoint times out and one says not-found', async () => {
    const http = {
      get: jest
        .fn()
        .mockReturnValueOnce(throwError(() => axiosError('connect ETIMEDOUT')))
        .mockReturnValueOnce(of(htmlResponse(notFoundHtml()))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const failure = failureOf(await adapter.verify(input));

    // The anti-DoS rule: one definitive no-record beats the transport failure.
    expect(failure.status).toBe('FAKE');
    expect(failure.errorCode).toBe('BANK_REFERENCE_NOT_FOUND');
    expect(failure.retryable).toBe(false);
  });

  it('ERROR retryable when endpoints return ambiguous 500 pages (never a verdict)', async () => {
    const http = { get: jest.fn(() => of(htmlResponse(endpointDownHtml(), 500))), head: jest.fn() };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_UNAVAILABLE');
    expect(failure.retryable).toBe(true);
    expect(failure.metadata?.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: 'transport' })]),
    );
  });

  it('ERROR retryable when no endpoints are configured', async () => {
    const http = { get: jest.fn(), head: jest.fn() };
    const adapter = makeAdapter(http, { dashen: { endpoints: [] } });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_UNAVAILABLE');
    expect(failure.retryable).toBe(true);
    expect(http.get).not.toHaveBeenCalled();
  });

  it('retryable ERROR surfaces to the queue as a slow endpoint', async () => {
    // One quick not-found endpoint + one slow-first retryable verify on the
    // same endpoint list already proves the split; here we prove flakiness
    // survives retries: transport errors stay retryable after config retries.
    const http = {
      get: jest.fn(() => throwError(() => axiosError('connect ECONNRESET'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 2 } });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_UNAVAILABLE');
    expect(failure.retryable).toBe(true);
    expect(failure.metadata?.attempts).toBe(3);
  });
});

describe('DashenAdapter health (unit)', () => {
  it('true when the first configured endpoint responds', async () => {
    const http = {
      get: jest.fn(),
      head: jest.fn(() => of({ data: null, status: 200 } as AxiosResponse<null>)),
    };
    const adapter = makeAdapter(http);

    expect(await adapter.health()).toBe(true);
    expect(http.head).toHaveBeenCalledWith(
      'https://apps.dashenbank.com/receipt/',
      expect.objectContaining({ timeout: 3000 }),
    );
  });

  it('false when HEAD rejects', async () => {
    const http = {
      get: jest.fn(),
      head: jest.fn(() => throwError(() => new Error('network down'))),
    };
    const adapter = makeAdapter(http);

    expect(await adapter.health()).toBe(false);
  });

  it('false when no endpoints are configured', async () => {
    const http = { get: jest.fn(), head: jest.fn() };
    const adapter = makeAdapter(http, { dashen: { endpoints: [] } });

    expect(await adapter.health()).toBe(false);
    expect(http.head).not.toHaveBeenCalled();
  });
});

describe('DashenAdapter registry integration (unit)', () => {
  it('detectBest() routes Dashen-shaped OCR to the DashenAdapter', () => {
    const registry = new AdapterRegistry(makeAdapter({ get: jest.fn(), head: jest.fn() }));

    const best = registry.detectBest('Dashen Bank SMS DSH9021018AB34 transferred 1,750.00');
    expect(best).not.toBeNull();
    expect(best!.adapter).toBeInstanceOf(DashenAdapter);
  });
});
