// ============================================================
// Yene Verify — CBE new-system QR path
//
// Unit coverage for the mbreciept QR route:
//
//   https://mbreciept.cbe.com.et/{SHORT_ID}
//     → GET mb.cbe.com.et .../transaction-detail/{SHORT_ID}
//     → VERIFIED (no account digits, no PDF)
//
// The old BranchReceipt endpoint must remain the fallback for
// scans that carry an FT reference instead of a new-system URL.
// All HTTP is mocked.
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { of, throwError } from 'rxjs';
import type { AxiosResponse } from 'axios';
import { CbeAdapter } from '../../src/verification/adapters/cbe/cbe.adapter';
import {
  CbeNewClient,
  CBE_NEW_HEADERS,
  type CbeNewReceipt,
} from '../../src/verification/adapters/cbe/cbe-new.client';
import {
  parseCbeNewDate,
  parseCbeNewReceipt,
} from '../../src/verification/adapters/cbe/cbe-new.parser';
import { extractCbeNewShortId } from '../../src/verification/qr/cbe-receipt-url';
import type { VerifyInput, VerifyResult } from '../../src/verification/adapters/adapter.interface';

const REFERENCE = 'FT26195DBK5W81465291';
const LAST8 = '12345678';
const SHORT_ID = 'AbC123XyZ';
const QR_URL = `https://mbreciept.cbe.com.et/${SHORT_ID}`;

const bankAdapters = {
  timeoutMs: 500,
  retries: 0,
  userAgent: 'yene-verify-test/1.0',
  mock: false,
};

function successHtml(): string {
  return readFileSync(
    resolve(__dirname, '../../src/verification/adapters/cbe/__fixtures__/receipt-success.html'),
    'utf8',
  );
}

const htmlResponse = (html: string): AxiosResponse<string> =>
  ({
    data: html,
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'text/html; charset=utf-8' },
  }) as AxiosResponse<string>;

const httpError = (status: number): unknown =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status },
  });

class FakeNewClient {
  readonly calls: string[] = [];
  constructor(private readonly impl: (shortId: string) => Promise<CbeNewReceipt>) {}
  fetchReceipt(shortId: string): Promise<CbeNewReceipt> {
    this.calls.push(shortId);
    return this.impl(shortId);
  }
}

function makeAdapter(
  http: { get: jest.Mock; head: jest.Mock },
  newClient: FakeNewClient,
): CbeAdapter {
  return new CbeAdapter(http as never, { bankAdapters } as never, newClient as never);
}

const oldSystemHttp = (html = successHtml()) => ({
  get: jest.fn((..._args: unknown[]) => of(htmlResponse(html))),
  head: jest.fn(),
});

const jsonReceipt = (overrides: Partial<CbeNewReceipt> = {}): CbeNewReceipt => ({
  id: REFERENCE,
  debitAccountHolder: 'Selam Coffee',
  creditAccountHolder: 'Abebe Trading',
  amountCredited: '1250.50',
  creditCurrency: 'ETB',
  dateTimes: ['Thu 2026-10-01 09:30:00 EAT (UTC+03:00)'],
  ...overrides,
});

const baseInput = (supplementary: Record<string, string>): VerifyInput => ({
  reference: REFERENCE,
  referenceNormalized: REFERENCE,
  supplementary,
  rawOcrText: 'CBE transfer FT26195DBK5W81465291 for Selam Coffee',
  merchantId: 'merchant-1',
  requestId: 'req-cbe-new',
});

const successOf = (result: VerifyResult) => {
  if (result.status !== 'VERIFIED') throw new Error(`expected VERIFIED, got ${result.status}`);
  return result;
};

describe('extractCbeNewShortId', () => {
  it('accepts the CBE new-system host and returns the last segment', () => {
    expect(extractCbeNewShortId(QR_URL)).toBe(SHORT_ID);
  });

  it('ignores query strings and fragments', () => {
    expect(extractCbeNewShortId(`${QR_URL}?lang=en#top`)).toBe(SHORT_ID);
  });

  it('rejects a lookalike host', () => {
    expect(extractCbeNewShortId('https://mbreciept.cbe.com.et.evil.test/AbC123XyZ')).toBeNull();
  });

  it('rejects userinfo that mimics the host', () => {
    expect(extractCbeNewShortId('https://mbreciept.cbe.com.et@evil.test/AbC123XyZ')).toBeNull();
  });

  it('rejects a URL without a path segment', () => {
    expect(extractCbeNewShortId('https://mbreciept.cbe.com.et/')).toBeNull();
  });

  it('rejects non-http schemes and non-URLs', () => {
    expect(extractCbeNewShortId('ftp://mbreciept.cbe.com.et/AbC123XyZ')).toBeNull();
    expect(extractCbeNewShortId('mbreciept.cbe.com.et/AbC123XyZ')).toBeNull();
  });

  it('rejects locators with unsafe characters', () => {
    expect(extractCbeNewShortId('https://mbreciept.cbe.com.et/short%20id')).toBeNull();
  });
});

