// ============================================================
// Yene Verify — CBE Adapter Unit Tests
//
// All HTTP is mocked — no live calls to CBE. The fake HttpService
// exposes just get()/head() returning rxjs Observables like the
// real one, so firstValueFrom flows stay identical to production.
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Observable, of, throwError } from 'rxjs';
import type { AxiosResponse } from 'axios';
import { CbeAdapter } from './cbe.adapter';
import type {
  VerifyInput,
  VerifyResult,
  VerifyResultFailure,
  VerifyResultSuccess,
} from '../adapter.interface';
import type { AdapterConfigSource } from '../adapter.base';
import { AdapterRegistry } from '../adapter.registry';

function successHtml(): string {
  return readFileSync(resolve(__dirname, '__fixtures__/receipt-success.html'), 'utf8');
}
function notFoundHtml(): string {
  return readFileSync(resolve(__dirname, '__fixtures__/receipt-not-found.html'), 'utf8');
}

const input: VerifyInput = {
  reference: 'FT26195DBK5W81465291',
  referenceNormalized: 'FT26195DBK5W81465291',
  rawOcrText: 'CBE transfer FT26195DBK5W81465291 for Selam Coffee',
  merchantId: 'merchant-1',
  requestId: 'req-cbe-1',
};

const configSource: AdapterConfigSource = {
  bankAdapters: { timeoutMs: 250, retries: 2, userAgent: 'yene-verify-test/1.0', mock: false },
} as never;

type FakeHttp = {
  get: jest.Mock;
  head: jest.Mock;
};

const makeAdapter = (
  http: FakeHttp,
  overrides?: Partial<typeof configSource.bankAdapters>,
): CbeAdapter =>
  new CbeAdapter(
    http as unknown as never,
    { bankAdapters: { ...configSource.bankAdapters, ...overrides } } as never,
  );

const htmlResponse = (html: string): AxiosResponse<string> =>
  ({ data: html, status: 200, statusText: 'OK', headers: {} }) as AxiosResponse<string>;

const axiosError = (extra: Record<string, unknown>): unknown =>
  Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:100'), extra);

const failureOf = (result: VerifyResult): VerifyResultFailure => {
  if (result.status === 'VERIFIED') throw new Error('expected a failure result');
  return result;
};

const successOf = (result: VerifyResult): VerifyResultSuccess => {
  if (result.status !== 'VERIFIED') throw new Error('expected a success result');
  return result;
};

describe('CbeAdapter detect/extract (unit)', () => {
  const adapter = makeAdapter({ get: jest.fn(), head: jest.fn() });

  it('detect() true for OCR text containing "Commercial Bank of Ethiopia"', () => {
    expect(adapter.detect('receipt from commercial bank of ethiopia')).toBe(true);
  });

  it('detect() true for OCR text containing "CBE"', () => {
    expect(adapter.detect('CBE transfer completed')).toBe(true);
  });

  it('detect() false for other banks', () => {
    expect(adapter.detect('Telebirr payment transaction TBR99001122')).toBe(false);
    expect(adapter.detect('M-Pesa receipt QGH4XW7P2L')).toBe(false);
  });

  it('extractReference() finds the FT-prefixed reference', () => {
    expect(adapter.extractReference('FT26195DBK5W81465291 amount 5,500.00')).toBe(
      'FT26195DBK5W81465291',
    );
  });

  // 14.3 Part A: the shared CBE regex is [0-9A-Z] (case-insensitive); a
  // hex-only pattern would truncate at the first G-Z letter. Guards the
  // exact bug class observed on the e2e stub fixture ('TKFAKE…' → 'TK').
  it('extractReference() keeps G-Z letters (no hex-only truncation)', () => {
    expect(adapter.extractReference('FT2XYZ95DBK5W81465291')).toBe('FT2XYZ95DBK5W81465291');
    expect(adapter.extractReference('ft1wvxyztu9876543210')).toBe('FT1WVXYZTU9876543210');
  });

  it('extractReference() returns null when no FT reference exists', () => {
    expect(adapter.extractReference('telebirr TBR99001122')).toBeNull();
  });

  it('extractSupplementary() picks up an account suffix when present', () => {
    expect(adapter.extractSupplementary('Account ending 12345678')).toEqual({
      accountSuffix: '12345678',
    });
    expect(adapter.extractSupplementary('no account data here')).toEqual({});
  });
});

