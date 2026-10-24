// ============================================================
// Yene Verify — CBE Receipt Parser Unit Tests
//
// Exercises the real parsers against realistic sanitized fixtures
// plus adversarial amount/date/format variants. No HTTP, no DB.
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { amountToMinor, parseCbeDate, parseCbeReceipt } from './cbe.parser';

const successHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-success.html'), 'utf8');
const notFoundHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-not-found.html'), 'utf8');

describe('parseCbeReceipt (unit)', () => {
  it('extracts every field from the success fixture, amount as bigint', () => {
    const parsed = parseCbeReceipt(successHtml());

    expect(parsed.found).toBe(true);
    expect(parsed.reference).toBe('FT26195DBK5W81465291');
    expect(parsed.amountMinor).toBe(550000n); // bigint, not number
    expect(parsed.currency).toBe('ETB');
    expect(parsed.senderName).toBe('Abebe Kebede');
    expect(parsed.receiverName).toBe('Selam Coffee');
    // 14/07/2026 2:08 PM in Africa/Addis_Ababa (UTC+3)
    expect(parsed.paidAt).not.toBeNull();
    expect(parsed.paidAt!.toISOString()).toBe('2026-07-14T11:08:00.000Z');
  });

  it('reports the not-found fixture as not found', () => {
    const parsed = parseCbeReceipt(notFoundHtml());

    expect(parsed.found).toBe(false);
    expect(parsed.amountMinor).toBeNull();
  });

  it('returns found:false and never throws on malformed HTML', () => {
    const inputs = ['', '<html><body>broken', '<table><tr><td>orphan</tr></table>', 'plain text'];
    for (const html of inputs) {
      const parsed = parseCbeReceipt(html);
      expect(parsed.found).toBe(false);
    }
  });

  it('treats resolved-but-fieldless HTML as found with empty fields', () => {
    const html = `
      <table>
        <tr><th>Transaction Reference</th><td>FT26195DBK5W81465291</td></tr>
      </table>`;
    const parsed = parseCbeReceipt(html);

    expect(parsed.found).toBe(true);
    expect(parsed.amountMinor).toBeNull();
    expect(parsed.senderName).toBe('');
  });
});

describe('amountToMinor (unit)', () => {
  it.each([
    ['5,500.00 ETB', 550000n],
    ['ETB 5500.00', 550000n],
    ['5500.00', 550000n],
    ['ETB 5,500', 550000n],
    ['1,200.99', 120099n],
  ])('parses %s → %d', (raw, expected) => {
    expect(amountToMinor(raw)).toBe(expected);
  });

  it('returns null for text without a number', () => {
    expect(amountToMinor('ETB')).toBeNull();
    expect(amountToMinor('')).toBeNull();
  });
});

describe('parseCbeDate (unit)', () => {
  // All three encode 2:08 PM Addis time on 14 Jul 2026 → same instant.
  it.each([['14/07/2026 2:08 PM'], ['14 Jul 2026, 2:08 PM'], ['2026-07-14T11:08:00Z']])(
    'parses %s to the same UTC instant',
    (raw) => {
      expect(parseCbeDate(raw)!.toISOString()).toBe('2026-07-14T11:08:00.000Z');
    },
  );

  it('handles the no-timezone ISO variant as UTC', () => {
    expect(parseCbeDate('2026-07-14 11:08:00')!.toISOString()).toBe('2026-07-14T11:08:00.000Z');
  });

  it('returns null for garbage', () => {
    expect(parseCbeDate('not a date')).toBeNull();
    expect(parseCbeDate('')).toBeNull();
  });
});