describe('CbeNewClient', () => {
  it('calls the public transaction-detail endpoint with CBE headers', async () => {
    const get = jest.fn((_url: string, _options?: { headers: unknown; timeout: number }) =>
      of({ data: jsonReceipt() }),
    );
    const client = new CbeNewClient({ get } as never);

    const receipt = await client.fetchReceipt(SHORT_ID);

    expect(receipt.id).toBe(REFERENCE);
    expect(get).toHaveBeenCalledTimes(1);
    const [url, options] = get.mock.calls[0];
    expect(url).toBe(
      `https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/${SHORT_ID}`,
    );
    expect(options?.headers).toEqual(CBE_NEW_HEADERS);
    expect(options?.timeout).toBe(5000);
  });
});

describe('parseCbeNewReceipt', () => {
  it('maps every field the verdict needs', () => {
    const parsed = parseCbeNewReceipt(jsonReceipt());

    expect(parsed.reference).toBe(REFERENCE);
    expect(parsed.senderName).toBe('Selam Coffee');
    expect(parsed.receiverName).toBe('Abebe Trading');
    expect(parsed.amountMinor).toBe(125050n);
    expect(parsed.paidAt?.toISOString()).toBe('2026-10-01T06:30:00.000Z');
    expect(parsed.missing).toEqual([]);
  });

  it('reports missing fields instead of throwing', () => {
    const parsed = parseCbeNewReceipt({ id: REFERENCE });

    expect(parsed.missing).toEqual(['amount', 'sender', 'receiver', 'date']);
  });

  it('rejects a non-ETB receipt', () => {
    const parsed = parseCbeNewReceipt(jsonReceipt({ creditCurrency: 'USD' }));

    expect(parsed.missing).toContain('currency');
  });

  it('parses the EAT wall-clock date as UTC+03:00', () => {
    expect(parseCbeNewDate('Thu 2026-10-01  EAT (UTC+03:00)')?.toISOString()).toBe(
      '2026-09-30T21:00:00.000Z',
    );
    expect(parseCbeNewDate('not a date')).toBeNull();
  });
});