describe('CbeAdapter doVerify (unit)', () => {
  it('VERIFIED on the success fixture with bigint amount', async () => {
    const http = { get: jest.fn(() => of(htmlResponse(successHtml()))), head: jest.fn() };
    const adapter = makeAdapter(http, { retries: 0 });

    const success = successOf(await adapter.verify(input));

    expect(success.bankReference).toBe('FT26195DBK5W81465291');
    expect(success.amountMinor).toBe(550000n); // bigint
    expect(success.currency).toBe('ETB');
    expect(success.senderName).toBe('Abebe Kebede');
    expect(success.receiverName).toBe('Selam Coffee');
    expect(success.paidAt.toISOString()).toBe('2026-07-14T11:08:00.000Z');
    expect(success.metadata.attempts).toBe(1);

    expect(http.get).toHaveBeenCalledWith(
      'https://apps.cbe.com.et:100/?id=FT26195DBK5W81465291',
      expect.objectContaining({
        responseType: 'text',
        headers: expect.objectContaining({ 'User-Agent': 'yene-verify-test/1.0' }),
      }),
    );
  });

  it('FAKE with BANK_REFERENCE_NOT_FOUND on the not-found page — not retried', async () => {
    const http = { get: jest.fn(() => of(htmlResponse(notFoundHtml()))), head: jest.fn() };
    const adapter = makeAdapter(http); // retries: 2

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('FAKE');
    expect(failure.errorCode).toBe('BANK_REFERENCE_NOT_FOUND');
    expect(failure.retryable).toBe(false);
    expect(failure.metadata?.attempts).toBe(1);
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('ERROR retryable=true when HTTP throws ECONNREFUSED', async () => {
    const http = {
      get: jest.fn(() => throwError(() => axiosError({ code: 'ECONNREFUSED' }))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { retries: 0 });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_ERROR');
    expect(failure.retryable).toBe(true);
  });

  it('ERROR retryable=true (TIMEOUT) when HTTP never responds', async () => {
    jest.useFakeTimers();

    // HttpService returns Observables — a never-emitting cold one:
    // firstValueFrom subscribes and simply never yields.
    const http = {
      get: jest.fn((): Observable<never> => new Observable<never>(() => undefined)),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { timeoutMs: 250, retries: 0 });

    const pending = adapter.verify(input);
    await jest.advanceTimersByTimeAsync(1_000);
    const failure = failureOf(await pending);

    expect(failure.status).toBe('ERROR');
    // The base class produced the timeout, not the adapter.
    expect(failure.errorCode).toBe('BANK_ADAPTER_TIMEOUT');
    expect(failure.retryable).toBe(true);

    jest.useRealTimers();
  });

  it('ERROR retryable=false when the receipt resolves but the amount is missing', async () => {
    const missingAmount = `
      <table>
        <tr><th>Transaction Reference</th><td>FT26195DBK5W81465291</td></tr>
        <tr><th>Sender Name</th><td>Abebe Kebede</td></tr>
      </table>`;
    const http = { get: jest.fn(() => of(htmlResponse(missingAmount))), head: jest.fn() };
    const adapter = makeAdapter(http, { retries: 0 });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_ERROR');
    expect(failure.retryable).toBe(false);
    expect(failure.metadata?.missing).toContain('amount');
  });

  it('retries ERROR twice then VERIFIED — attempts=3', async () => {
    jest.useFakeTimers();

    let calls = 0;
    const http = {
      get: jest.fn(() => {
        calls += 1;
        if (calls <= 2) {
          return throwError(() => axiosError({ code: 'ECONNRESET' }));
        }
        return of(htmlResponse(successHtml()));
      }),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http); // retries: 2 → 3 attempts

    const pending = adapter.verify(input);
    // 3 calls + two backoff sleeps (500ms + 1000ms) — advance generously.
    await jest.advanceTimersByTimeAsync(10_000);
    const success = successOf(await pending);

    expect(success.status).toBe('VERIFIED');
    expect(calls).toBe(3);
    expect(success.metadata.attempts).toBe(3);

    jest.useRealTimers();
  });
});

describe('CbeAdapter health (unit)', () => {
  it('true when HEAD resolves', async () => {
    const http = {
      get: jest.fn(),
      head: jest.fn(() => of({ data: null, status: 200 } as AxiosResponse<null>)),
    };
    const adapter = makeAdapter(http);

    expect(await adapter.health()).toBe(true);
  });

  it('false when HEAD rejects', async () => {
    const http = {
      get: jest.fn(),
      head: jest.fn(() => throwError(() => new Error('network down'))),
    };
    const adapter = makeAdapter(http);

    expect(await adapter.health()).toBe(false);
  });
});

describe('CbeAdapter registry integration (unit)', () => {
  it('detectBest() routes CBE-shaped OCR to the CbeAdapter', () => {
    const registry = new AdapterRegistry(makeAdapter({ get: jest.fn(), head: jest.fn() }));

    const best = registry.detectBest('Commercial Bank of Ethiopia receipt FT26195DBK5W81465291');
    expect(best).not.toBeNull();
    expect(best!.adapter).toBeInstanceOf(CbeAdapter);
  });

  it('detectBest() returns null for Telebirr-shaped OCR while no Telebirr adapter exists', () => {
    const registry = new AdapterRegistry(makeAdapter({ get: jest.fn(), head: jest.fn() }));

    expect(registry.detectBest('Telebirr transaction TBR99001122')).toBeNull();
  });
});
