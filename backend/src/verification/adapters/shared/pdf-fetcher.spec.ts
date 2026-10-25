// ============================================================
// Yene Verify — Shared PDF Fetcher Unit Tests
//
// Covers every fetch shape the two PDF banks rely on: raw PDF,
// JSON { pdfBase64 }, HTML-misconfiguration rejection, the 5MB
// cap (raw and base64), and transport failures. All HTTP mocked.
// ============================================================

import { of, throwError } from 'rxjs';
import type { AxiosResponse } from 'axios';
import { fetchPdf, PDF_MAX_BYTES } from './pdf-fetcher';

const VALID_PDF = Buffer.from('%PDF-1.4 minimal receipt bytes');

type FakeHttp = { get: jest.Mock };
const makeHttp = (): FakeHttp => ({ get: jest.fn() });

const response = (data: unknown, contentType: string, status = 200): AxiosResponse =>
  ({
    data,
    status,
    statusText: 'OK',
    headers: contentType === '' ? {} : { 'content-type': contentType },
  }) as unknown as AxiosResponse;

const opts = { timeoutMs: 250, userAgent: 'yene-verify-test/1.0' };

const fetchOk = (
  result: Awaited<ReturnType<typeof fetchPdf>>,
): Extract<typeof result, { ok: true }> => {
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}: ${result.details}`);
  return result;
};
const fetchFail = (
  result: Awaited<ReturnType<typeof fetchPdf>>,
): Extract<typeof result, { ok: false }> => {
  if (result.ok) throw new Error('expected a failure');
  return result;
};

describe('fetchPdf (unit)', () => {
  it('accepts a raw application/pdf stream', async () => {
    const http = makeHttp();
    http.get.mockReturnValue(of(response(VALID_PDF, 'application/pdf')));

    const ok = fetchOk(await fetchPdf(http as never, 'https://bank.example/receipt/1', opts));

    expect(ok.pdf.toString('latin1')).toBe(VALID_PDF.toString('latin1'));
    expect(ok.contentType).toContain('application/pdf');
    expect(http.get).toHaveBeenCalledWith(
      'https://bank.example/receipt/1',
      expect.objectContaining({ responseType: 'arraybuffer' }),
    );
  });

  it('sniffs a %PDF body when no content-type is present', async () => {
    const http = makeHttp();
    http.get.mockReturnValue(of(response(VALID_PDF, '')));

    const ok = fetchOk(await fetchPdf(http as never, 'https://bank.example/receipt/1', opts));

    expect(ok.pdf.length).toBe(VALID_PDF.length);
  });

  it('decodes a JSON { pdfBase64 } wrapper', async () => {
    const http = makeHttp();
    const wrapped = { pdfBase64: VALID_PDF.toString('base64') };
    http.get.mockReturnValue(
      of(response(Buffer.from(JSON.stringify(wrapped)), 'application/json')),
    );

    const ok = fetchOk(await fetchPdf(http as never, 'https://mpesa.example/api/receipt/1', opts));

    expect(ok.pdf.toString('latin1')).toBe(VALID_PDF.toString('latin1'));
    expect(ok.contentType).toContain('json');
  });

  it('rejects JSON without a pdfBase64 field as invalid-response', async () => {
    const http = makeHttp();
    http.get.mockReturnValue(of(response(Buffer.from('{"error":"nope"}'), 'application/json')));

    const fail = fetchFail(await fetchPdf(http as never, 'https://x/receipt/1', opts));

    expect(fail.reason).toBe('invalid-response');
    expect(fail.details).toContain('pdfBase64');
  });

  it('rejects unparseable JSON as invalid-response', async () => {
    const http = makeHttp();
    http.get.mockReturnValue(of(response(Buffer.from('{not json'), 'application/json')));

    const fail = fetchFail(await fetchPdf(http as never, 'https://x/receipt/1', opts));

    expect(fail.reason).toBe('invalid-response');
  });

  it('rejects base64 that does not begin with %PDF as invalid-response', async () => {
    const http = makeHttp();
    const wrapped = { pdfBase64: Buffer.from('definitely not a pdf').toString('base64') };
    http.get.mockReturnValue(
      of(response(Buffer.from(JSON.stringify(wrapped)), 'application/json')),
    );

    const fail = fetchFail(await fetchPdf(http as never, 'https://x/receipt/1', opts));

    expect(fail.reason).toBe('invalid-response');
    expect(fail.details).toContain('%PDF');
  });

  it('rejects a text/html body (misconfig or bot page) as invalid-response', async () => {
    const http = makeHttp();
    const html = '<html><body><h1>Receipt not found</h1></body></html>';
    http.get.mockReturnValue(of(response(Buffer.from(html), 'text/html')));

    const fail = fetchFail(await fetchPdf(http as never, 'https://x/receipt/1', opts));

    expect(fail.reason).toBe('invalid-response');
    expect(fail.details).toContain('text/html');
  });

  it('rejects a non-PDF content-type even when the body looks like HTML', async () => {
    const http = makeHttp();
    http.get.mockReturnValue(
      of(response(Buffer.from('<h1>garbage</h1>'), 'application/octet-stream')),
    );

    const fail = fetchFail(await fetchPdf(http as never, 'https://x/receipt/1', opts));

    expect(fail.reason).toBe('invalid-response');
  });

  it(`reports too-large for a raw body over ${PDF_MAX_BYTES} bytes`, async () => {
    const http = makeHttp();
    http.get.mockReturnValue(
      of(response(Buffer.alloc(PDF_MAX_BYTES + 1, 0x25), 'application/pdf')),
    );

    const fail = fetchFail(await fetchPdf(http as never, 'https://x/receipt/1', opts));

    expect(fail.reason).toBe('too-large');
    expect(fail.details).toContain('byte cap');
  });

  it('reports too-large for an inflated base64 JSON body before decoding', async () => {
    const http = makeHttp();
    const huge = Buffer.alloc(Math.ceil(PDF_MAX_BYTES * 1.5) + 1, 0x41); // > maxBytes*1.5
    http.get.mockReturnValue(of(response(huge, 'application/json')));

    const fail = fetchFail(await fetchPdf(http as never, 'https://x/receipt/1', opts));

    expect(fail.reason).toBe('too-large');
  });

  it('reports too-large when the DECODED base64 exceeds the cap', async () => {
    const http = makeHttp();
    // 1.2x the cap: passes the body-size guard (≤1.5x), fails after decode.
    const oversized = Buffer.alloc(Math.ceil(PDF_MAX_BYTES * 1.2), 0x25);
    const wrapped = { pdfBase64: oversized.toString('base64') };
    http.get.mockReturnValue(
      of(response(Buffer.from(JSON.stringify(wrapped)), 'application/json')),
    );

    const fail = fetchFail(await fetchPdf(http as never, 'https://x/receipt/1', opts));

    expect(fail.reason).toBe('too-large');
  });

  it('classifies HTTP-level failure as transport without touching the body', async () => {
    const http = makeHttp();
    http.get.mockReturnValue(
      throwError(() => Object.assign(new Error('connect ECONNRESET'), { code: 'ECONNRESET' })),
    );

    const fail = fetchFail(await fetchPdf(http as never, 'https://x/receipt/1', opts));

    expect(fail.reason).toBe('transport');
    expect(fail.details).toContain('ECONNRESET');
  });

  it('reports invalid-response for an empty body rather than guessing', async () => {
    const http = makeHttp();
    http.get.mockReturnValue(of(response(Buffer.alloc(0), 'application/pdf')));

    const fail = fetchFail(await fetchPdf(http as never, 'https://x/receipt/1', opts));

    expect(fail.reason).toBe('invalid-response');
  });
});
