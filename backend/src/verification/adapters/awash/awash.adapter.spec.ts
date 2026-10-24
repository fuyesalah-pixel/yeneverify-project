// ============================================================
// Yene Verify — Awash Adapter Unit Tests
//
// All HTTP is mocked — no live calls to Awash. The fake
// HttpService exposes get()/head() returning rxjs Observables
// like the real one, so firstValueFrom flows stay identical to
// production.
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Observable, of, throwError } from 'rxjs';
import type { AxiosResponse } from 'axios';
import { AwashAdapter } from './awash.adapter';
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
function successAltLabelsHtml(): string {
  return readFileSync(resolve(__dirname, '__fixtures__/receipt-success-alt-labels.html'), 'utf8');
}
function notFoundHtml(): string {
  return readFileSync(resolve(__dirname, '__fixtures__/receipt-not-found.html'), 'utf8');
}

const input: VerifyInput = {
  reference: '2KEX10DJ7F-575JQI',
  referenceNormalized: '2KEX10DJ7F575JQI', // separators stripped by normalizeReference
  rawOcrText: 'Awash Bank transfer 2KEX10DJ7F-575JQI to Selam Coffee',
  merchantId: 'merchant-1',
  requestId: 'req-aw-1',
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
): AwashAdapter =>
  new AwashAdapter(
    http as unknown as never,
    { bankAdapters: { ...configSource.bankAdapters, ...overrides } } as never,
  );

const htmlResponse = (html: string, status = 200): AxiosResponse<string> =>
  ({
    data: html,
    status,
    statusText: status === 200 ? 'OK' : 'Not Found',
    headers: {},
  }) as AxiosResponse<string>;

const axiosError = (extra: Record<string, unknown>): unknown =>
  Object.assign(new Error('connect ETIMEDOUT 196.202.x.x:8225'), extra);

const failureOf = (result: VerifyResult): VerifyResultFailure => {
  if (result.status === 'VERIFIED') throw new Error('expected a failure result');
  return result;
};

const successOf = (result: VerifyResult): VerifyResultSuccess => {
  if (result.status !== 'VERIFIED') throw new Error('expected a success result');
  return result;
};

describe('AwashAdapter detect/extract (unit)', () => {
  const adapter = makeAdapter({ get: jest.fn(), head: jest.fn() });

  it('detect() true for OCR text containing "Awash"', () => {
    expect(adapter.detect('Awash Bank payment received')).toBe(true);
    expect(adapter.detect('awashpay receipt 2KEX10DJ7F575JQI')).toBe(true);
  });

  it('detect() false for CBE and Telebirr', () => {
    expect(adapter.detect('CBE transfer FT26195DBK5W81465291')).toBe(false);
    expect(adapter.detect('Telebirr payment DEV230123HH')).toBe(false);
  });

  it('extractReference() finds an Awash-style reference', () => {
    expect(adapter.extractReference('ref 2KEX10DJ7F-575JQI amount 350.00')).toBe(
      '2KEX10DJ7F575JQI',
    );
  });

  it('extractReference() returns null when no Awash reference exists', () => {
    expect(adapter.extractReference('telebirr TBR99001122')).toBeNull();
    expect(adapter.extractReference('CBE FT26195DBK5W81465291')).toBeNull();
  });
});

describe('AwashAdapter doVerify (unit)', () => {
  it('VERIFIED on the success fixture with bigint amount', async () => {
    const http = { get: jest.fn(() => of(htmlResponse(successHtml()))), head: jest.fn() };
    const adapter = makeAdapter(http, { retries: 0 });

    const success = successOf(await adapter.verify(input));

    expect(success.bankReference).toBe('2KEX10DJ7F-575JQI'); // page's own reference
    expect(success.amountMinor).toBe(35000n); // bigint
    expect(success.currency).toBe('ETB');
    expect(success.senderName).toBe('Abebe Kebede');
    expect(success.receiverName).toBe('Selam Coffee');
    expect(success.paidAt.toISOString()).toBe('2026-07-16T10:40:00.000Z');
    expect(success.metadata.attempts).toBe(1);

    expect(http.get).toHaveBeenCalledWith(
      'https://awashpay.awashbank.com:8225/2KEX10DJ7F575JQI',
      expect.objectContaining({
        responseType: 'text',
        headers: expect.objectContaining({ 'User-Agent': 'yene-verify-test/1.0' }),
      }),
    );
  });

  it('VERIFIED on the newer label-variant layout too', async () => {
    const http = { get: jest.fn(() => of(htmlResponse(successAltLabelsHtml()))), head: jest.fn() };
    const adapter = makeAdapter(http, { retries: 0 });

    const success = successOf(await adapter.verify(input));

    expect(success.amountMinor).toBe(35000n);
    expect(success.senderName).toBe('Abebe Kebede');
    expect(success.receiverName).toBe('Selam Coffee');
  });

  it('FAKE with BANK_REFERENCE_NOT_FOUND on a 404 HTML page — not retried', async () => {
    const http = { get: jest.fn(() => of(htmlResponse(notFoundHtml(), 404))), head: jest.fn() };
    const adapter = makeAdapter(http); // retries: 2

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('FAKE');
    expect(failure.errorCode).toBe('BANK_REFERENCE_NOT_FOUND');
    expect(failure.retryable).toBe(false);
    expect(failure.metadata?.attempts).toBe(1);
    expect(http.get).toHaveBeenCalledTimes(1); // one network journey only
  });

  it('ERROR retryable=true when HTTP throws a network error', async () => {
    const http = {
      get: jest.fn(() => throwError(() => axiosError({ code: 'ETIMEDOUT' }))),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { retries: 0 });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_ERROR');
    expect(failure.retryable).toBe(true);
  });

  it('ERROR retryable=false when the receipt resolves but the amount is missing', async () => {
    const missingAmount = `
      <table>
        <tr><th>Transaction ID</th><td>2KEX10DJ7F-575JQI</td></tr>
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

  it('ERROR retryable=true (TIMEOUT) when HTTP never responds', async () => {
    jest.useFakeTimers();

    // A never-emitting cold Observable: firstValueFrom subscribes and
    // simply never yields — the base class must produce the timeout.
    const http = {
      get: jest.fn((): Observable<never> => new Observable<never>(() => undefined)),
      head: jest.fn(),
    };
    const adapter = makeAdapter(http, { timeoutMs: 250, retries: 0 });

    const pending = adapter.verify(input);
    await jest.advanceTimersByTimeAsync(1_000);
    const failure = failureOf(await pending);

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_TIMEOUT');
    expect(failure.retryable).toBe(true);

    jest.useRealTimers();
  });
});

describe('AwashAdapter health (unit)', () => {
  it('true when HEAD resolves', async () => {
    const http = {
      get: jest.fn(),
      head: jest.fn(() => of({ data: null, status: 200 } as AxiosResponse<null>)),
    };
    const adapter = makeAdapter(http);

    expect(await adapter.health()).toBe(true);
    expect(http.head).toHaveBeenCalledWith(
      'https://awashpay.awashbank.com:8225/',
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
});

describe('AwashAdapter registry integration (unit)', () => {
  it('detectBest() routes Awash-shaped OCR to the AwashAdapter', () => {
    const registry = new AdapterRegistry(makeAdapter({ get: jest.fn(), head: jest.fn() }));

    const best = registry.detectBest('Awash Bank SMS 2KEX10DJ7F-575JQI transferred 350.00');
    expect(best).not.toBeNull();
    expect(best!.adapter).toBeInstanceOf(AwashAdapter);
  });
});
