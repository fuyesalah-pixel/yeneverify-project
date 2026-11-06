// ============================================================
// Yene Verify — VerificationAccounts unit tests (Part 0)
//
// Covers the three pure functions that keep the settings payload,
// stored JSON, and adapter supplementary fields in sync.
// ============================================================

import {
  buildSupplementaryData,
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

  it('keeps a valid stored object', () => {
    expect(
      normalizeVerificationAccounts({
        cbe: { last8: '12345678' },
        awash: { accountNumber: '0123456789' },
      }),
    ).toEqual({
      cbe: { last8: '12345678' },
      awash: { accountNumber: '0123456789' },
    });
  });
});

describe('mergeVerificationAccounts', () => {
  const current = {
    cbe: { last8: '11111111' },
    abyssinia: { last5: '22222' },
    awash: { accountNumber: '3333333333' },
  };

  it('merges only the supplied banks', () => {
    expect(mergeVerificationAccounts(current, { cbe: { last8: '99999999' } })).toEqual({
      cbe: { last8: '99999999' },
      abyssinia: { last5: '22222' },
      awash: { accountNumber: '3333333333' },
    });
  });

  it('clears a field with null without touching the bank siblings', () => {
    expect(mergeVerificationAccounts(current, { cbe: { last8: null } })).toEqual({
      abyssinia: { last5: '22222' },
      awash: { accountNumber: '3333333333' },
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

  it('drops fields that were never configured when a bank object is empty', () => {
    expect(mergeVerificationAccounts({}, { cbe: { last8: '12345678' } })).toEqual({
      cbe: { last8: '12345678' },
    });
  });
});

describe('buildSupplementaryData', () => {
  const accounts = {
    cbe: { last8: '12345678' },
    abyssinia: { last5: '54321' },
    awash: { accountNumber: '0123456789' },
  };

  it('maps CBE to accountSuffix', () => {
    expect(buildSupplementaryData('CBE', accounts)).toEqual({
      accountSuffix: '12345678',
    });
  });

  it('maps Abyssinia to accountSuffix (the adapter field)', () => {
    expect(buildSupplementaryData('ABYSSINIA', accounts)).toEqual({
      accountSuffix: '54321',
    });
  });

  it('maps Awash to accountNumber', () => {
    expect(buildSupplementaryData('AWASH', accounts)).toEqual({
      accountNumber: '0123456789',
    });
  });

  it('returns {} for unconfigured or unsupported banks', () => {
    expect(buildSupplementaryData('ABYSSINIA', {})).toEqual({});
    expect(buildSupplementaryData('TELEBIRR', accounts)).toEqual({});
    expect(buildSupplementaryData('CBE', null)).toEqual({});
  });
});

describe('verification accounts validation', () => {
  it('exposes the three supported banks with their digit patterns', () => {
    expect(SUPPORTED_VERIFICATION_BANKS.map((b) => b.bankCode)).toEqual([
      'CBE',
      'ABYSSINIA',
      'AWASH',
    ]);
    expect(SUPPORTED_VERIFICATION_BANKS[0].fields[0]).toMatchObject({
      key: 'last8',
      minLength: 8,
      maxLength: 8,
    });
    expect(SUPPORTED_VERIFICATION_BANKS[1].fields[0]).toMatchObject({
      key: 'last5',
      minLength: 5,
      maxLength: 5,
    });
    expect(SUPPORTED_VERIFICATION_BANKS[2].fields[0]).toMatchObject({
      key: 'accountNumber',
      minLength: 10,
      maxLength: 16,
    });
  });

  it('accepts valid partial updates', () => {
    expect(
      VerificationAccountsUpdateSchema.safeParse({
        cbe: { last8: '12345678' },
        abyssinia: { last5: null },
        awash: { accountNumber: '0123456789' },
      }).success,
    ).toBe(true);
  });

  it('rejects wrong digit counts', () => {
    expect(VerificationAccountsUpdateSchema.safeParse({ cbe: { last8: '1234567' } }).success).toBe(
      false,
    );
    expect(
      VerificationAccountsUpdateSchema.safeParse({
        abyssinia: { last5: '123456' },
      }).success,
    ).toBe(false);
    expect(
      VerificationAccountsUpdateSchema.safeParse({
        awash: { accountNumber: '123456789' },
      }).success,
    ).toBe(false);
    expect(
      VerificationAccountsUpdateSchema.safeParse({
        awash: { accountNumber: '12345678901234567' },
      }).success,
    ).toBe(false);
  });

  it('rejects non-digits and unknown keys', () => {
    expect(VerificationAccountsUpdateSchema.safeParse({ cbe: { last8: '1234abcd' } }).success).toBe(
      false,
    );
    expect(VerificationAccountsUpdateSchema.safeParse({ telebirr: {} }).success).toBe(false);
    expect(VerificationAccountsUpdateSchema.safeParse({ cbe: { last5: '12345' } }).success).toBe(
      false,
    );
  });

  it('response schema rejects nulls (stored values are always concrete)', () => {
    expect(VerificationAccountsSchema.safeParse({ cbe: { last8: null } }).success).toBe(false);
  });
});
