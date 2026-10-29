// ============================================================
// Yene Verify — CSV Formatter Unit Tests (Step 19)
// ============================================================

import { formatAmountEtB, formatCsv, formatPaidAt } from './csv-formatter';
import type { ExportRow } from './exports.repository';

function row(over: Partial<ExportRow> = {}): ExportRow {
  return {
    paidAt: new Date(Date.UTC(2026, 6, 14, 8, 45, 0)), // Addis 11:45
    bankCode: 'CBE',
    bankReference: 'FT250918PA4M',
    amountMinor: 550_000n,
    senderName: 'ABEBE KEBEDE',
    receiverName: 'YENE MERCHANT',
    status: 'VERIFIED',
    subMerchantLabel: null,
    productLabel: null,
    ...over,
  };
}

describe('csv-formatter', () => {
  it('emits the exact fixed header', () => {
    const csv = formatCsv([]).toString('utf8');
    expect(
      csv.startsWith(
        'date,bank,reference,amount_etb,sender,receiver,status,sub_merchant,product\n',
      ),
    ).toBe(true);
  });

  it('formats amounts from minor units with 2 decimals, bigint-safe', () => {
    expect(formatAmountEtB(550_000n)).toBe('5500.00');
    expect(formatAmountEtB(123_450n)).toBe('1234.50');
    expect(formatAmountEtB(7n)).toBe('0.07');
    expect(formatAmountEtB(0n)).toBe('0.00');
    expect(formatAmountEtB(1_234_567_890_123n)).toBe('12345678901.23');
  });

  it('renders dates in Africa/Addis_Ababa civil time', () => {
    // 08:45 UTC == 11:45 Addis (UTC+3)
    expect(formatPaidAt(new Date(Date.UTC(2026, 6, 14, 8, 45, 0)))).toBe('2026-07-14 11:45');
    // Day boundary discipline: 21:30 UTC July 14 == 00:30 July 15 Addis
    expect(formatPaidAt(new Date(Date.UTC(2026, 6, 14, 21, 30, 0)))).toBe('2026-07-15 00:30');
  });

  it('quotes and doubles quotes for names containing commas or quotes', () => {
    const csv = formatCsv([
      row({ senderName: 'SHEGER, PLC', productLabel: 'May "special" pack' }),
      row({ senderName: 'comma in sender, see', bankReference: 'PLAIN' }),
    ]).toString('utf8');

    // RFC-4180: comma-bearing fields are quoted, embedded quotes doubled.
    expect(csv).toContain('"SHEGER, PLC"');
    expect(csv).toContain('"May ""special"" pack"');
    expect(csv).toContain('"comma in sender, see"');

    // Records still parse field-for-field with a real RFC-4180 reader.
    const records = parseCsv(csv);
    expect(records).toHaveLength(3); // header + 2 payload rows
    expect(records[1][4]).toBe('SHEGER, PLC');
    expect(records[1][8]).toBe('May "special" pack');
    expect(records[2][4]).toBe('comma in sender, see');
  });

  it('preserves newlines inside a quoted field as data, not record breaks', () => {
    const records = parseCsv(formatCsv([row({ senderName: 'two\nlines' })]).toString('utf8'));
    expect(records).toHaveLength(2); // header + 1 payload row
    expect(records[1][4]).toBe('two\nlines');
  });

  it('blanks nullable fields (product, sub-merchant, receiver)', () => {
    const csv = formatCsv([row({ receiverName: null, productLabel: null })]).toString('utf8');
    const dataRow = csv.split('\n')[1].split(',');
    expect(dataRow[dataRow.length - 1]).toBe('');
    expect(csv).not.toContain('null');
  });
});

/**
 * Minimal RFC-4180 record parser for assertions (quotes + embedded
 * commas/newlines are the tricky parts naive split() mishandles).
 */
function parseCsv(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < csv.length; i += 1) {
    const c = csv[i];
    if (inQuotes) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      record.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && csv[i + 1] === '\n') i += 1;
      record.push(field);
      field = '';
      if (record.length > 1 || record[0] !== '') records.push(record);
      record = [];
    } else {
      field += c;
    }
  }
  record.push(field);
  if (record.length > 1 || record[0] !== '') records.push(record);
  return records;
}
