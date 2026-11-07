// ============================================================
// Yene Verify — Label Extractor Unit Tests
//
// Covers the label separators seen on real receipts (colon, em
// dash, newline, plain space), case handling, validator rejection,
// length limits, label priority and label word boundaries.
// ============================================================

import { extractLabeledValue, type ExtractOptions } from './label-extractor';

const FT_VALUE = 'FT26201XP8NP';
const ftValidator = /^FT[0-9A-Z]{8,22}$/;

const extract = (text: string, options: Partial<ExtractOptions> = {}): string | null =>
  extractLabeledValue(text, {
    labels: ['Transaction Reference', 'Transaction Ref', 'FT Ref', 'Reference'],
    validator: ftValidator,
    ...options,
  });

describe('extractLabeledValue (unit)', () => {
  it('extracts a colon-separated value', () => {
    expect(extract(`Transaction Reference: ${FT_VALUE}`)).toBe(FT_VALUE);
  });

  it('extracts an em-dash-separated value', () => {
    expect(extract(`Transaction Reference — ${FT_VALUE}`)).toBe(FT_VALUE);
  });

  it('extracts a value on the following line', () => {
    expect(extract(`Transaction Reference\n${FT_VALUE}`)).toBe(FT_VALUE);
  });

  it('extracts a plain space-separated value', () => {
    expect(extract(`Transaction Reference ${FT_VALUE}`)).toBe(FT_VALUE);
  });

  it('matches a short label ("Ref") with a colon', () => {
    expect(extract(`Ref: ${FT_VALUE}`, { labels: ['Ref'] })).toBe(FT_VALUE);
  });

  it('is case insensitive by default (REF:)', () => {
    expect(extract(`REF: ${FT_VALUE}`, { labels: ['Ref'] })).toBe(FT_VALUE);
  });

  it('is case insensitive by default (ref:)', () => {
    expect(extract(`ref: ${FT_VALUE}`, { labels: ['Ref'] })).toBe(FT_VALUE);
  });

  it('runs in case-sensitive mode when asked', () => {
    expect(extract(`ref: ${FT_VALUE}`, { labels: ['Ref'], caseSensitive: true })).toBeNull();
    expect(extract(`Ref: ${FT_VALUE}`, { labels: ['Ref'], caseSensitive: true })).toBe(FT_VALUE);
  });

  it('returns null when the validator rejects the value', () => {
    expect(extract('Transaction Reference: INVALID')).toBeNull();
  });

  it('returns null when no label is present', () => {
    expect(extract(`paid ${FT_VALUE}`)).toBeNull();
  });

  it('returns null for empty text', () => {
    expect(extract('')).toBeNull();
    expect(extract('   \n  ')).toBeNull();
  });

  it('returns null when the value exceeds the default 30-char limit', () => {
    expect(
      extract(`Transaction Reference: ${'A'.repeat(31)}`, { validator: undefined }),
    ).toBeNull();
  });

  it('honours a custom maxLength', () => {
    const long = 'A'.repeat(35);
    expect(extract(`Transaction Reference: ${long}`, { validator: undefined })).toBeNull();
    expect(extract(`Transaction Reference: ${long}`, { validator: undefined, maxLength: 40 })).toBe(
      long,
    );
  });

  it('trims trailing punctuation from the value', () => {
    expect(extract(`Transaction Reference: ${FT_VALUE},`)).toBe(FT_VALUE);
  });

  it('stops the value at the next whitespace', () => {
    expect(extract(`Transaction Reference: ${FT_VALUE} amount 500`)).toBe(FT_VALUE);
  });

  it('tries labels in priority order, not text order', () => {
    const text = `Reference: FTAAAAAAAAAA\nTransaction Reference: ${FT_VALUE}`;
    expect(extract(text)).toBe(FT_VALUE);
  });

  it('does not match a label inside a longer word', () => {
    // "Ref" must not latch onto "Reference".
    expect(extract(`Reference: ${FT_VALUE}`, { labels: ['Ref'] })).toBeNull();
  });
});
