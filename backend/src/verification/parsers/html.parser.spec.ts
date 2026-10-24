// ============================================================
// Yene Verify — HTML Parser Unit Tests
// ============================================================

import { extractTableRows, findRow } from './html.parser';

describe('extractTableRows (unit)', () => {
  it('extracts <tr><td> pairs', () => {
    const html = `
      <table>
        <tr><td>Transaction Date</td><td>2026-10-23</td></tr>
        <tr><td>Amount</td><td>ETB 1,200.00</td></tr>
        <tr><td>Receiver</td><td>General Trading PLC</td></tr>
      </table>`;
    const rows = extractTableRows(html);

    expect(rows).toEqual([
      { label: 'transaction date', value: '2026-10-23' },
      { label: 'amount', value: 'ETB 1,200.00' },
      { label: 'receiver', value: 'General Trading PLC' },
    ]);
  });

  it('handles <th>Label</th><td>Value</td> rows', () => {
    const html = '<table><tr><th>Reference</th><td>FT1234567890</td></tr></table>';
    const rows = extractTableRows(html);

    expect(rows).toEqual([{ label: 'reference', value: 'FT1234567890' }]);
  });

  it('skips rows without a usable first cell', () => {
    const html = `
      <table>
        <tr><td colspan="2">Commercial Bank of Ethiopia</td></tr>
        <tr><td>Amount</td><td>500.00</td></tr>
        <tr><th>Reference</th><td>FT1234567890</td></tr>
      </table>`;
    const rows = extractTableRows(html);

    expect(rows).toEqual([
      { label: 'amount', value: '500.00' },
      { label: 'reference', value: 'FT1234567890' },
    ]);
  });

  it('collapses internal whitespace and trims labels', () => {
    const html = '<table><tr><td>  Payer  Name </td><td>  Abebe Kebede  </td></tr></table>';
    const rows = extractTableRows(html);

    expect(rows).toEqual([{ label: 'payer name', value: 'Abebe Kebede' }]);
  });

  it('returns an empty array for HTML without tables', () => {
    expect(extractTableRows('<div><p>No receipt data here</p></div>')).toEqual([]);
  });

  it('findRow() looks up a label in extracted rows', () => {
    const rows = extractTableRows('<table><tr><td>Amount</td><td>1,200.00</td></tr></table>');
    expect(findRow(rows, ' Amount ')).toEqual({
      label: 'amount',
      value: '1,200.00',
    });
    expect(findRow(rows, 'missing')).toBeUndefined();
  });
});
