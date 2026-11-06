// ============================================================
// Yene Verify — Verification Accounts
//
// Shared logic for the merchant-configured bank identifiers:
//   • merge partial updates into the stored JSON object
//   • map a merchant's settings onto VerifyInput.supplementary
//   • the bank/field catalogue served to the mobile settings screen
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
}

export interface SupportedVerificationBank {
  bankCode: BankCode;
  displayName: string;
  fields: SupportedBankField[];
}

export const SUPPORTED_VERIFICATION_BANKS: SupportedVerificationBank[] = [
  {
    bankCode: 'CBE',
    displayName: 'Commercial Bank of Ethiopia',
    fields: [
      {
        key: 'last8',
        label: 'Last 8 digits of your account',
        pattern: '^\\d{8}$',
        minLength: 8,
        maxLength: 8,
        inputType: 'number',
      },
    ],
  },
  {
    bankCode: 'ABYSSINIA',
    displayName: 'Bank of Abyssinia',
    fields: [
      {
        key: 'last5',
        label: 'Last 5 digits of your account',
        pattern: '^\\d{5}$',
        minLength: 5,
        maxLength: 5,
        inputType: 'number',
      },
    ],
  },
  {
    bankCode: 'AWASH',
    displayName: 'Awash Bank',
    fields: [
      {
        key: 'accountNumber',
        label: 'Account number',
        pattern: '^\\d{10,16}$',
        minLength: 10,
        maxLength: 16,
        inputType: 'number',
      },
    ],
  },
];

/** Stored JSON is untrusted (hand-edited rows, old shapes) — validate it. */
export function normalizeVerificationAccounts(value: unknown): VerificationAccounts {
  const parsed = VerificationAccountsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

/**
 * Apply a partial settings update. `undefined` leaves a value untouched,
 * explicit `null` clears it, and a bank object with no remaining fields
 * disappears entirely.
 */
export function mergeVerificationAccounts(
  current: unknown,
  patch: VerificationAccountsUpdate | undefined,
): VerificationAccounts {
  const merged = { ...normalizeVerificationAccounts(current) };
  if (!patch) return merged;

  if (patch.cbe !== undefined) {
    if (patch.cbe === null) {
      delete merged.cbe;
    } else {
      const last8 = patch.cbe.last8 === null ? undefined : (patch.cbe.last8 ?? merged.cbe?.last8);
      if (last8) merged.cbe = { last8 };
      else delete merged.cbe;
    }
  }

  if (patch.abyssinia !== undefined) {
    if (patch.abyssinia === null) {
      delete merged.abyssinia;
    } else {
      const last5 =
        patch.abyssinia.last5 === null
          ? undefined
          : (patch.abyssinia.last5 ?? merged.abyssinia?.last5);
      if (last5) merged.abyssinia = { last5 };
      else delete merged.abyssinia;
    }
  }

  if (patch.awash !== undefined) {
    if (patch.awash === null) {
      delete merged.awash;
    } else {
      const accountNumber =
        patch.awash.accountNumber === null
          ? undefined
          : (patch.awash.accountNumber ?? merged.awash?.accountNumber);
      if (accountNumber) merged.awash = { accountNumber };
      else delete merged.awash;
    }
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
