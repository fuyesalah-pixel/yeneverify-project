// ============================================================
// Yene Verify — HTML Parser
//
// Bank confirmation pages differ in markup, but nearly all value
// tables are one of:
//
//   <tr><td>Label</td><td>Value</td></tr>
//   <tr><th>Label</th><td>Value</td></tr>
//
// Rows without a usable first cell are skipped rather than throwing:
// receipts embed banners, buttons and layout tables the caller should
// ignore by shape alone.
// ============================================================

import * as cheerio from 'cheerio';

export interface HtmlTableRow {
  /** Trimmed, lowercased first cell — 'transaction date', 'amount'. */
  label: string;
  /** Trimmed second cell, case preserved — values are not normalized. */
  value: string;
}

export function extractTableRows(html: string): HtmlTableRow[] {
  const $ = cheerio.load(html);
  const rows: HtmlTableRow[] = [];

  $('tr').each((_, tr) => {
    const cells = $(tr).find('th, td');
    if (cells.length < 2) {
      return; // headings, merged cells, layout rows — skip gracefully
    }
    const label = $(cells[0]).text().trim().replace(/\s+/g, ' ').toLowerCase();
    const value = $(cells[1]).text().trim();
    if (label.length > 0) {
      rows.push({ label, value });
    }
  });

  return rows;
}

/** Convenience: look a label up in already-extracted rows. */
export function findRow(rows: HtmlTableRow[], label: string): HtmlTableRow | undefined {
  const target = label.trim().toLowerCase();
  return rows.find((row) => row.label === target);
}
