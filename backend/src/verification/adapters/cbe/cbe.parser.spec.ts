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
    expect(parsed.notFound).toBe(true);
    expect(parsed.notFoundReason).toBe('not-found');
    expect(parsed.amountMinor).toBeNull();
  });

  it('flags an invalid-account page as accountMismatch, not not-found', () => {
    const parsed = parseCbeReceipt(
      '<html><body><h3>Invalid account</h3><p>Account mismatch.</p></body></html>',
    );

    expect(parsed.found).toBe(false);
    expect(parsed.notFound).toBe(false);
    expect(parsed.accountMismatch).toBe(true);
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

describe('parseCbeReceipt PDF format (unit)', () => {
  const pdfText = [
    'Transaction Reference: FT26195DBK5W81465291',
    'Sender Name: Abebe Kebede',
    'Receiver Name: Selam Coffee',
    'Amount: ETB 5,500.00',
    'Transaction Date: 14/07/2026 2:08 PM',
  ].join('\n');

  it('parses labelled PDF text with the same field semantics as HTML', () => {
    const parsed = parseCbeReceipt(pdfText, 'pdf', 'FT26195DBK5W81465291');

    expect(parsed.format).toBe('pdf');
    expect(parsed.found).toBe(true);
    expect(parsed.reference).toBe('FT26195DBK5W81465291');
    expect(parsed.amountMinor).toBe(550000n);
    expect(parsed.senderName).toBe('Abebe Kebede');
    expect(parsed.receiverName).toBe('Selam Coffee');
    expect(parsed.paidAt!.toISOString()).toBe('2026-07-14T11:08:00.000Z');
  });

  it('parses the real column layout where values are concatenated to labels', () => {
    // Mirrors the BranchReceipt PDF: pdf-parse emits the label and its
    // value on one line without a separator.
    const columnPdf = [
      'Commercial Bank of Ethiopia',
      'Payment / Transaction Information',
      'PayerABEBE KEBEDE',
      'Account1****5291',
      'ReceiverSELAM COFFEE',
      'Payment Date & Time25/12/2026, 12:28:00 PM',
      'Reference No. (VAT Invoice No)FT26308B3ZN3',
      'Transferred Amount60.00 ETB',
      'Total amount debited from customers account60.61 ETB',
    ].join('\n');

    const parsed = parseCbeReceipt(columnPdf, 'pdf', 'FT26308B3ZN3');

    expect(parsed.found).toBe(true);
    expect(parsed.reference).toBe('FT26308B3ZN3');
    expect(parsed.amountMinor).toBe(6000n); // transferred amount, not the fee total
    expect(parsed.senderName).toBe('ABEBE KEBEDE');
    expect(parsed.receiverName).toBe('SELAM COFFEE');
    expect(parsed.paidAt!.toISOString()).toBe('2026-12-25T09:28:00.000Z');
  });

  it('reads the live month-first layout (7/24/2026) as July 24', () => {
    // Real BranchReceipt PDF for FT2620595CST prints
    // "Payment Date & Time7/24/2026, 3:51:00 PM".
    const livePdf = [
      'PayerABEBE KEBEDE',
      'ReceiverSELAM COFFEE',
      'Payment Date & Time7/24/2026, 3:51:00 PM',
      'Reference No. (VAT Invoice No)FT2620595CST',
      'Transferred Amount1,150.00 ETB',
    ].join('\n');

    const parsed = parseCbeReceipt(livePdf, 'pdf', 'FT2620595CST');

    expect(parsed.found).toBe(true);
    expect(parsed.paidAt!.toISOString()).toBe('2026-07-24T12:51:00.000Z');
  });

  it('keeps ambiguous numeric dates month-first (11/4/2026 is 4 Nov)', () => {
    const parsed = parseCbeReceipt(
      pdfText.replace('14/07/2026 2:08 PM', '11/4/2026, 2:08:00 PM'),
      'pdf',
      'FT26195DBK5W81465291',
    );

    expect(parsed.paidAt!.toISOString()).toBe('2026-11-04T11:08:00.000Z');
  });

  it('leaves an impossible numeric date unparsed instead of rolling it over', () => {
    const parsed = parseCbeReceipt(
      pdfText.replace('14/07/2026 2:08 PM', '13/24/2026, 2:08:00 PM'),
      'pdf',
      'FT26195DBK5W81465291',
    );

    expect(parsed.found).toBe(true);
    expect(parsed.paidAt).toBeNull();
  });

  it('treats a PDF carrying a different reference as a definitive mismatch', () => {
    const parsed = parseCbeReceipt(
      pdfText.replace('FT26195DBK5W81465291', 'FT26195DBK5W00000000'),
      'pdf',
      'FT26195DBK5W81465291',
    );

    expect(parsed.found).toBe(false);
    expect(parsed.notFound).toBe(true);
    expect(parsed.notFoundReason).toBe('reference-mismatch');
  });

  it('treats a PDF failure notice as definitive, not ambiguous', () => {
    const parsed = parseCbeReceipt('Receipt not found for this reference.', 'pdf');

    expect(parsed.found).toBe(false);
    expect(parsed.notFound).toBe(true);
    expect(parsed.notFoundReason).toBe('not-found');
  });

  it('degrades unreadable PDF text to ambiguous (found:false, notFound:false)', () => {
    const parsed = parseCbeReceipt('random scan output with no labels', 'pdf');

    expect(parsed.found).toBe(false);
    expect(parsed.notFound).toBe(false);
    expect(parsed.accountMismatch).toBe(false);
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
