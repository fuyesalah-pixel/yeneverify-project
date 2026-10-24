// ============================================================
// Yene Verify — Awash Receipt Parser Unit Tests
//
// Exercises the parser against realistic sanitized fixtures —
// both Awash label-variant layouts — plus malformed input.
// No HTTP, no DB.
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseAwashReceipt } from './awash.parser';

const successHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-success.html'), 'utf8');
const successAltLabelsHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-success-alt-labels.html'), 'utf8');
const notFoundHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-not-found.html'), 'utf8');

const expected = {
  reference: '2KEX10DJ7F-575JQI',
  amountMinor: 35000n,
  senderName: 'Abebe Kebede',
  receiverName: 'Selam Coffee',
  // 16/07/2026 1:40 PM in Africa/Addis_Ababa (UTC+3)
  paidAtIso: '2026-07-16T10:40:00.000Z',
};

describe('parseAwashReceipt (unit)', () => {
  it('extracts every field from the success fixture (older label set)', () => {
    const parsed = parseAwashReceipt(successHtml());

    expect(parsed.found).toBe(true);
    expect(parsed.reference).toBe(expected.reference);
    expect(parsed.amountMinor).toBe(expected.amountMinor); // bigint
    expect(parsed.currency).toBe('ETB');
    expect(parsed.senderName).toBe(expected.senderName);
    expect(parsed.receiverName).toBe(expected.receiverName);
    expect(parsed.paidAt!.toISOString()).toBe(expected.paidAtIso);
  });

  it('handles the newer label-variant layout identically', () => {
    const parsed = parseAwashReceipt(successAltLabelsHtml());

    expect(parsed.found).toBe(true);
    expect(parsed.reference).toBe(expected.reference);
    expect(parsed.amountMinor).toBe(expected.amountMinor);
    expect(parsed.senderName).toBe(expected.senderName);
    expect(parsed.receiverName).toBe(expected.receiverName);
    expect(parsed.paidAt!.toISOString()).toBe(expected.paidAtIso);
  });

  it('reports the not-found fixture as not found', () => {
    const parsed = parseAwashReceipt(notFoundHtml());

    expect(parsed.found).toBe(false);
    expect(parsed.amountMinor).toBeNull();
  });

  it('returns found:false and never throws on malformed HTML', () => {
    const inputs = ['', '<html><body>broken', '<table><tr><td>orphan</tr></table>', 'plain text'];
    for (const html of inputs) {
      const parsed = parseAwashReceipt(html);
      expect(parsed.found).toBe(false);
    }
  });

  it('recognizes each not-found phrasing', () => {
    expect(parseAwashReceipt('<p>Receipt not found</p>').found).toBe(false);
    expect(parseAwashReceipt('<p>No record</p>').found).toBe(false);
    expect(parseAwashReceipt('<p>This transaction does not exist</p>').found).toBe(false);
  });

  it('treats resolved-but-fieldless HTML as found with empty fields', () => {
    const html = `
      <table>
        <tr><th>Transaction ID</th><td>2KEX10DJ7F-575JQI</td></tr>
      </table>`;
    const parsed = parseAwashReceipt(html);

    expect(parsed.found).toBe(true);
    expect(parsed.amountMinor).toBeNull();
    expect(parsed.senderName).toBe('');
  });
});
