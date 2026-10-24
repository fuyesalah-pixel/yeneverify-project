// ============================================================
// Yene Verify — Dashen Receipt Parser Unit Tests
//
// Realistic sanitized fixtures for the three page classes the
// multi-endpoint adapter must tell apart. No HTTP, no DB.
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseDashenReceipt } from './dashen.parser';

const successHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-success.html'), 'utf8');
const notFoundHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-not-found.html'), 'utf8');
const endpointDownHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-endpoint-down.html'), 'utf8');

describe('parseDashenReceipt (unit)', () => {
  it('extracts every field from the success fixture, amount as bigint', () => {
    const parsed = parseDashenReceipt(successHtml());

    expect(parsed.found).toBe(true);
    expect(parsed.notFound).toBe(false);
    expect(parsed.reference).toBe('DSH9021018AB34');
    expect(parsed.amountMinor).toBe(175000n); // bigint
    expect(parsed.currency).toBe('ETB');
    expect(parsed.senderName).toBe('Abebe Kebede');
    expect(parsed.receiverName).toBe('Selam Coffee');
    // 16/07/2026 3:12 PM in Africa/Addis_Ababa (UTC+3)
    expect(parsed.paidAt!.toISOString()).toBe('2026-07-16T12:12:00.000Z');
  });

  it('reports the not-found fixture as a definitive no-record page', () => {
    const parsed = parseDashenReceipt(notFoundHtml());

    expect(parsed.found).toBe(false);
    expect(parsed.notFound).toBe(true);
    expect(parsed.amountMinor).toBeNull();
  });

  it('reports every definitive phrasing as notFound', () => {
    expect(parseDashenReceipt('<p>Receipt not found</p>').notFound).toBe(true);
    expect(parseDashenReceipt('<p>No record</p>').notFound).toBe(true);
    expect(parseDashenReceipt('<p>This reference does not exist</p>').notFound).toBe(true);
    expect(parseDashenReceipt('<p>Receipt not available</p>').notFound).toBe(true);
    expect(parseDashenReceipt('<p>Invalid receipt reference</p>').notFound).toBe(true);
  });

  it('classifies the endpoint-down 500 page as ambiguous, never as a verdict', () => {
    const parsed = parseDashenReceipt(endpointDownHtml());

    expect(parsed.found).toBe(false);
    expect(parsed.notFound).toBe(false); // the caller retries / tries another endpoint
  });

  it('returns found:false and never throws on malformed HTML', () => {
    const inputs = ['', '<html><body>broken', '<table><tr><td>orphan</tr></table>', 'plain text'];
    for (const html of inputs) {
      const parsed = parseDashenReceipt(html);
      expect(parsed.found).toBe(false);
      expect(parsed.notFound).toBe(false);
    }
  });

  it('treats resolved-but-fieldless HTML as found with empty fields', () => {
    const html = `
      <table>
        <tr><th>Reference</th><td>DSH9021018AB34</td></tr>
      </table>`;
    const parsed = parseDashenReceipt(html);

    expect(parsed.found).toBe(true);
    expect(parsed.amountMinor).toBeNull();
    expect(parsed.senderName).toBe('');
  });
});
