// ============================================================
// Yene Verify — CSV Formatter (Step 19)
//
// Pure functions turning export rows into CSV bytes. Escape rules
// are RFC-4180 (quote fields containing comma/quote/newline, double
// the quotes). Amounts come in as minor units bigints and leave as
// plain "5500.00"; dates render in Africa/Addis_Ababa civil time.
//
// No I/O, no Prisma, no config — trivially unit-testable.
// ============================================================

import type { ExportRow } from './exports.repository';

/** Node's full-ICU Intl renders this as 'YYYY-MM-DD HH:mm'. */
const TZ = 'Africa/Addis_Ababa';

const HEADER = 'date,bank,reference,amount_etb,sender,receiver,status,sub_merchant,product';

const dateTimeFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** 550050n → "5500.50" — minor units, dot decimal, exactly 2 places. */
export function formatAmountEtB(amountMinor: bigint): string {
  const minor = amountMinor.toString().padStart(3, '0');
  const whole = minor.slice(0, -2);
  const fraction = minor.slice(-2);
  return `${whole}.${fraction}`;
}

/** Date → "2026-07-14 14:08" in Africa/Addis_Ababa. */
export function formatPaidAt(paidAt: Date): string {
  const parts = dateTimeFormatter.formatToParts(paidAt);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/** RFC-4180 field escaping. */
export function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function field(value: string | null | undefined): string {
  return csvEscape(value ?? '');
}

/** One CSV line per row, RFC-4180 escaped, LF line endings. */
export function formatCsv(rows: ExportRow[]): Buffer {
  const lines: string[] = [HEADER];
  for (const row of rows) {
    lines.push(
      [
        formatPaidAt(row.paidAt),
        row.bankCode,
        row.bankReference,
        formatAmountEtB(row.amountMinor),
        field(row.senderName),
        field(row.receiverName),
        row.status,
        field(row.subMerchantLabel),
        field(row.productLabel),
      ].join(','),
    );
  }
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8');
}
