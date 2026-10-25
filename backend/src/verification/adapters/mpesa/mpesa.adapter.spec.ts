// ============================================================
// Yene Verify — M-Pesa Adapter Unit Tests
//
// Covers the two API shapes (raw PDF and JSON { pdfBase64 }),
// the three-state classification on PDF text, the misconfigured
// HTML-not-found page (retryable, NOT a verdict), the size cap,
// and the PII rule: receipt bytes/text never reach any log.
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { of, throwError } from 'rxjs';
import type { AxiosResponse } from 'axios';
import { Logger } from '@nestjs/common';
import { MpesaAdapter } from './mpesa.adapter';
import type {
  VerifyInput,
  VerifyResult,
  VerifyResultFailure,
  VerifyResultSuccess,
} from '../adapter.interface';
import { AdapterRegistry } from '../adapter.registry';
import { PDF_MAX_BYTES } from '../shared/pdf-fetcher';

const successPdf = () => readFileSync(resolve(__dirname, 'fixtures/receipt-success.pdf'));
const successJson = () => readFileSync(resolve(__dirname, 'fixtures/receipt-success.json'), 'utf8');
const notFoundPdf = () => readFileSync(resolve(__dirname, 'fixtures/receipt-not-found.pdf'));
const mismatchPdf = () => readFileSync(resolve(__dirname, 'fixtures/receipt-mismatch.pdf'));
const notFoundHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-not-found.html'), 'utf8');

const input: VerifyInput = {
  reference: 'MPX1234ABC',
  referenceNormalized: 'MPX1234ABC',
  rawOcrText: 'M-Pesa payment MPX1234ABC',
  merchantId: 'merchant-1',
  requestId: 'req-mp-1',
};

const baseConfig = {
  bankAdapters: { timeoutMs: 250, retries: 2, userAgent: 'yene-verify-test/1.0', mock: false },
  mpesa: {
    endpoints: ['https://mpesa-api.example.com/receipt', 'https://mpesa-b.example.com'],
  },
};

type FakeHttp = { get: jest.Mock; head: jest.Mock };

