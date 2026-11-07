// ============================================================
// Yene Verify — Zemen Adapter Unit Tests
//
// Direct-PDF streams, three-state classification, and — because
// this completes the matrix — the final registry count test:
// exactly 7 real adapters registered, one per Prisma bank.
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { of, throwError } from 'rxjs';
import type { AxiosResponse } from 'axios';
import { Logger } from '@nestjs/common';
import { ZemenAdapter } from './zemen.adapter';
import { CbeAdapter } from '../cbe/cbe.adapter';
import { TelebirrAdapter } from '../telebirr/telebirr.adapter';
import { AwashAdapter } from '../awash/awash.adapter';
import { DashenAdapter } from '../dashen/dashen.adapter';
import { AbyssiniaAdapter } from '../abyssinia/abyssinia.adapter';
import { MpesaAdapter } from '../mpesa/mpesa.adapter';
import type {
  VerifyInput,
  VerifyResult,
  VerifyResultFailure,
  VerifyResultSuccess,
} from '../adapter.interface';
import { AdapterRegistry } from '../adapter.registry';
import { PDF_MAX_BYTES } from '../shared/pdf-fetcher';
import type { BrowserPool } from '../../browser/browser-pool';

const successPdf = () => readFileSync(resolve(__dirname, 'fixtures/receipt-success.pdf'));
const notFoundPdf = () => readFileSync(resolve(__dirname, 'fixtures/receipt-not-found.pdf'));
const mismatchPdf = () => readFileSync(resolve(__dirname, 'fixtures/receipt-mismatch.pdf'));
const notFoundHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-not-found.html'), 'utf8');

const input: VerifyInput = {
  reference: '108IBET252931385',
  referenceNormalized: '108IBET252931385',
  rawOcrText: 'Zemen Bank transfer 108IBET252931385',
  merchantId: 'merchant-1',
  requestId: 'req-zm-1',
};

const baseConfig = {
  bankAdapters: { timeoutMs: 250, retries: 2, userAgent: 'yene-verify-test/1.0', mock: false },
  zemen: {
    endpoints: ['https://apps-zemen.example.com/receipt', 'https://zemen-b.example.com'],
  },
};

type FakeHttp = { get: jest.Mock; head: jest.Mock };

const makeAdapter = (
  http: FakeHttp,
  overrides?: {
    bankAdapters?: Partial<typeof baseConfig.bankAdapters>;
    zemen?: Partial<typeof baseConfig.zemen>;
  },
): ZemenAdapter =>
  new ZemenAdapter(
    http as unknown as never,
    {
      bankAdapters: { ...baseConfig.bankAdapters, ...overrides?.bankAdapters },
      zemen: { ...baseConfig.zemen, ...overrides?.zemen },
    } as never,
  );

const bufferResponse = (data: Buffer | string, contentType: string): AxiosResponse =>
  ({
    data,
    status: 200,
    statusText: 'OK',
    headers: contentType === '' ? {} : { 'content-type': contentType },
  }) as unknown as AxiosResponse;

const axiosError = (message: string): unknown => Object.assign(new Error(message), {});

const failureOf = (result: VerifyResult): VerifyResultFailure => {
  if (result.status === 'VERIFIED') throw new Error('expected a failure result');
  return result;
};
const successOf = (result: VerifyResult): VerifyResultSuccess => {
  if (result.status !== 'VERIFIED') throw new Error('expected a success result');
  return result;
};

describe('ZemenAdapter detect/extract (unit)', () => {
  const adapter = makeAdapter({ get: jest.fn(), head: jest.fn() });

  it('detect() true for "Zemen" and "Zemen Bank"', () => {
    expect(adapter.detect('Zemen transaction receipt')).toBe(true);
    expect(adapter.detect('payment from zemen bank')).toBe(true);
  });

  it('detect() false for other banks', () => {
    expect(adapter.detect('M-Pesa receipt MPX1234ABC')).toBe(false);
    expect(adapter.detect('CBE transfer FT26195DBK5W81465291')).toBe(false);
    expect(adapter.detect('Awash payment 2KEX10DJ7F575JQI')).toBe(false);
  });

  it('extractReference() extracts the 108-prefixed numeric reference', () => {
    expect(adapter.extractReference('Zemen ref 108IBET252931385')).toBe('108IBET252931385');
    expect(adapter.extractReference('Zemen receipt 108987654321098')).toBe('108987654321098');
  });

  // 14.3 Part A: 108 suffix is [0-9A-Z] — G-Z letters must survive.
  it('extractReference() keeps G-Z letters (no hex-only truncation)', () => {
    expect(adapter.extractReference('Zemen ref 108WVX987654Y')).toBe('108WVX987654Y');
  });

  it('extractReference() returns null without the 108 prefix', () => {
    expect(adapter.extractReference('telebirr TBR99001122')).toBeNull();
    expect(adapter.extractReference('plain number 9876543210')).toBeNull();
  });

  // Phase 2: label-anchored extraction (pattern keeps the 108 prefix).
  it('extracts a labeled Zemen reference', () => {
    expect(adapter.extractReference('Transaction ID: 108IBET252931385')).toBe('108IBET252931385');
  });

  it('extracts an unlabeled Zemen reference via the strict regex', () => {
    expect(adapter.extractReference('Zemen ref 108IBET252931385')).toBe('108IBET252931385');
  });

  it('returns null for a wrong-bank (non-108) reference', () => {
    expect(adapter.extractReference('ref FT26201XP8NP')).toBeNull();
  });

  it('returns null for empty OCR text', () => {
    expect(adapter.extractReference('')).toBeNull();
  });

  it('falls through to the regex when the labeled value is invalid', () => {
    expect(adapter.extractReference('Transaction ID: 9876543210')).toBeNull();
  });
});

