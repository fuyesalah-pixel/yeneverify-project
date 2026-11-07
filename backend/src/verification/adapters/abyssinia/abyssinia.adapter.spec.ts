// ============================================================
// Yene Verify — Abyssinia Adapter Unit Tests
//
// All HTTP is mocked — no live calls to Abyssinia. The suffix
// contract (validate BEFORE any HTTP call — proven with a spy),
// the three-state parser classification, and the FAKE-vs-ERROR
// split are exercised here.
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { of, throwError } from 'rxjs';
import type { AxiosResponse } from 'axios';
import { AbyssiniaAdapter } from './abyssinia.adapter';
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
function badSuffixHtml(): string {
  return readFileSync(resolve(__dirname, '__fixtures__/receipt-bad-suffix.html'), 'utf8');
}

const SUFFIX = '67890';
// The fixture's Receiver Account 10001234567890 ends with SUFFIX.
const input: VerifyInput = {
  reference: 'FT26201XYZ123456789012',
  referenceNormalized: 'FT26201XYZ123456789012',
  rawOcrText: `Bank of Abyssinia transfer FT26201XYZ77 to account ...${SUFFIX}`,
  merchantId: 'merchant-1',
  requestId: 'req-aby-1',
  supplementary: { accountSuffix: SUFFIX },
};
const inputWithoutSuffix: VerifyInput = { ...input, supplementary: undefined };

const baseConfig = {
  bankAdapters: { timeoutMs: 250, retries: 2, userAgent: 'yene-verify-test/1.0', mock: false },
  abyssinia: {
    endpoints: ['https://cs-aby.example.com/receipt', 'https://receipt-aby.example.com'],
  },
};

type FakeHttp = { get: jest.Mock; head: jest.Mock };

type Overrides = {
  bankAdapters?: Partial<typeof baseConfig.bankAdapters>;
  abyssinia?: Partial<typeof baseConfig.abyssinia>;
};

