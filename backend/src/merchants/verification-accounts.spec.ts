// ============================================================
// Yene Verify — VerificationAccounts unit tests
//
// Covers the pure functions that keep the settings payload, stored
// JSON, adapter supplementary fields, and audit masking in sync.
// ============================================================

import {
  buildSupplementaryData,
  maskVerificationAccounts,
  mergeVerificationAccounts,
  normalizeVerificationAccounts,
  SUPPORTED_VERIFICATION_BANKS,
} from './verification-accounts';
import {
  VerificationAccountsUpdateSchema,
  VerificationAccountsSchema,
} from './dto/verification-accounts.dto';

describe('normalizeVerificationAccounts', () => {
  it('returns {} for untrusted or malformed stored values', () => {
    expect(normalizeVerificationAccounts(null)).toEqual({});
    expect(normalizeVerificationAccounts('nonsense')).toEqual({});
    expect(normalizeVerificationAccounts({ cbe: { last8: '123' } })).toEqual({});
  });

  it('keeps a valid stored object with full numbers and derived suffixes', () => {
    expect(
      normalizeVerificationAccounts({
        cbe: { full: '1000123456789', last8: '23456789' },
        awash: { full: '0123456789', accountNumber: '0123456789' },
      }),
    ).toEqual({
      cbe: { full: '1000123456789', last8: '23456789' },
      awash: { full: '0123456789', accountNumber: '0123456789' },
    });
  });

  it('keeps legacy last-N-only rows readable until the merchant re-saves', () => {
    expect(
      normalizeVerificationAccounts({
        cbe: { last8: '12345678' },
        abyssinia: { last5: '54321' },
      }),
    ).toEqual({
      cbe: { last8: '12345678' },
      abyssinia: { last5: '54321' },
    });
  });
});

describe('mergeVerificationAccounts', () => {
  const current = {
    cbe: { last8: '11111111' } as const,
    abyssinia: { last5: '22222' } as const,
    awash: { accountNumber: '3333333333' } as const,
  };

  it('derives the adapter suffix from the full account number', () => {
    expect(
      mergeVerificationAccounts(current, {
        cbe: { full: '1000123456789' },
        abyssinia: { full: '0123456789' },
        awash: { full: '0123456789' },
      }),
    ).toEqual({
      cbe: { full: '1000123456789', last8: '23456789' },
      abyssinia: { full: '0123456789', last5: '56789' },
      awash: { full: '0123456789', accountNumber: '0123456789' },
    });
  });

  it('merges only the supplied banks and keeps legacy rows untouched', () => {
    expect(mergeVerificationAccounts(current, { awash: { full: '0123456789' } })).toEqual({
      cbe: { last8: '11111111' },
      abyssinia: { last5: '22222' },
      awash: { full: '0123456789', accountNumber: '0123456789' },
    });
  });

  it('clears a whole bank with null', () => {
    expect(mergeVerificationAccounts(current, { abyssinia: null })).toEqual({
      cbe: { last8: '11111111' },
      awash: { accountNumber: '3333333333' },
    });
  });

  it('is a no-op for an empty patch', () => {
    expect(mergeVerificationAccounts(current, {})).toEqual(current);
  });

  it('configures a bank that was never set', () => {
    expect(mergeVerificationAccounts({}, { cbe: { full: '1000123456789' } })).toEqual({
      cbe: { full: '1000123456789', last8: '23456789' },
    });
  });
});