describe('ZemenAdapter doVerify (unit)', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype as unknown as { log: jest.Mock }, 'log');
  });
  afterEach(() => logSpy.mockRestore());

  it('VERIFIED from the direct-PDF endpoint', async () => {
    const http = {
      get: jest.fn(() => of(bufferResponse(successPdf(), 'application/pdf'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const success = successOf(await adapter.verify(input));

    expect(success.bankReference).toBe('108IBET252931385');
    expect(success.amountMinor).toBe(45000n); // bigint
    expect(success.currency).toBe('ETB');
    expect(success.senderName).toBe('Dawit Tesfaye');
    expect(success.receiverName).toBe('Dawit Electronics');
    // 18/07/2026 4:20 PM in Africa/Addis_Ababa (UTC+3)
    expect(success.paidAt.toISOString()).toBe('2026-07-18T13:20:00.000Z');
    expect(success.metadata.source).toBe('zemen-pdf');
    expect(success.metadata.attempts).toBe(1);
    expect(http.get).toHaveBeenCalledWith(
      'https://apps-zemen.example.com/receipt/108IBET252931385',
      expect.objectContaining({ responseType: 'arraybuffer' }),
    );
  });

  it('VERIFIED when the first endpoint is ambiguous and the second has the receipt', async () => {
    const http = {
      get: jest
        .fn()
        .mockReturnValueOnce(
          of(bufferResponse(Buffer.from('%PDF garbled layout'), 'application/pdf')),
        )
        .mockReturnValueOnce(of(bufferResponse(successPdf(), 'application/pdf'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const success = successOf(await adapter.verify(input));

    expect(success.amountMinor).toBe(45000n);
    expect(success.metadata.endpoint).toBe('https://zemen-b.example.com');
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('FAKE retryable=false, reason "not-found" on the definitive failure PDF', async () => {
    const http = {
      get: jest.fn(() => of(bufferResponse(notFoundPdf(), 'application/pdf'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http);

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('FAKE');
    expect(failure.errorCode).toBe('BANK_REFERENCE_NOT_FOUND');
    expect(failure.retryable).toBe(false);
    expect(failure.metadata?.reason).toBe('not-found');
    expect(failure.metadata?.attempts).toBe(1);
    expect(http.get).toHaveBeenCalledTimes(2); // both endpoints, no retries
  });

  it('FAKE with reason "reference-mismatch" when the PDF carries a different reference', async () => {
    // Real PDF bytes: a receipt for a DIFFERENT reference than queried.
    const http = {
      get: jest.fn(() => of(bufferResponse(mismatchPdf(), 'application/pdf'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('FAKE');
    expect(failure.retryable).toBe(false);
    expect(failure.metadata?.reason).toBe('reference-mismatch');
  });

  it('ERROR retryable=true when a misconfigured endpoint sends an HTML not-found page', async () => {
    const http = {
      get: jest.fn(() => of(bufferResponse(notFoundHtml(), 'text/html'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_UNAVAILABLE');
    expect(failure.retryable).toBe(true);
    expect(JSON.stringify(failure.metadata?.errors)).toContain('invalid-response');
  });

  it('ERROR retryable=true when the body exceeds the 5MB cap', async () => {
    const http = {
      get: jest.fn(() =>
        of(bufferResponse(Buffer.alloc(PDF_MAX_BYTES + 1, 0x25), 'application/pdf')),
      ),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.retryable).toBe(true);
    expect(JSON.stringify(failure.metadata?.errors)).toContain('too-large');
  });

  it('ERROR retryable=true when transport fails on both endpoints', async () => {
    const http = {
      get: jest.fn(() => throwError(() => axiosError('connect ETIMEDOUT'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_UNAVAILABLE');
    expect(failure.retryable).toBe(true);
  });

  it('ERROR retryable=true when no endpoints are configured', async () => {
    const http = { get: jest.fn(), head: jest.fn() };
    const adapter = makeAdapter(http, { zemen: { endpoints: [] } });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.retryable).toBe(true);
    expect(http.get).not.toHaveBeenCalled();
  });

  it('FAKE beats a transport failure on the other endpoint (anti-DoS rule)', async () => {
    const http = {
      get: jest
        .fn()
        .mockReturnValueOnce(throwError(() => axiosError('connect ECONNRESET')))
        .mockReturnValueOnce(of(bufferResponse(notFoundPdf(), 'application/pdf'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('FAKE');
    expect(failure.retryable).toBe(false);
  });

  it('PII rule: receipt bytes and extracted names never appear in any log call', async () => {
    const http = {
      get: jest.fn(() => of(bufferResponse(successPdf(), 'application/pdf'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    await adapter.verify(input);

    const logged = (logSpy.mock.calls as unknown[][])
      .map((call) => call.map((arg) => String(arg)).join(' '))
      .join('\n');
    expect(logged).not.toContain('%PDF');
    expect(logged).not.toContain('Dawit Tesfaye');
    expect(logged).not.toContain('45000');
  });
});

describe('ZemenAdapter health (unit)', () => {
  it('true when the endpoint answers with a PDF', async () => {
    const http = {
      get: jest.fn(() => of(bufferResponse(successPdf(), 'application/pdf'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http);

    expect(await adapter.health()).toBe(true);
  });

  it('false when transport fails on every health probe', async () => {
    const http = {
      get: jest.fn(() => throwError(() => axiosError('connect ECONNREFUSED'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http);

    expect(await adapter.health()).toBe(false);
  });

  it('false when no endpoints are configured', async () => {
    const http = { get: jest.fn(), head: jest.fn() };
    const adapter = makeAdapter(http, { zemen: { endpoints: [] } });

    expect(await adapter.health()).toBe(false);
    expect(http.get).not.toHaveBeenCalled();
  });
});

describe('ZemenAdapter registry integration (unit)', () => {
  it('detectBest() routes Zemen-shaped OCR to the ZemenAdapter', () => {
    const registry = new AdapterRegistry(makeAdapter({ get: jest.fn(), head: jest.fn() }));

    const best = registry.detectBest('Zemen Bank receipt 108IBET252931385 450.00');
    expect(best).not.toBeNull();
    expect(best!.adapter).toBeInstanceOf(ZemenAdapter);
  });

  it('the full matrix: exactly 7 real adapters register, one per Prisma bank', () => {
    const cfg = () =>
      ({
        bankAdapters: {
          timeoutMs: 250,
          retries: 0,
          userAgent: 'yene-verify-test/1.0',
          mock: false,
        },
        dashen: { endpoints: [] },
        abyssinia: { endpoints: [] },
        mpesa: { endpoints: [] },
        zemen: { endpoints: [] },
      }) as never;
    const httpStub = {} as never;
    const poolStub = {} as BrowserPool;

    const registry = new AdapterRegistry(
      new CbeAdapter(httpStub, cfg(), {} as never),
      new TelebirrAdapter(poolStub, cfg()),
      new AwashAdapter(httpStub, cfg()),
      new DashenAdapter(httpStub, cfg()),
      new AbyssiniaAdapter(httpStub, cfg()),
      new MpesaAdapter(httpStub, cfg()),
      new ZemenAdapter(httpStub, cfg()),
    );

    expect(registry.list().sort()).toEqual([
      'ABYSSINIA',
      'AWASH',
      'CBE',
      'DASHEN',
      'MPESA',
      'TELEBIRR',
      'ZEMEN',
    ]);
    // Every bank the OCR pipeline can name finds its engine.
    for (const [text, expectedCode] of [
      ['CBE transfer FT26195DBK5W81465291', 'CBE'],
      ['Telebirr DEV230123HH', 'TELEBIRR'],
      ['Awash payment ref 2KEX10DJ7F575JQI', 'AWASH'],
      ['Dashen receipt DSH9021018AB34', 'DASHEN'],
      ['Bank of Abyssinia FT26201XYZ77', 'ABYSSINIA'],
      ['M-Pesa MPX1234ABC', 'MPESA'],
      ['Zemen 108IBET252931385', 'ZEMEN'],
    ] as const) {
      const best = registry.detectBest(text);
      expect(best?.adapter.bankCode).toBe(expectedCode);
    }
  });
});