const makeAdapter = (http: FakeHttp, overrides?: Overrides): AbyssiniaAdapter =>
  new AbyssiniaAdapter(
    http as unknown as never,
    {
      bankAdapters: { ...baseConfig.bankAdapters, ...overrides?.bankAdapters },
      abyssinia: { ...baseConfig.abyssinia, ...overrides?.abyssinia },
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

describe('AbyssiniaAdapter detect/extract (unit)', () => {
  const adapter = makeAdapter({ get: jest.fn(), head: jest.fn() });

  it('detect() true for "Bank of Abyssinia", "Abyssinia" and "BOA"', () => {
    expect(adapter.detect('Bank of Abyssinia transfer received')).toBe(true);
    expect(adapter.detect('payment via abyssinia')).toBe(true);
    expect(adapter.detect('BOA receipt for table 4')).toBe(true);
  });

  it('detect() false for other banks', () => {
    expect(adapter.detect('CBE transfer FT26195DBK5W81465291')).toBe(false);
    expect(adapter.detect('Awash payment 2KEX10DJ7F575JQI')).toBe(false);
    expect(adapter.detect('Telebirr DEV230123HH')).toBe(false);
    expect(adapter.detect('Dashen receipt DSH9021018AB34')).toBe(false);
  });

  it('extractReference() finds the FT-prefixed reference', () => {
    expect(adapter.extractReference('BoA transfer FT26201XYZ123456789012 for Selam Coffee')).toBe(
      'FT26201XYZ123456789012',
    );
    // A CBE FT shape matches the Abyssinia pattern too — the banks are
    // separated by detect(), not by reference shape. Reject a too-short FT
    // (below the relaxed pattern's 8-char minimum after FT).
    expect(adapter.extractReference('FT26201XY')).toBeNull();
    // Separator-heavy OCR is refined later (13E); the first-pass contract
    // is shape-checked on separator-free text, like CBE/Awash.
    expect(adapter.extractReference('Abyssinia FT26201-XYZ1234')).toBeNull();
  });

  it('extractReference() returns null when no Abyssinia-shaped reference exists', () => {
    expect(adapter.extractReference('telebirr TBR99001122')).toBeNull();
  });

  // 14.3 Part A: FT suffix is [0-9A-Z] — G-Z letters must survive.
  it('extractReference() keeps G-Z letters (no hex-only truncation)', () => {
    expect(adapter.extractReference('BoA transfer FT26201WQQ7XZYM')).toBe('FT26201WQQ7XZYM');
  });

  // Phase 2: label-anchored extraction (real format FT26201XP8NP).
  it('extracts a labeled Abyssinia reference', () => {
    expect(adapter.extractReference('Transaction Reference: FT26201XP8NP')).toBe('FT26201XP8NP');
  });

  it('extracts an unlabeled Abyssinia reference via the relaxed regex', () => {
    expect(adapter.extractReference('BoA transfer FT26201XP8NP')).toBe('FT26201XP8NP');
  });

  it('returns null for a wrong-bank (non-FT) reference', () => {
    expect(adapter.extractReference('Transaction Number: DFD1U83ETH')).toBeNull();
  });

  it('returns null for empty OCR text', () => {
    expect(adapter.extractReference('')).toBeNull();
  });

  it('falls through to the regex when the labeled value is invalid', () => {
    expect(adapter.extractReference('Transaction Reference: INVALID')).toBeNull();
  });
});

describe('AbyssiniaAdapter supplementary gate (unit)', () => {
  it('ERROR BANK_SUPPLEMENTARY_REQUIRED when the suffix is missing — and ZERO HTTP calls', async () => {
    const http = { get: jest.fn(), head: jest.fn() };
    const getSpy = jest.spyOn(http, 'get');
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const failure = failureOf(await adapter.verify(inputWithoutSuffix));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_SUPPLEMENTARY_REQUIRED');
    expect(failure.retryable).toBe(false);
    expect(failure.metadata?.field).toBe('accountSuffix');
    expect(failure.metadata?.length).toBe(5);
    // The proof: supplementary validation blocks the request entirely.
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('ERROR BANK_SUPPLEMENTARY_INVALID for a non-digit suffix — and ZERO HTTP calls', async () => {
    const http = { get: jest.fn(), head: jest.fn() };
    const getSpy = jest.spyOn(http, 'get');
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const failure = failureOf(
      await adapter.verify({
        ...input,
        supplementary: { accountSuffix: '67b90' },
      }),
    );

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_SUPPLEMENTARY_INVALID');
    expect(failure.retryable).toBe(false);
    expect(failure.metadata?.received).toBe(5);
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('ERROR BANK_SUPPLEMENTARY_INVALID for a wrong length — and ZERO HTTP calls', async () => {
    const http = { get: jest.fn(), head: jest.fn() };
    const getSpy = jest.spyOn(http, 'get');
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    for (const badLength of ['1234', '123456']) {
      const failure = failureOf(
        await adapter.verify({
          ...input,
          supplementary: { accountSuffix: badLength },
        }),
      );
      expect(failure.errorCode).toBe('BANK_SUPPLEMENTARY_INVALID');
    }
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('the gate never retries even with retries configured', async () => {
    const http = { get: jest.fn(), head: jest.fn() };
    jest.spyOn(http, 'get');
    const adapter = makeAdapter(http); // retries: 2

    const failure = failureOf(await adapter.verify(inputWithoutSuffix));

    expect(failure.metadata?.attempts).toBe(1);
    expect(http.get).not.toHaveBeenCalled();
  });
});

describe('AbyssiniaAdapter doVerify (unit)', () => {
  it('VERIFIED on the success fixture, amount as bigint, suffix kept out of the URL ink', async () => {
    const http = { get: jest.fn(() => of(htmlResponse(successHtml()))), head: jest.fn() };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const success = successOf(await adapter.verify(input));

    expect(success.bankReference).toBe('FT26201XYZ123456789012');
    expect(success.amountMinor).toBe(320000n); // bigint
    expect(success.currency).toBe('ETB');
    expect(success.senderName).toBe('Abebe Kebede');
    expect(success.receiverName).toBe('Selam Coffee');
    expect(success.paidAt.toISOString()).toBe('2026-07-18T11:45:00.000Z');
    expect(success.metadata.source).toBe('abyssinia-html');
    expect(success.metadata.attempts).toBe(1);

    expect(http.get).toHaveBeenCalledTimes(1);
    expect(http.get).toHaveBeenCalledWith(
      'https://cs-aby.example.com/receipt/FT26201XYZ123456789012/67890',
      expect.objectContaining({
        responseType: 'text',
        headers: expect.objectContaining({ 'User-Agent': 'yene-verify-test/1.0' }),
      }),
    );
  });

  it('VERIFIED when the first endpoint is ambiguous and the second has the receipt', async () => {
    const http = {
      // First endpoint: ambiguous transport-shaped page; second: real receipt.
      get: jest
        .fn()
        .mockReturnValueOnce(of(htmlResponse('<h1>Gateway error</h1>', 502)))
        .mockReturnValueOnce(of(htmlResponse(successHtml()))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const success = successOf(await adapter.verify(input));

    expect(success.amountMinor).toBe(320000n);
    expect(success.metadata.endpoint).toBe('https://receipt-aby.example.com');
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.get).toHaveBeenLastCalledWith(
      'https://receipt-aby.example.com/FT26201XYZ123456789012/67890',
      expect.anything(),
    );
  });

  it('FAKE retryable=false with reason "not-found" on the not-found page', async () => {
    const http = { get: jest.fn(() => of(htmlResponse(notFoundHtml()))), head: jest.fn() };
    const adapter = makeAdapter(http); // retries: 2 — must NOT change attempts

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('FAKE');
    expect(failure.errorCode).toBe('BANK_REFERENCE_NOT_FOUND');
    expect(failure.retryable).toBe(false);
    expect(failure.metadata?.reason).toBe('not-found');
    expect(failure.metadata?.attempts).toBe(1);
    expect(http.get).toHaveBeenCalledTimes(2); // both endpoints, no retries
  });

  it('FAKE retryable=false with reason "invalid-suffix" on the bad-suffix page', async () => {
    const http = { get: jest.fn(() => of(htmlResponse(badSuffixHtml()))), head: jest.fn() };
    const adapter = makeAdapter(http);

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('FAKE');
    expect(failure.errorCode).toBe('BANK_REFERENCE_NOT_FOUND');
    expect(failure.retryable).toBe(false);
    expect(failure.metadata?.reason).toBe('invalid-suffix');
  });

  it('FAKE with reason "invalid-suffix" when the receipt account mismatches the supplied suffix', async () => {
    // Endpoint page itself is a receipt — but for a different account
    // than the suffix the user supplied. Caught by the parser check.
    const http = { get: jest.fn(() => of(htmlResponse(successHtml()))), head: jest.fn() };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const failure = failureOf(
      await adapter.verify({ ...input, supplementary: { accountSuffix: '54321' } }),
    );

    expect(failure.status).toBe('FAKE');
    expect(failure.metadata?.reason).toBe('invalid-suffix');
  });

  it('ERROR retryable=true for an ambiguous page (never a verdict)', async () => {
    const http = {
      get: jest.fn(() => of(htmlResponse('<h1>Internal Server Error</h1>', 500))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_UNAVAILABLE');
    expect(failure.retryable).toBe(true);
  });

  it('ERROR retryable=true when transport fails on both endpoints', async () => {
    const http = {
      get: jest.fn(() => throwError(() => axiosError('connect ECONNRESET'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_UNAVAILABLE');
    expect(failure.retryable).toBe(true);
    expect(failure.metadata?.errors).toHaveLength(2);
  });

  it('FAKE (not retryable) when one endpoint times out and another definitively says not-found', async () => {
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
    expect(failure.retryable).toBe(false);
  });

  it('ERROR retryable=true when no endpoints are configured', async () => {
    const http = { get: jest.fn(), head: jest.fn() };
    const adapter = makeAdapter(http, { abyssinia: { endpoints: [] } });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_UNAVAILABLE');
    expect(failure.retryable).toBe(true);
    expect(http.get).not.toHaveBeenCalled();
  });
});

describe('AbyssiniaAdapter health (unit)', () => {
  it('true when the first configured endpoint responds', async () => {
    const http = {
      get: jest.fn(),
      head: jest.fn(() => of({ data: null, status: 200 } as AxiosResponse<null>)),
    };
    const adapter = makeAdapter(http);

    expect(await adapter.health()).toBe(true);
    expect(http.head).toHaveBeenCalledWith(
      'https://cs-aby.example.com/receipt/',
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
    const adapter = makeAdapter(http, { abyssinia: { endpoints: [] } });

    expect(await adapter.health()).toBe(false);
    expect(http.head).not.toHaveBeenCalled();
  });
});

describe('AbyssiniaAdapter registry integration (unit)', () => {
  it('detectBest() routes Abyssinia-shaped OCR to the AbyssiniaAdapter', () => {
    const registry = new AdapterRegistry(makeAdapter({ get: jest.fn(), head: jest.fn() }));

    const best = registry.detectBest('Bank of Abyssinia receipt FT26201XYZ123456789012');
    expect(best).not.toBeNull();
    expect(best!.adapter).toBeInstanceOf(AbyssiniaAdapter);
  });

  it('detectBest() returns null for other banks while only Abyssinia is registered', () => {
    const registry = new AdapterRegistry(makeAdapter({ get: jest.fn(), head: jest.fn() }));

    expect(registry.detectBest('CBE FT26195DBK5W81465291')).toBeNull();
  });
});
