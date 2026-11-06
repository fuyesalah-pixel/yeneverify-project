// ============================================================
// Yene Verify — QR hint resolver (v1.8.4)
//
// Pure parsing tests. The security invariant under test: a QR
// payload can only surface a bank + reference hint; it can never
// produce a verdict, and unparsable payloads yield no hint.
// ============================================================

import { resolveQrHints } from './qr-hints';

describe('resolveQrHints', () => {
  it('direct reference payload: bank from text, normalized reference', () => {
    const hints = resolveQrHints('CBE FT26195DBK5W81465291', 'reference');

    expect(hints).toEqual({
      contentType: 'reference',
      bankCode: 'CBE',
      reference: 'FT26195DBK5W81465291',
      referenceNormalized: 'FT26195DBK5W81465291',
    });
  });

  it('separator variants in a direct reference are normalized away', () => {
    const hints = resolveQrHints('awash 1234567890-12345', 'reference');

    expect(hints?.bankCode).toBe('AWASH');
    expect(hints?.reference).toBe('1234567890-12345');
    expect(hints?.referenceNormalized).toBe('123456789012345');
  });

  it('URL payload: reference from the id query param, bank from host', () => {
    const hints = resolveQrHints('https://apps.cbe.com.et:100/?id=FT26195DBK5W81465291', 'url');

    expect(hints).toEqual({
      contentType: 'url',
      bankCode: 'CBE',
      reference: 'FT26195DBK5W81465291',
      referenceNormalized: 'FT26195DBK5W81465291',
    });
  });

  it('URL payload: reference from the last path segment', () => {
    const hints = resolveQrHints('https://bankofabyssinia.com/receipt/FT26195DBK5W81465291', 'url');

    expect(hints?.contentType).toBe('url');
    expect(hints?.bankCode).toBe('ABYSSINIA');
    expect(hints?.referenceNormalized).toBe('FT26195DBK5W81465291');
  });

  it('JSON payload: reference and bank from named fields', () => {
    const hints = resolveQrHints(
      JSON.stringify({
        bank: 'telebirr',
        transactionReference: 'DEV12345678AB',
      }),
      'json',
    );

    expect(hints).toEqual({
      contentType: 'json',
      bankCode: 'TELEBIRR',
      reference: 'DEV12345678AB',
      referenceNormalized: 'DEV12345678AB',
    });
  });

  it('JSON payload: nested data object is read too', () => {
    const hints = resolveQrHints(
      JSON.stringify({ data: { bankReference: 'FT26195DBK5W81465291' } }),
      'json',
    );

    expect(hints?.referenceNormalized).toBe('FT26195DBK5W81465291');
    expect(hints?.reference).toBe('FT26195DBK5W81465291');
  });

  it('JSON payload: verification URL is unwrapped', () => {
    const hints = resolveQrHints(
      JSON.stringify({
        verificationUrl: 'https://apps.cbe.com.et/?id=FT26195DBK5W81465291',
      }),
      'json',
    );

    expect(hints?.contentType).toBe('json');
    expect(hints?.bankCode).toBe('CBE');
    expect(hints?.referenceNormalized).toBe('FT26195DBK5W81465291');
  });

  it('SECURITY: a JSON payload claiming a verdict yields no verdict path', () => {
    const hints = resolveQrHints(
      JSON.stringify({ status: 'VERIFIED', verified: true, amount: 1200 }),
      'json',
    );

    expect(hints).not.toBeNull();
    expect(hints?.reference).toBeNull();
    expect(hints?.referenceNormalized).toBeNull();
  });

  it('mislabelled payload falls back to auto-detection', () => {
    const hints = resolveQrHints('https://apps.cbe.com.et/?id=FT26195DBK5W81465291', 'reference');

    expect(hints?.contentType).toBe('url');
    expect(hints?.referenceNormalized).toBe('FT26195DBK5W81465291');
  });

  it('keeps the declared type when nothing parses but a bank name is present', () => {
    const hints = resolveQrHints('visit CBE for details', 'unknown');

    expect(hints).toEqual({
      contentType: 'unknown',
      bankCode: 'CBE',
      reference: null,
      referenceNormalized: null,
    });
  });

  it('empty or whitespace payload → null', () => {
    expect(resolveQrHints('', 'reference')).toBeNull();
    expect(resolveQrHints('   ', 'url')).toBeNull();
    expect(resolveQrHints(null, null)).toBeNull();
    expect(resolveQrHints(undefined, undefined)).toBeNull();
  });

  it('unknown bank text does not invent a bank', () => {
    const hints = resolveQrHints('FT26195DBK5W81465291', 'reference');
    expect(hints?.bankCode).toBeNull();
    expect(hints?.referenceNormalized).toBe('FT26195DBK5W81465291');
  });
});
