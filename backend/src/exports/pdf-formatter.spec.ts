// ============================================================
// Yene Verify — PDF Formatter Unit Tests (Step 19)
// ============================================================

import { PDFDocument } from 'pdf-lib';
import { buildPdf, PDF_ROW_LIMIT, PdfRowLimitError } from './pdf-formatter';
import type { ExportRow } from './exports.repository';

function row(over: Partial<ExportRow> = {}): ExportRow {
  return {
    paidAt: new Date(Date.UTC(2026, 6, 14, 8, 45, 0)),
    bankCode: 'CBE',
    bankReference: 'FT250918PA4M',
    amountMinor: 550_000n,
    senderName: 'ABEBE KEBEDE',
    receiverName: 'YENE MERCHANT',
    status: 'VERIFIED',
    subMerchantLabel: null,
    productLabel: 'Coffee',
    ...over,
  };
}

describe('pdf-formatter', () => {
  it('generates a non-empty, parseable PDF buffer', async () => {
    const { buffer, pageCount } = await buildPdf([row(), row({ amountMinor: 12_345n })], {
      merchantName: 'Yene Test Merchant',
      fromIso: '2026-01-01',
      toIso: '2026-01-31',
    });

    expect(buffer.length).toBeGreaterThan(500);
    // PDF-1.x magic bytes: a real document, not a text payload.
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pageCount).toBeGreaterThanOrEqual(1);
  });

  it('rejects more than the 5k row cap', async () => {
    expect(PDF_ROW_LIMIT).toBe(5_000);
    const rows = Array.from({ length: PDF_ROW_LIMIT + 1 }, () => row());
    const err = await buildPdf(rows, { merchantName: 'm', fromIso: 'a', toIso: 'b' }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(PdfRowLimitError);
  });

  it('round-trips through pdf-lib with the metadata title intact', async () => {
    const { buffer } = await buildPdf(
      [row({ senderName: 'UNIQUE-SENDER-42', amountMinor: 777_700n })],
      {
        merchantName: 'Yene Test Merchant',
        fromIso: '2026-01-01',
        toIso: '2026-01-31',
      },
    );

    const parsed = await PDFDocument.load(buffer);
    expect(parsed.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(parsed.getTitle()).toContain('Yene Verify transactions');
    expect(parsed.getSubject()).toContain('2026-01-01');
  });
});