const makeAdapter = (
  http: FakeHttp,
  overrides?: {
    bankAdapters?: Partial<typeof baseConfig.bankAdapters>;
    mpesa?: Partial<typeof baseConfig.mpesa>;
  },
): MpesaAdapter =>
  new MpesaAdapter(
    http as unknown as never,
    {
      bankAdapters: { ...baseConfig.bankAdapters, ...overrides?.bankAdapters },
      mpesa: { ...baseConfig.mpesa, ...overrides?.mpesa },
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

describe('MpesaAdapter detect/extract (unit)', () => {
  const adapter = makeAdapter({ get: jest.fn(), head: jest.fn() });

  it('detect() true for M-Pesa and Safaricom spellings', () => {
    expect(adapter.detect('M-Pesa payment to Selam Coffee')).toBe(true);
    expect(adapter.detect('M PESA receipt')).toBe(true);
    expect(adapter.detect('safaricom transaction')).toBe(true);
  });

  it('detect() false for other banks', () => {
    expect(adapter.detect('CBE transfer FT26195DBK5W81465291')).toBe(false);
    expect(adapter.detect('Telebirr DEV230123HH')).toBe(false);
    expect(adapter.detect('Zemen receipt 108IBET252931385')).toBe(false);
  });

  it('extractReference() extracts the 10-char uppercase reference', () => {
    expect(adapter.extractReference('M-Pesa MPX1234ABC completed')).toBe('MPX1234ABC');
    expect(adapter.extractReference('ref QGH4XW7P2L M-Pesa')).toBe('QGH4XW7P2L');
  });

  it('extractReference() returns null without any 10-char run', () => {
    expect(adapter.extractReference('telebirr TBR99001122')).toBeNull();
    expect(adapter.extractReference('dashen DSH9021018AB34')).toBeNull();
  });
});

describe('MpesaAdapter doVerify (unit)', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype as unknown as { log: jest.Mock }, 'log');
  });
  afterEach(() => logSpy.mockRestore());

  it('VERIFIED from the raw-PDF endpoint', async () => {
    const http = {
      get: jest.fn(() => of(bufferResponse(successPdf(), 'application/pdf'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const success = successOf(await adapter.verify(input));

    expect(success.bankReference).toBe('MPX1234ABC');
    expect(success.amountMinor).toBe(25000n); // bigint
    expect(success.currency).toBe('ETB');
    expect(success.senderName).toBe('Yonas Alemu');
    expect(success.receiverName).toBe('Selam Coffee');
    // 14/07/2026 2:08 PM in Africa/Addis_Ababa (UTC+3)
    expect(success.paidAt.toISOString()).toBe('2026-07-14T11:08:00.000Z');
    expect(success.metadata.source).toBe('mpesa-pdf');
    expect(success.metadata.endpoint).toBe('https://mpesa-api.example.com/receipt');
    expect(success.metadata.attempts).toBe(1);
    expect(http.get).toHaveBeenCalledWith(
      'https://mpesa-api.example.com/receipt/MPX1234ABC',
      expect.objectContaining({ responseType: 'arraybuffer' }),
    );
  });

  it('VERIFIED from the JSON { pdfBase64 } wrapper endpoint', async () => {
    const http = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(bufferResponse(notFoundPdf(), 'application/pdf')))
        .mockReturnValueOnce(of(bufferResponse(successJson(), 'application/json'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { bankAdapters: { retries: 0 } });

    const success = successOf(await adapter.verify(input));

    expect(success.amountMinor).toBe(25000n);
    expect(success.senderName).toBe('Yonas Alemu');
    expect(success.metadata.endpoint).toBe('https://mpesa-b.example.com');
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.get).toHaveBeenLastCalledWith(
      'https://mpesa-b.example.com/MPX1234ABC',
      expect.anything(),
    );
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

  it('FAKE with reason "reference-mismatch" when the PDF carries a different transaction ID', async () => {
    // Real PDF bytes: a receipt for a DIFFERENT transaction than queried.
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

    // An HTML shell on a PDF URL is a misconfig, not a verdict.
    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_UNAVAILABLE');
    expect(failure.retryable).toBe(true);
    expect(JSON.stringify(failure.metadata?.errors)).toContain('invalid-response');
  });

  it('ERROR retryable=true when any endpoint body exceeds the 5MB cap', async () => {
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
      get: jest.fn(() => throwError(() => axiosError('connect ECONNRESET'))),
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
    const adapter = makeAdapter(http, { mpesa: { endpoints: [] } });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.retryable).toBe(true);
    expect(http.get).not.toHaveBeenCalled();
  });

  it('FAKE beats a transport failure on the other endpoint (anti-DoS rule)', async () => {
    const http = {
      get: jest
        .fn()
        .mockReturnValueOnce(throwError(() => axiosError('connect ETIMEDOUT')))
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
    expect(logged).not.toContain('Yonas Alemu');
    expect(logged).not.toContain('25000');
  });
});

describe('MpesaAdapter health (unit)', () => {
  it('true when the endpoint answers with a PDF', async () => {
    const http = {
      get: jest.fn(() => of(bufferResponse(successPdf(), 'application/pdf'))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http);

    expect(await adapter.health()).toBe(true);
  });

  it('true on a shaped error answer from a reachable endpoint', async () => {
    const http = {
      get: jest.fn(() => of(bufferResponse(notFoundHtml(), 'text/html'))),
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
    const adapter = makeAdapter(http, { mpesa: { endpoints: [] } });

    expect(await adapter.health()).toBe(false);
    expect(http.get).not.toHaveBeenCalled();
  });
});

describe('MpesaAdapter registry integration (unit)', () => {
  it('detectBest() routes M-Pesa-shaped OCR to the MpesaAdapter', () => {
    const registry = new AdapterRegistry(makeAdapter({ get: jest.fn(), head: jest.fn() }));

    const best = registry.detectBest('M-Pesa receipt MPX1234ABC 250.00 ETB');
    expect(best).not.toBeNull();
    expect(best!.adapter).toBeInstanceOf(MpesaAdapter);
  });
});
