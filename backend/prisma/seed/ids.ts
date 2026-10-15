// ============================================================
// Yene Verify — Fixed Seed IDs & Phones
//
// Every known seed entity has a deterministic UUID v7-format string.
// These are hand-authored constants — never random.
// Changing any value here requires:
//   1. Updating docs/ops/dev-fixtures.md
//   2. Updating any test that depends on the old ID
//   3. Running `npm run db:reset:seed` to apply the change
//
// Format: valid UUID v7 structure (time nibble = 7, variant nibble = 8-b)
// The timestamp portion is fixed at 2026-09-24 00:00:00 UTC (018f8c1a-0000)
// ============================================================

export const IDS = {
  // ── Users ──────────────────────────────────────────────────────────────
  adminUser:        '018f8c1a-0000-7000-8000-000000000001',

  merchant1User:    '018f8c1a-0000-7000-8000-000000000010',
  merchant2User:    '018f8c1a-0000-7000-8000-000000000020',

  subMerchant1User: '018f8c1a-0000-7000-8000-000000000030',
  subMerchant2User: '018f8c1a-0000-7000-8000-000000000031',
  subMerchant3User: '018f8c1a-0000-7000-8000-000000000032',

  // ── Merchants ──────────────────────────────────────────────────────────
  merchant1:        '018f8c1a-0000-7000-8000-000000000011',
  merchant2:        '018f8c1a-0000-7000-8000-000000000021',

  // ── Sub-merchants ──────────────────────────────────────────────────────
  subMerchant1:     '018f8c1a-0000-7000-8000-000000000040',
  subMerchant2:     '018f8c1a-0000-7000-8000-000000000041',
  subMerchant3:     '018f8c1a-0000-7000-8000-000000000042',

  // ── Subscriptions ──────────────────────────────────────────────────────
  subscription1:    '018f8c1a-0000-7000-8000-000000000050',
  subscription2:    '018f8c1a-0000-7000-8000-000000000051',

  // ── Credit transactions (GRANTs only — CONSUMEs use newId()) ──────────
  creditGrant1:     '018f8c1a-0000-7000-8000-000000000060',
  creditGrant2:     '018f8c1a-0000-7000-8000-000000000061',

  // ── Receipts ───────────────────────────────────────────────────────────
  receipt1:         '018f8c1a-0000-7000-8000-000000000070',
  receipt2:         '018f8c1a-0000-7000-8000-000000000071',
  receipt3:         '018f8c1a-0000-7000-8000-000000000072',
  receipt4:         '018f8c1a-0000-7000-8000-000000000073',
  receipt5:         '018f8c1a-0000-7000-8000-000000000074',
  receipt6:         '018f8c1a-0000-7000-8000-000000000075',
  receipt7:         '018f8c1a-0000-7000-8000-000000000076',
  receipt8:         '018f8c1a-0000-7000-8000-000000000077',
  receipt9:         '018f8c1a-0000-7000-8000-000000000078',
  receipt10:        '018f8c1a-0000-7000-8000-000000000079',
  receipt11:        '018f8c1a-0000-7000-8000-00000000007a',
  receipt12:        '018f8c1a-0000-7000-8000-00000000007b',
  receipt13:        '018f8c1a-0000-7000-8000-00000000007c',
  receipt14:        '018f8c1a-0000-7000-8000-00000000007d',
  receipt15:        '018f8c1a-0000-7000-8000-00000000007e',
  receiptBilling1:  '018f8c1a-0000-7000-8000-0000000000b1',
  receiptBilling2:  '018f8c1a-0000-7000-8000-0000000000b2',
  receiptBilling3:  '018f8c1a-0000-7000-8000-0000000000b3',

  // ── Verifications ──────────────────────────────────────────────────────
  verification1:    '018f8c1a-0000-7000-8000-000000000080',
  verification2:    '018f8c1a-0000-7000-8000-000000000081',
  verification3:    '018f8c1a-0000-7000-8000-000000000082',
  verification4:    '018f8c1a-0000-7000-8000-000000000083',
  verification5:    '018f8c1a-0000-7000-8000-000000000084',
  verification6:    '018f8c1a-0000-7000-8000-000000000085',
  verification7:    '018f8c1a-0000-7000-8000-000000000086',
  verification8:    '018f8c1a-0000-7000-8000-000000000087',
  verification9:    '018f8c1a-0000-7000-8000-000000000088',
  verification10:   '018f8c1a-0000-7000-8000-000000000089',
  verificationFake1:     '018f8c1a-0000-7000-8000-00000000008a',
  verificationFake2:     '018f8c1a-0000-7000-8000-00000000008b',
  verificationDuplicate: '018f8c1a-0000-7000-8000-00000000008c',
  verificationReview:    '018f8c1a-0000-7000-8000-00000000008d',
  verificationError:     '018f8c1a-0000-7000-8000-00000000008e',
  verificationBilling1:  '018f8c1a-0000-7000-8000-0000000000c1',
  verificationBilling2:  '018f8c1a-0000-7000-8000-0000000000c2',
  verificationBilling3:  '018f8c1a-0000-7000-8000-0000000000c3',

  // ── Transactions ───────────────────────────────────────────────────────
  transaction1:     '018f8c1a-0000-7000-8000-000000000090',
  transaction2:     '018f8c1a-0000-7000-8000-000000000091',
  transaction3:     '018f8c1a-0000-7000-8000-000000000092',
  transaction4:     '018f8c1a-0000-7000-8000-000000000093',
  transaction5:     '018f8c1a-0000-7000-8000-000000000094',
  transaction6:     '018f8c1a-0000-7000-8000-000000000095',
  transaction7:     '018f8c1a-0000-7000-8000-000000000096',
  transaction8:     '018f8c1a-0000-7000-8000-000000000097',
  transaction9:     '018f8c1a-0000-7000-8000-000000000098',
  transaction10:    '018f8c1a-0000-7000-8000-000000000099',

  // ── Billing verifications ──────────────────────────────────────────────
  billingVerif1:    '018f8c1a-0000-7000-8000-0000000000d1',
  billingVerif2:    '018f8c1a-0000-7000-8000-0000000000d2',
  billingVerif3:    '018f8c1a-0000-7000-8000-0000000000d3',

  // ── Duplicate fingerprint ──────────────────────────────────────────────
  dupFingerprint1:  '018f8c1a-0000-7000-8000-0000000000e1',

  // ── Reviews ────────────────────────────────────────────────────────────
  review1:          '018f8c1a-0000-7000-8000-0000000000f1',
  review2:          '018f8c1a-0000-7000-8000-0000000000f2',
} as const;

export type SeedId = keyof typeof IDS;

// ── Phone numbers ─────────────────────────────────────────────────────────
// All Ethiopian E.164 format. Deterministic.
export const PHONES = {
  admin:          '+251900000001',
  merchant1:      '+251911111111',
  merchant2:      '+251922222222',
  subMerchant1:   '+251933333331',
  subMerchant2:   '+251933333332',
  subMerchant3:   '+251933333333',
} as const;

export type SeedPhone = keyof typeof PHONES;
