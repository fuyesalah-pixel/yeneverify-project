// ============================================================
// Yene Verify — CBE New Receipt Parser
//
// Maps the JSON returned by CbeNewClient onto the fields the
// verifier needs. Malformed or incomplete payloads NEVER throw:
// they report the missing fields so the adapter can answer with a
// deterministic ERROR instead of a false verdict.
// ============================================================

import { parseAmount } from '../../parsers/field-parsers';
import type { CbeNewReceipt } from './cbe-new.client';

export interface CbeNewParsedReceipt {
  reference: string;
  amountMinor: bigint | null;
  senderName: string;
  receiverName: string;
  paidAt: Date | null;
  /** Field names that could not be resolved, in adapter metadata order. */
  missing: string[];
}

/** CBE's dateTimes[0] is Addis wall time, e.g. "Thu 2026-10-01  EAT (UTC+03:00)". */
const EAT_OFFSET = '+03:00';
const DATE_RE = /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/;

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseCbeNewDate(raw: unknown): Date | null {
  if (typeof raw !== 'string') return null;
  const match = DATE_RE.exec(raw);
  if (!match) return null;

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${EAT_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseCbeNewReceipt(receipt: CbeNewReceipt): CbeNewParsedReceipt {
  const reference = clean(receipt.id);
  const senderName = clean(receipt.debitAccountHolder);
  const receiverName = clean(receipt.creditAccountHolder);
  const amountMinor =
    typeof receipt.amountCredited === 'string' || typeof receipt.amountCredited === 'number'
      ? parseAmount(String(receipt.amountCredited))
      : null;
  const paidAt = parseCbeNewDate(receipt.dateTimes?.[0]);

  const missing: string[] = [];
  if (!reference) missing.push('reference');
  if (amountMinor === null) missing.push('amount');
  if (!senderName) missing.push('sender');
  if (!receiverName) missing.push('receiver');
  if (!paidAt) missing.push('date');
  const currency = clean(receipt.creditCurrency);
  if (currency && currency.toUpperCase() !== 'ETB') missing.push('currency');

  return { reference, amountMinor, senderName, receiverName, paidAt, missing };
}
