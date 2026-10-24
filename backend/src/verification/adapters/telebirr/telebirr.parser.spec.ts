// ============================================================
// Yene Verify — Telebirr Receipt Parser Unit Tests
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseTelebirrReceipt } from './telebirr.parser';

const successHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-success.html'), 'utf8');
const notFoundHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-not-found.html'), 'utf8');

describe('parseTelebirrReceipt (unit)', () => {
  it('extracts every field from the success fixture, amount as bigint', () => {
    const parsed = parseTelebirrReceipt(successHtml());

    expect(parsed.found).toBe(true);
    expect(parsed.reference).toBe('DEV230123HH');
    expect(parsed.amountMinor).toBe(230000n); // bigint, not number
    expect(parsed.currency).toBe('ETB');
    expect(parsed.senderName).toBe('Abebe Kebede');
    expect(parsed.receiverName).toBe('Selam Coffee');
    // Fixture date is ISO-naive → parsed as UTC instant.
    expect(parsed.paidAt!.toISOString()).toBe('2026-07-14T11:08:00.000Z');
  });

  it('reports the invalid-receipt fixture as not found', () => {
    const parsed = parseTelebirrReceipt(notFoundHtml());

    expect(parsed.found).toBe(false);
    expect(parsed.amountMinor).toBeNull();
  });

  it('returns found:false and never throws on malformed HTML', () => {
    const inputs = ['', '<html><body>broken', '<table><tr><td>orphan</tr></table>', 'plain text'];
    for (const html of inputs) {
      const parsed = parseTelebirrReceipt(html);
      expect(parsed.found).toBe(false);
    }
  });
});
