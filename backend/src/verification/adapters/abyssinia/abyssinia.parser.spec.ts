// ============================================================
// Yene Verify — Abyssinia Receipt Parser Unit Tests
//
// Realistic sanitized fixtures for the page classes the adapter
// must tell apart, plus the body-text-only rule inherited from the
// Dashen "no record-related in a comment" bug. No HTTP, no DB.
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseAbyssiniaReceipt } from './abyssinia.parser';

const successHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-success.html'), 'utf8');
const notFoundHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-not-found.html'), 'utf8');
const badSuffixHtml = () =>
  readFileSync(resolve(__dirname, '__fixtures__/receipt-bad-suffix.html'), 'utf8');

describe('parseAbyssiniaReceipt (unit)', () => {
  it('extracts every field from the success fixture, amount as bigint', () => {
    const parsed = parseAbyssiniaReceipt(successHtml(), '67890');

    expect(parsed.found).toBe(true);
    expect(parsed.notFound).toBe(false);
    expect(parsed.reference).toBe('FT26201XYZ123456789012');
    expect(parsed.amountMinor).toBe(320000n); // bigint
    expect(parsed.currency).toBe('ETB');
    expect(parsed.senderName).toBe('Abebe Kebede');
    expect(parsed.receiverName).toBe('Selam Coffee');
    // 18/07/2026 2:45 PM in Africa/Addis_Ababa (UTC+3)
    expect(parsed.paidAt!.toISOString()).toBe('2026-07-18T11:45:00.000Z');
  });

  it('accepts a receipt whose account ends with the supplied suffix', () => {
    // The fixture account 10001234567890 ends with 67890 / 7890.
    expect(parseAbyssiniaReceipt(successHtml(), '7890').found).toBe(true);
  });

  it('reports the not-found fixture as a definitive no-record page', () => {
    const parsed = parseAbyssiniaReceipt(notFoundHtml(), '67890');

    expect(parsed.found).toBe(false);
    expect(parsed.notFound).toBe(true);
    expect(parsed.notFoundReason).toBe('not-found');
    expect(parsed.amountMinor).toBeNull();
  });

  it('reports the bad-suffix fixture as a definitive invalid-suffix page', () => {
    const parsed = parseAbyssiniaReceipt(badSuffixHtml(), '67890');

    expect(parsed.found).toBe(false);
    expect(parsed.notFound).toBe(true);
    expect(parsed.notFoundReason).toBe('invalid-suffix');
  });

  it('classifies a found receipt whose account mismatches the suffix as invalid-suffix', () => {
    // Reference and amount exist, but not the account the user claimed.
    const parsed = parseAbyssiniaReceipt(successHtml(), '11111');

    expect(parsed.found).toBe(false);
    expect(parsed.notFound).toBe(true);
    expect(parsed.notFoundReason).toBe('invalid-suffix');
  });

  it('every definitive phrasing classifies correctly', () => {
    expect(parseAbyssiniaReceipt('<p>Receipt not found</p>').notFoundReason).toBe('not-found');
    expect(parseAbyssiniaReceipt('<p>No record</p>').notFoundReason).toBe('not-found');
    expect(parseAbyssiniaReceipt('<p>This reference does not exist</p>').notFoundReason).toBe(
      'not-found',
    );
    expect(parseAbyssiniaReceipt('<p>Receipt not available</p>').notFoundReason).toBe('not-found');
    expect(parseAbyssiniaReceipt('<p>Invalid receipt reference</p>').notFoundReason).toBe(
      'not-found',
    );
    expect(parseAbyssiniaReceipt('<p>Invalid account number supplied</p>').notFoundReason).toBe(
      'invalid-suffix',
    );
    expect(parseAbyssiniaReceipt('<p>Account mismatch for this reference</p>').notFoundReason).toBe(
      'invalid-suffix',
    );
  });

  it('matches definitive phrases in visible text only — an HTML comment never triggers them', () => {
    // The 13D.4 lesson: the phrase lives in a comment and a JS payload,
    // so a raw-HTML regex reports FAKE — body-text extraction must not.
    const html = `
      <!-- Search result snapshot: receipt not found for this reference -->
      <script>var message = "receipt not found";</script>
      <table>
        <tr><th>Reference</th><td>FT26201XYZ123456789012</td></tr>
        <tr><th>Amount</th><td>3,200.00 ETB</td></tr>
      </table>`;

    const parsed = parseAbyssiniaReceipt(html);

    expect(parsed.found).toBe(true);
    expect(parsed.notFound).toBe(false);
  });

  it('classifies the ambiguous gateway page as neither found nor definitive', () => {
    const gateway = `
      <!DOCTYPE html><html><head><title>Error</title></head><body>
        <h1>Internal Server Error</h1>
        <p>The application has encountered an error. Please try again later.</p>
      </body></html>`;
    const parsed = parseAbyssiniaReceipt(gateway);

    expect(parsed.found).toBe(false);
    expect(parsed.notFound).toBe(false);
  });

  it('returns found:false and never throws on malformed HTML', () => {
    const inputs = ['', '<html><body>broken', '<table><tr><td>orphan</tr></table>', 'plain text'];
    for (const html of inputs) {
      const parsed = parseAbyssiniaReceipt(html);
      expect(parsed.found).toBe(false);
      expect(parsed.notFound).toBe(false);
    }
  });

  it('treats resolved-but-fieldless HTML as found with empty fields', () => {
    const html = `
      <table>
        <tr><th>Reference</th><td>FT26201XYZ123456789012</td></tr>
      </table>`;
    const parsed = parseAbyssiniaReceipt(html);

    expect(parsed.found).toBe(true);
    expect(parsed.amountMinor).toBeNull();
    expect(parsed.senderName).toBe('');
  });
});