describe('buildSupplementaryData', () => {
  const accounts = {
    cbe: { full: '1000123456789', last8: '23456789' },
    abyssinia: { full: '0123456789', last5: '56789' },
    awash: { full: '0123456789', accountNumber: '0123456789' },
  };

  it('maps CBE to last8 (the adapter field)', () => {
    expect(buildSupplementaryData('CBE', accounts)).toEqual({
      last8: '23456789',
    });
  });

  it('maps Abyssinia to accountSuffix (the adapter field)', () => {
    expect(buildSupplementaryData('ABYSSINIA', accounts)).toEqual({
      accountSuffix: '56789',
    });
  });

  it('maps Awash to accountNumber', () => {
    expect(buildSupplementaryData('AWASH', accounts)).toEqual({
      accountNumber: '0123456789',
    });
  });

  it('still reads legacy last-N-only rows', () => {
    expect(buildSupplementaryData('CBE', { cbe: { last8: '12345678' } })).toEqual({
      last8: '12345678',
    });
  });

  it('returns {} for unconfigured or unsupported banks', () => {
    expect(buildSupplementaryData('ABYSSINIA', {})).toEqual({});
    expect(buildSupplementaryData('TELEBIRR', accounts)).toEqual({});
    expect(buildSupplementaryData('CBE', null)).toEqual({});
  });
});

describe('maskVerificationAccounts', () => {
  it('exposes only the last four digits per bank', () => {
    expect(
      maskVerificationAccounts({
        cbe: { full: '1000123456789', last8: '23456789' },
        abyssinia: { full: '0123456789', last5: '56789' },
        awash: { full: '9876543210', accountNumber: '9876543210' },
      }),
    ).toEqual({
      cbe: '*********6789',
      abyssinia: '******6789',
      awash: '******3210',
    });
  });

  it('masks legacy last-N-only rows', () => {
    expect(maskVerificationAccounts({ cbe: { last8: '12345678' } })).toEqual({
      cbe: '****5678',
    });
  });
});

describe('verification accounts validation', () => {
  it('exposes the three supported banks asking for the full account', () => {
    expect(SUPPORTED_VERIFICATION_BANKS.map((b) => b.bankCode)).toEqual([
      'CBE',
      'ABYSSINIA',
      'AWASH',
    ]);
    for (const bank of SUPPORTED_VERIFICATION_BANKS) {
      expect(bank.fields[0]).toMatchObject({
        key: 'full',
        minLength: 10,
        maxLength: 16,
      });
      expect(bank.fields[0].label).toMatch(/account number/i);
      expect(bank.fields[0].note).toBeTruthy();
    }
    expect(SUPPORTED_VERIFICATION_BANKS[0].fields[0].label).toBe('Your CBE account number');
    expect(SUPPORTED_VERIFICATION_BANKS[0].fields[0].note).toBe(
      'We only use the last 8 digits for verification.',
    );
  });

  it('accepts valid full-account updates', () => {
    expect(
      VerificationAccountsUpdateSchema.safeParse({
        cbe: { full: '1000123456789' },
        abyssinia: null,
        awash: { full: '0123456789' },
      }).success,
    ).toBe(true);
  });

  it('rejects wrong account lengths', () => {
    expect(VerificationAccountsUpdateSchema.safeParse({ cbe: { full: '123456789' } }).success).toBe(
      false,
    );
    expect(
      VerificationAccountsUpdateSchema.safeParse({
        cbe: { full: '12345678901234567' },
      }).success,
    ).toBe(false);
  });

  it('rejects non-digits, legacy keys, and unknown banks', () => {
    expect(VerificationAccountsUpdateSchema.safeParse({ cbe: { full: '1234abcd' } }).success).toBe(
      false,
    );
    expect(VerificationAccountsUpdateSchema.safeParse({ cbe: { last8: '12345678' } }).success).toBe(
      false,
    );
    expect(VerificationAccountsUpdateSchema.safeParse({ telebirr: {} }).success).toBe(false);
  });

  it('response schema rejects nulls and inconsistent stored suffixes', () => {
    expect(VerificationAccountsSchema.safeParse({ cbe: { full: null } }).success).toBe(false);
    expect(
      VerificationAccountsSchema.safeParse({
        cbe: { full: '1000123456789', last8: '123' },
      }).success,
    ).toBe(false);
  });
});