describe('CbeAdapter — new-system QR route', () => {
  it('QR URL → JSON → VERIFIED without touching the old endpoint', async () => {
    const http = oldSystemHttp();
    const client = new FakeNewClient(async () => jsonReceipt());
    const adapter = makeAdapter(http, client);

    const result = await adapter.verify(baseInput({ qrUrl: QR_URL, last8: LAST8 }));

    const verified = successOf(result);
    expect(client.calls).toEqual([SHORT_ID]);
    expect(http.get).not.toHaveBeenCalled();
    expect(verified.metadata?.source).toBe('cbe-new-json');
  });

  it('maps the JSON fields onto the verified receipt', async () => {
    const adapter = makeAdapter(oldSystemHttp(), new FakeNewClient(async () => jsonReceipt()));

    const verified = successOf(await adapter.verify(baseInput({ qrUrl: QR_URL })));

    expect(verified.bankReference).toBe(REFERENCE);
    expect(verified.senderName).toBe('Selam Coffee');
    expect(verified.receiverName).toBe('Abebe Trading');
    expect(verified.amountMinor).toBe(125050n);
    expect(verified.currency).toBe('ETB');
    expect(verified.paidAt?.toISOString()).toBe('2026-10-01T06:30:00.000Z');
  });

  it('needs no account digits on the new-system route', async () => {
    const adapter = makeAdapter(oldSystemHttp(), new FakeNewClient(async () => jsonReceipt()));

    const verified = successOf(await adapter.verify(baseInput({ qrUrl: QR_URL })));

    expect(verified.status).toBe('VERIFIED');
  });

  it('API 500 → falls back to the old system for an FT reference', async () => {
    const http = oldSystemHttp();
    const client = new FakeNewClient(async () => {
      throw httpError(500);
    });
    const adapter = makeAdapter(http, client);

    const verified = successOf(await adapter.verify(baseInput({ qrUrl: QR_URL, last8: LAST8 })));

    expect(client.calls).toEqual([SHORT_ID]);
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(String(http.get.mock.calls[0][0])).toContain(REFERENCE);
    expect(verified.metadata?.source).toBe('cbe-html');
  });

  it('API 500 with a short-ID-only reference → retryable ERROR, no old call', async () => {
    const http = oldSystemHttp();
    const client = new FakeNewClient(async () => {
      throw httpError(500);
    });
    const adapter = makeAdapter(http, client);

    const result = await adapter.verify({
      reference: SHORT_ID,
      referenceNormalized: SHORT_ID.toUpperCase(),
      supplementary: { qrUrl: QR_URL },
      rawOcrText: '',
      merchantId: 'merchant-1',
      requestId: 'req-cbe-new',
    });

    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') throw new Error('expected ERROR');
    expect(result.retryable).toBe(true);
    expect(result.metadata?.source).toBe('cbe-new-json');
    expect(http.get).not.toHaveBeenCalled();
  });

  it('API 404 → FAKE, definitive', async () => {
    const http = oldSystemHttp();
    const client = new FakeNewClient(async () => {
      throw httpError(404);
    });
    const adapter = makeAdapter(http, client);

    const result = await adapter.verify(baseInput({ qrUrl: QR_URL, last8: LAST8 }));

    expect(result.status).toBe('FAKE');
    if (result.status !== 'FAKE') throw new Error('expected FAKE');
    expect(result.retryable).toBe(false);
    expect(result.metadata?.source).toBe('cbe-new-json');
    expect(http.get).not.toHaveBeenCalled();
  });

  it('incomplete JSON → deterministic ERROR, not a verdict', async () => {
    const adapter = makeAdapter(
      oldSystemHttp(),
      new FakeNewClient(async () => ({ id: REFERENCE })),
    );

    const result = await adapter.verify(baseInput({ qrUrl: QR_URL, last8: LAST8 }));

    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') throw new Error('expected ERROR');
    expect(result.retryable).toBe(false);
    expect(result.metadata?.missing).toEqual(['amount', 'sender', 'receiver', 'date']);
  });

  it('no QR at all → old system, new client never called', async () => {
    const http = oldSystemHttp();
    const client = new FakeNewClient(async () => jsonReceipt());
    const adapter = makeAdapter(http, client);

    const verified = successOf(await adapter.verify(baseInput({ last8: LAST8 })));

    expect(client.calls).toEqual([]);
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(verified.metadata?.source).toBe('cbe-html');
  });

  it('QR carrying only a reference → old system', async () => {
    const http = oldSystemHttp();
    const client = new FakeNewClient(async () => jsonReceipt());
    const adapter = makeAdapter(http, client);

    // resolveQrHints yields a reference but no receipt URL for this.
    const verified = successOf(await adapter.verify(baseInput({ last8: LAST8 })));

    expect(client.calls).toEqual([]);
    expect(verified.metadata?.source).toBe('cbe-html');
  });

  it('a QR URL on a foreign host is ignored', async () => {
    const http = oldSystemHttp();
    const client = new FakeNewClient(async () => jsonReceipt());
    const adapter = makeAdapter(http, client);

    const verified = successOf(
      await adapter.verify(baseInput({ qrUrl: 'https://example.test/AbC123XyZ', last8: LAST8 })),
    );

    expect(client.calls).toEqual([]);
    expect(verified.metadata?.source).toBe('cbe-html');
  });

  it('does not retry a transport failure through the old endpoint twice', async () => {
    const http = {
      get: jest.fn((..._args: unknown[]) => throwError(() => httpError(503))),
      head: jest.fn(),
    };
    const client = new FakeNewClient(async () => {
      throw new Error('socket hang up');
    });
    const adapter = makeAdapter(http, client);

    const result = await adapter.verify(baseInput({ qrUrl: QR_URL, last8: LAST8 }));

    // New system transport failure → old system attempted once,
    // whose 503 is retryable; retries are disabled in this config.
    expect(result.status).toBe('ERROR');
    expect(http.get).toHaveBeenCalledTimes(1);
  });
});
