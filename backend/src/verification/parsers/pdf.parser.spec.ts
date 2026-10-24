// ============================================================
// Yene Verify — PDF Parser Unit Tests
//
// Uses the small generated fixture (fixtures/sample.pdf); no
// network, no real bank paperwork.
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPdfText, extractText } from './pdf.parser';

const fixture = () => readFileSync(resolve(__dirname, 'fixtures/sample.pdf'));

describe('pdf parser (unit)', () => {
  it('extracts non-empty text from a fixture PDF', async () => {
    const { text, pages } = await extractPdfText(fixture());

    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('Commercial Bank of Ethiopia');
    expect(text).toContain('FT1234567890');
    expect(pages).toBe(1);
  });

  it('extractText() returns the concatenated text', async () => {
    const text = await extractText(fixture());

    expect(text).toContain('Amount: ETB 1,200.00');
  });

  it('propagates a rejection for corrupt bytes', async () => {
    await expect(extractText(Buffer.from('definitely not a pdf'))).rejects.toThrow();
  });
});
