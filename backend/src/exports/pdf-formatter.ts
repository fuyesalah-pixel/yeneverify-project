// ============================================================
// Yene Verify — PDF Formatter (Step 19)
//
// pdf-lib table export. Hard cap: 5_000 rows per PDF — larger
// requests are rejected at creation time with a hint to use CSV or
// narrow the range, and this formatter re-enforces the cap so the
// processor can never silently produce a shotgunned file.
//
// Layout: title line (merchant range summary), header line, one
// compressed row line per transaction. Simple and readable over
// pretty — the CSV is the machine-facing format.
// ============================================================

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ExportRow } from './exports.repository';
import { formatAmountEtB, formatPaidAt } from './csv-formatter';

/** Hard cap per PDF file; larger exports must use CSV. */
export const PDF_ROW_LIMIT = 5_000;

export class PdfRowLimitError extends Error {
  constructor(public readonly rowCount: number) {
    super(`PDF export cannot exceed ${PDF_ROW_LIMIT} rows (got ${rowCount}). Use CSV.`);
    this.name = 'PdfRowLimitError';
  }
}

const PAGE_WIDTH = 842; // A4 landscape
const PAGE_HEIGHT = 595;
const MARGIN = 40;
const LINE_HEIGHT = 14;
const FONT_SIZE = 8;
const TITLE_SIZE = 12;

const COLUMN_X = [MARGIN, 240, 388, 508, 592, 686];

/** Truncates so the line never runs off the page edge. */
function clampLine(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 3)}...`;
}

export async function buildPdf(
  rows: ExportRow[],
  meta: { merchantName: string; fromIso: string; toIso: string },
): Promise<{ buffer: Buffer; pageCount: number }> {
  if (rows.length > PDF_ROW_LIMIT) {
    throw new PdfRowLimitError(rows.length);
  }

  const doc = await PDFDocument.create();
  doc.setTitle(`Yene Verify transactions — ${meta.merchantName}`);
  doc.setProducer('Yene Verify');
  doc.setSubject(`Transactions ${meta.fromIso} .. ${meta.toIso}`);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  const accent = rgb(0.35, 0.35, 0.4);

  const maxChars = Math.floor((PAGE_WIDTH - MARGIN * 2) / (FONT_SIZE * 0.5));

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = (): void => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    page.drawText('Export continued…', {
      x: MARGIN,
      y,
      size: TITLE_SIZE,
      font: bold,
      color: accent,
    });
    y -= LINE_HEIGHT * 2;
  };

  // Title block
  page.drawText('Yene Verify — transaction export', {
    x: MARGIN,
    y,
    size: TITLE_SIZE,
    font: bold,
    color: ink,
  });
  y -= LINE_HEIGHT;
  page.drawText(
    clampLine(
      `${meta.merchantName}  ·  ${meta.fromIso} .. ${meta.toIso}  ·  ${rows.length} rows`,
      maxChars,
    ),
    { x: MARGIN, y, size: FONT_SIZE, font, color: accent },
  );
  y -= LINE_HEIGHT * 2;

  // Column header
  page.drawText('date / status', { x: COLUMN_X[0], y, size: FONT_SIZE, font: bold, color: ink });
  page.drawText('bank / reference', { x: COLUMN_X[1], y, size: FONT_SIZE, font: bold, color: ink });
  page.drawText('amount', { x: COLUMN_X[2], y, size: FONT_SIZE, font: bold, color: ink });
  page.drawText('sender', { x: COLUMN_X[3], y, size: FONT_SIZE, font: bold, color: ink });
  page.drawText('product', { x: COLUMN_X[4], y, size: FONT_SIZE, font: bold, color: ink });
  y -= LINE_HEIGHT;

  for (const row of rows) {
    if (y < MARGIN + LINE_HEIGHT) newPage();

    const sender = row.senderName ?? '-';
    const amount = `ETB ${formatAmountEtB(row.amountMinor)}`;
    page.drawText(clampLine(`${formatPaidAt(row.paidAt)}`, 17), {
      x: COLUMN_X[0],
      y,
      size: FONT_SIZE,
      font,
      color: ink,
    });
    page.drawText(clampLine(`${row.bankCode} ${row.bankReference}`, 18), {
      x: COLUMN_X[1],
      y,
      size: FONT_SIZE,
      font,
      color: ink,
    });
    page.drawText(amount, {
      x: COLUMN_X[2],
      y,
      size: FONT_SIZE,
      font: bold,
      color: ink,
    });
    page.drawText(clampLine(sender, 12), {
      x: COLUMN_X[3],
      y,
      size: FONT_SIZE,
      font,
      color: ink,
    });
    page.drawText(clampLine(row.productLabel ?? '-', 12), {
      x: COLUMN_X[4],
      y,
      size: FONT_SIZE,
      font,
      color: ink,
    });
    page.drawText(row.status, {
      x: COLUMN_X[5],
      y,
      size: FONT_SIZE,
      font,
      color: ink,
    });

    y -= LINE_HEIGHT;
  }

  const bytes = await doc.save();
  return { buffer: Buffer.from(bytes), pageCount: doc.getPageCount() };
}
