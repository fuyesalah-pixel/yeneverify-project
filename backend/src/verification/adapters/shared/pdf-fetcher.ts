// ============================================================
// Yene Verify — Shared PDF Fetcher
//
// Both PDF banks (M-Pesa: JSON { pdfBase64 } wrapper; Zemen: raw
// stream) go through this utility so they can share exactly one
// implementation of the content sniffing, the size cap and the
// never-log-PDF-bytes rule. Error details are always metadata-only
// (sizes, statuses, shape) — PDF bytes and extracted text never
// reach logs or error messages.
// ============================================================

import { HttpService } from '@nestjs/axios';
import type { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { extractText } from '../../parsers/pdf.parser';

/** Bank PDFs are <500KB in practice; anything bigger is an attack or a bug. */
export const PDF_MAX_BYTES = 5 * 1024 * 1024;

export type FetchPdfSuccess = {
  ok: true;
  pdf: Buffer;
  contentType: string;
};

export type FetchPdfFailure = {
  ok: false;
  reason: 'transport' | 'invalid-response' | 'too-large';
  details: string;
};

export type FetchPdfResult = FetchPdfSuccess | FetchPdfFailure;

export interface FetchPdfOptions {
  timeoutMs: number;
  userAgent: string;
  maxBytes?: number;
}

const PDF_MAGIC = '%PDF';

function contentTypeOf(response: AxiosResponse): string {
  const header = (response.headers as Record<string, unknown> | undefined)?.['content-type'];
  return typeof header === 'string' ? header.toLowerCase() : '';
}

function toBuffer(data: unknown): Buffer {
  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }
  if (typeof data === 'string') {
    return Buffer.from(data, 'latin1');
  }
  return Buffer.from(new Uint8Array(0));
}

const failure = (reason: FetchPdfFailure['reason'], details: string): FetchPdfFailure => ({
  ok: false,
  reason,
  details,
});

/**
 * Fetch a receipt URL and return PDF bytes. Handles raw PDF streams
 * and JSON { pdfBase64 } wrappers. Never throws; never logs content.
 */
export async function fetchPdf(
  http: Pick<HttpService, 'get'>,
  url: string,
  opts: FetchPdfOptions,
): Promise<FetchPdfResult> {
  const maxBytes = opts.maxBytes ?? PDF_MAX_BYTES;
  let response: AxiosResponse;
  try {
    response = await firstValueFrom(
      http.get<ArrayBuffer>(url, {
        timeout: opts.timeoutMs,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': opts.userAgent,
          Accept: 'application/pdf, application/json',
        },
        // Body-qualified endpoints: the checks below classify the shape.
        validateStatus: () => true,
      }),
    );
  } catch (err) {
    return failure('transport', err instanceof Error ? err.message : 'unknown transport error');
  }

  const contentType = contentTypeOf(response);
  let body: Buffer;
  try {
    body = toBuffer(response.data);
  } catch {
    return failure('invalid-response', 'response body could not be captured as bytes');
  }

  if (body.length === 0) {
    return failure('invalid-response', `empty response body (HTTP ${response.status})`);
  }

  // Cap BEFORE decoding anything: a 100MB base64 string would inflate
  // to 75MB of bytes just by parsing it.
  const jsonFamily = contentType.includes('application/json');
  if (jsonFamily || (contentType === '' && body.length <= 1024 * 1024 && looksJson(body))) {
    if (body.length > Math.ceil(maxBytes * 1.5)) {
      return failure(
        'too-large',
        `JSON body of ${body.length} bytes exceeds the ${maxBytes}-byte cap`,
      );
    }
    return fromJson(body, maxBytes);
  }

  const isPdfFamily = contentType.includes('application/pdf');
  if (!isPdfFamily && contentType !== '') {
    // HTML error pages, octet-stream garbage, tarballs — none of these
    // are a receipt. Misconfigured endpoint, not a verdict.
    return failure(
      'invalid-response',
      `content-type "${contentType}" cannot carry a receipt PDF (HTTP ${response.status})`,
    );
  }

  if (body.length > maxBytes) {
    return failure('too-large', `PDF of ${body.length} bytes exceeds the ${maxBytes}-byte cap`);
  }
  if (!bodySubstr(body).startsWith(PDF_MAGIC)) {
    return failure(
      'invalid-response',
      `"application/pdf"-shaped body does not begin with %PDF (HTTP ${response.status})`,
    );
  }
  return { ok: true, pdf: body, contentType };
}

function bodySubstr(body: Buffer): string {
  return body.toString('latin1', 0, Math.min(body.length, 8));
}

function looksJson(body: Buffer): boolean {
  const head = body.toString('utf8', 0, Math.min(body.length, 64)).trimStart();
  return head.startsWith('{');
}

function fromJson(body: Buffer, maxBytes: number): FetchPdfResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString('utf8'));
  } catch {
    return failure('invalid-response', 'JSON-shaped body is not parseable as JSON');
  }

  const pdfBase64 =
    typeof parsed === 'object' && parsed !== null && 'pdfBase64' in parsed
      ? (parsed as { pdfBase64?: unknown }).pdfBase64
      : undefined;

  if (typeof pdfBase64 !== 'string' || pdfBase64.trim() === '') {
    return failure('invalid-response', 'JSON response carries no pdfBase64 field');
  }

  const pdf = Buffer.from(pdfBase64, 'base64');
  if (pdf.length > maxBytes) {
    return failure(
      'too-large',
      `decoded PDF of ${pdf.length} bytes exceeds the ${maxBytes}-byte cap`,
    );
  }
  if (!pdf.toString('latin1', 0, 4).startsWith(PDF_MAGIC)) {
    return failure('invalid-response', 'base64 payload does not begin with %PDF — malformed');
  }
  return { ok: true, pdf, contentType: 'application/json+pdf' };
}

/**
 * PDF-buffer → extracted text via the shared pdf.parser.ts (the
 * Uint8Array bridge for pdf.js lives there). Thin alias so adapter
 * code never imports the parser directly.
 */
export async function extractPdfText(pdf: Buffer): Promise<string> {
  return extractText(pdf);
}
