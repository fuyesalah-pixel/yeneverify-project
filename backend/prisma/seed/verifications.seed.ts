import { PrismaClient } from '@prisma/client';
import { IDS } from './ids';
import { log, daysAgo, etbToMinor, fakeOcrText } from './helpers';
import bankRefs from '../fixtures/bank-references.json';

// ── verifications.seed.ts — dev/staging only ─────────────────────────────
// 15 verifications across both merchants:
//   10 VERIFIED TRANSACTION (8 CBE, 1 Telebirr, 1 Awash)
//    2 FAKE
//    1 DUPLICATE (same ref as verification1)
//    1 NEEDS_REVIEW
//    1 ERROR

type BankKey = keyof typeof bankRefs;

function bankRef(bank: BankKey, idx = 0) {
  return (bankRefs[bank] as any[])[idx];
}

export async function seedVerifications(prisma: PrismaClient): Promise<void> {
  const verifs = [
    // ── 10 VERIFIED TRANSACTION ──────────────────────────────────────────
    {
      id: IDS.verification1,  receiptId: IDS.receipt1,  merchantId: IDS.merchant1,
      userId: IDS.subMerchant1User, bank: 'CBE' as BankKey, refIdx: 0,
      source: 'TRANSACTION' as const, status: 'VERIFIED' as const, daysBack: 29,
    },
    {
      id: IDS.verification2,  receiptId: IDS.receipt2,  merchantId: IDS.merchant1,
      userId: IDS.subMerchant1User, bank: 'CBE' as BankKey, refIdx: 1,
      source: 'TRANSACTION' as const, status: 'VERIFIED' as const, daysBack: 27,
    },
    {
      id: IDS.verification3,  receiptId: IDS.receipt3,  merchantId: IDS.merchant1,
      userId: IDS.subMerchant2User, bank: 'TELEBIRR' as BankKey, refIdx: 0,
      source: 'TRANSACTION' as const, status: 'VERIFIED' as const, daysBack: 25,
    },
    {
      id: IDS.verification4,  receiptId: IDS.receipt4,  merchantId: IDS.merchant1,
      userId: IDS.subMerchant2User, bank: 'AWASH' as BankKey, refIdx: 0,
      source: 'TRANSACTION' as const, status: 'VERIFIED' as const, daysBack: 23,
    },
    {
      id: IDS.verification5,  receiptId: IDS.receipt5,  merchantId: IDS.merchant1,
      userId: IDS.merchant1User,     bank: 'CBE' as BankKey, refIdx: 0,
      source: 'TRANSACTION' as const, status: 'VERIFIED' as const, daysBack: 21,
    },
    {
      id: IDS.verification6,  receiptId: IDS.receipt6,  merchantId: IDS.merchant1,
      userId: IDS.subMerchant1User, bank: 'DASHEN' as BankKey, refIdx: 0,
      source: 'TRANSACTION' as const, status: 'VERIFIED' as const, daysBack: 19,
    },
    {
      id: IDS.verification7,  receiptId: IDS.receipt7,  merchantId: IDS.merchant1,
      userId: IDS.subMerchant1User, bank: 'MPESA' as BankKey, refIdx: 0,
      source: 'TRANSACTION' as const, status: 'VERIFIED' as const, daysBack: 17,
    },
    {
      id: IDS.verification8,  receiptId: IDS.receipt8,  merchantId: IDS.merchant1,
      userId: IDS.subMerchant2User, bank: 'ZEMEN' as BankKey, refIdx: 0,
      source: 'TRANSACTION' as const, status: 'VERIFIED' as const, daysBack: 15,
    },
    {
      id: IDS.verification9,  receiptId: IDS.receipt9,  merchantId: IDS.merchant1,
      userId: IDS.merchant1User,    bank: 'ABYSSINIA' as BankKey, refIdx: 0,
      source: 'TRANSACTION' as const, status: 'VERIFIED' as const, daysBack: 12,
    },
    {
      id: IDS.verification10, receiptId: IDS.receipt10, merchantId: IDS.merchant1,
      userId: IDS.subMerchant1User, bank: 'CBE' as BankKey, refIdx: 1,
      source: 'TRANSACTION' as const, status: 'VERIFIED' as const, daysBack: 10,
    },
    // ── 2 FAKE ────────────────────────────────────────────────────────────
    {
      id: IDS.verificationFake1, receiptId: IDS.receipt11, merchantId: IDS.merchant2,
      userId: IDS.merchant2User,     bank: 'CBE' as BankKey, refIdx: 0,
      source: 'TRANSACTION' as const, status: 'FAKE' as const, daysBack: 8,
    },
    {
      id: IDS.verificationFake2, receiptId: IDS.receipt12, merchantId: IDS.merchant2,
      userId: IDS.subMerchant3User,  bank: 'TELEBIRR' as BankKey, refIdx: 0,
      source: 'TRANSACTION' as const, status: 'FAKE' as const, daysBack: 6,
    },
    // ── 1 DUPLICATE ───────────────────────────────────────────────────────
    // Same CBE ref as verification1 → triggers cross-merchant duplicate
    {
      id: IDS.verificationDuplicate, receiptId: IDS.receipt13, merchantId: IDS.merchant2,
      userId: IDS.merchant2User,      bank: 'CBE' as BankKey, refIdx: 0,
      source: 'TRANSACTION' as const, status: 'DUPLICATE' as const, daysBack: 5,
    },
    // ── 1 NEEDS_REVIEW ────────────────────────────────────────────────────
    {
      id: IDS.verificationReview, receiptId: IDS.receipt14, merchantId: IDS.merchant1,
      userId: IDS.merchant1User,   bank: 'DASHEN' as BankKey, refIdx: 0,
      source: 'TRANSACTION' as const, status: 'NEEDS_REVIEW' as const, daysBack: 3,
    },
    // ── 1 ERROR ───────────────────────────────────────────────────────────
    {
      id: IDS.verificationError, receiptId: IDS.receipt15, merchantId: IDS.merchant2,
      userId: IDS.subMerchant3User, bank: 'AWASH' as BankKey, refIdx: 0,
      source: 'TRANSACTION' as const, status: 'ERROR' as const, daysBack: 2,
    },
  ];

  let count = 0;
  for (const v of verifs) {
    const ref = bankRef(v.bank, v.refIdx ?? 0);
    // Fixture dates are documentation only; runtime uses now-relative dates so
    // the dashboard always shows fresh data.
    const paidAt = daysAgo(v.daysBack);
    const completedAt = new Date(paidAt.getTime() + 8000);

    await prisma.verification.upsert({
      where:  { id: v.id },
      create: {
        id:                 v.id,
        merchantId:         v.merchantId,
        verifiedByUserId:   v.userId,
        receiptId:          v.receiptId,
        source:             v.source,
        bankCode:           v.bank as any,
        bankReference:      ref?.reference ?? null,
        referenceNormalized:(ref?.reference ?? '').toUpperCase(),
        amountMinor:        ref ? etbToMinor(ref.amount / 100) : null,
        senderName:         ref?.sender ?? null,
        receiverName:       ref?.receiver ?? null,
        paidAt,
        status:             v.status,
        ocrRawText:         ref ? fakeOcrText({
          bank: v.bank, reference: ref.reference,
          amountEtb: ref.amount / 100,
          sender: ref.sender, receiver: ref.receiver,
          date: paidAt.toISOString(),
        }) : null,
        ocrConfidence:      v.status === 'ERROR' ? null : 0.96,
        adapterMetadata:    { bank: v.bank, seedFixture: true },
        errorCode:          v.status === 'ERROR'    ? 'BANK_TIMEOUT'  : null,
        errorMessage:       v.status === 'ERROR'    ? 'Connection timed out' : null,
        durationMs:         v.status === 'ERROR'    ? null : 7800,
        attemptCount:       v.status === 'ERROR'    ? 2    : 1,
        startedAt:          paidAt,
        completedAt:        completedAt,
        createdAt:          paidAt,
      },
      update: {
        status: v.status,
        paidAt,
        startedAt: paidAt,
        completedAt,
        createdAt: paidAt,
      },
    });
    count++;
  }

  // ── Duplicate fingerprint ─────────────────────────────────────────────
  const dupRef = bankRef('CBE', 0);
  await prisma.duplicateFingerprint.upsert({
    where:  { id: IDS.dupFingerprint1 },
    create: {
      id:                 IDS.dupFingerprint1,
      fingerprint:        `CBE:${dupRef?.reference ?? 'UNKNOWN'}`,
      bankCode:           'CBE',
      bankReference:      dupRef?.reference ?? '',
      firstVerificationId:IDS.verification1,
      firstMerchantId:    IDS.merchant1,
      firstSeenAt:        daysAgo(29),
      totalHits:          2,
    },
    update: { totalHits: 2 },
  });

  log('verifications', count);
  log('duplicate-fingerprints', 1);
}
