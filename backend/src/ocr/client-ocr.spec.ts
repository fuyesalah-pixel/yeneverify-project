// ============================================================
// Yene Verify — Client OCR preference rules (v1.8.5)
// ============================================================

import { CLIENT_OCR_MIN_CONFIDENCE, usableClientOcr } from './client-ocr';

describe('usableClientOcr', () => {
  it('accepts text above the confidence floor', () => {
    expect(usableClientOcr('  CBE FT26195DBK5W81465291  ', 0.9)).toEqual({
      text: 'CBE FT26195DBK5W81465291',
      confidence: 0.9,
    });
  });

  it('rejects text at or below the floor', () => {
    expect(usableClientOcr('some text', CLIENT_OCR_MIN_CONFIDENCE)).toBeNull();
    expect(usableClientOcr('some text', 0.4)).toBeNull();
  });

  it('rejects empty or non-string text', () => {
    expect(usableClientOcr('', 0.9)).toBeNull();
    expect(usableClientOcr('   ', 0.9)).toBeNull();
    expect(usableClientOcr(undefined, 0.9)).toBeNull();
    expect(usableClientOcr(42, 0.9)).toBeNull();
  });

  it('rejects a missing or non-finite confidence', () => {
    expect(usableClientOcr('some text', null)).toBeNull();
    expect(usableClientOcr('some text', undefined)).toBeNull();
    expect(usableClientOcr('some text', Number.NaN)).toBeNull();
    expect(usableClientOcr('some text', Number.POSITIVE_INFINITY)).toBeNull();
  });
});
