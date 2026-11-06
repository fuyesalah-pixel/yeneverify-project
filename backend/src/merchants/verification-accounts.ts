// ============================================================
// Yene Verify — Verification Accounts
//
// Shared logic for the merchant-configured bank identifiers:
//   • merge partial updates into the stored JSON object (deriving the
//     suffix each adapter needs from the full account number)
//   • map a merchant's settings onto VerifyInput.supplementary
//   • the bank/field catalogue served to the mobile settings screen
//   • masked values for the audit log
// ============================================================

import type { BankCode } from '@prisma/client';
import {
  VerificationAccountsSchema,
  type VerificationAccounts,
  type VerificationAccountsUpdate,
} from './dto/verification-accounts.dto';

export interface SupportedBankField {
  key: string;
  label: string;
  pattern: string;
  minLength: number;
  maxLength: number;
  inputType: 'number';
  note?: string;
}

export interface SupportedVerificationBank {
  bankCode: BankCode;
  displayName: string;
  fields: SupportedBankField[];
}

const FULL_ACCOUNT_FIELD = {
  key: 'full',
  pattern: '^\\d{10,16}$',
  minLength: 10,
  maxLength: 16,
  inputType: 'number' as const,
};

export const SUPPORTED_VERIFICATION_BANKS: SupportedVerificationBank[] = [
  {
    bankCode: 'CBE',
    displayName: 'Commercial Bank of Ethiopia',
    fields: [
      {
        ...FULL_ACCOUNT_FIELD,
        label: 'Your CBE account number',
        note: 'We only use the last 8 digits for verification.',
      },
    ],
  },
  {
    bankCode: 'ABYSSINIA',
    displayName: 'Bank of Abyssinia',
    fields: [
      {
        ...FULL_ACCOUNT_FIELD,
        label: 'Your Bank of Abyssinia account number',
        note: 'We only use the last 5 digits for verification.',
      },
    ],
  },
  {
    bankCode: 'AWASH',
    displayName: 'Awash Bank',
    fields: [
      {
        ...FULL_ACCOUNT_FIELD,
        label: 'Your Awash Bank account number',
        note: 'We use this number to look up your account.',
      },
    ],
  },
];

/** Stored JSON is untrusted (hand-edited rows, old shapes) — validate it. */
export function normalizeVerificationAccounts(value: unknown): VerificationAccounts {
  const parsed = VerificationAccountsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

function deriveCbe(full: string) {
  return { full, last8: full.slice(-8) };
}

function deriveAbyssinia(full: string) {
  return { full, last5: full.slice(-5) };
}

function deriveAwash(full: string) {
  return { full, accountNumber: full };
}

/**
 * Apply a partial settings update. `undefined` leaves a value untouched,
 * explicit `null` clears it.
 */
export function mergeVerificationAccounts(
  current: unknown,
  patch: VerificationAccountsUpdate | undefined,
): VerificationAccounts {
  const merged = { ...normalizeVerificationAccounts(current) };
  if (!patch) return merged;

  if (patch.cbe !== undefined) {
    if (patch.cbe === null) delete merged.cbe;
    else merged.cbe = deriveCbe(patch.cbe.full);
  }

  if (patch.abyssinia !== undefined) {
    if (patch.abyssinia === null) delete merged.abyssinia;
    else merged.abyssinia = deriveAbyssinia(patch.abyssinia.full);
  }

  if (patch.awash !== undefined) {
    if (patch.awash === null) delete merged.awash;
    else merged.awash = deriveAwash(patch.awash.full);
  }

  return merged;
}

/**
 * Translate merchant account settings into adapter supplementary fields.
 * Configured values win over OCR-derived guesses (the merchant knows the
 * account; OCR may have misread it).
 */
export function buildSupplementaryData(
  bankCode: string,
  accounts: unknown,
): Record<string, string> {
  const stored = normalizeVerificationAccounts(accounts);

  switch (bankCode) {
    case 'CBE':
      return stored.cbe ? { accountSuffix: stored.cbe.last8 } : {};
    case 'ABYSSINIA':
      return stored.abyssinia ? { accountSuffix: stored.abyssinia.last5 } : {};
    case 'AWASH':
      return stored.awash ? { accountNumber: stored.awash.accountNumber } : {};
    default:
      return {};
  }
}

/** Keep only the last four digits — used solely for audit metadata. */
export function maskAccountNumber(value: string): string {
  const visible = value.slice(-4);
  return `${'*'.repeat(Math.max(0, value.length - visible.length))}${visible}`;
}

/** Masked per-bank identifiers for the audit trail (never the full number). */
export function maskVerificationAccounts(accounts: VerificationAccounts): Record<string, string> {
  const masked: Record<string, string> = {};
  if (accounts.cbe) {
    masked.cbe = maskAccountNumber('full' in accounts.cbe ? accounts.cbe.full : accounts.cbe.last8);
  }
  if (accounts.abyssinia) {
    masked.abyssinia = maskAccountNumber(
      'full' in accounts.abyssinia ? accounts.abyssinia.full : accounts.abyssinia.last5,
    );
  }
  if (accounts.awash) {
    masked.awash = maskAccountNumber(accounts.awash.accountNumber);
  }
  return masked;
}
