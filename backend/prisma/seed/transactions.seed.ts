import { PrismaClient } from '@prisma/client';
import { IDS } from './ids';
import { log, daysAgo, etbToMinor } from './helpers';
import bankRefs from '../fixtures/bank-references.json';

// ── transactions.seed.ts — dev/staging only ───────────────────────────────
// Creates a Transaction row for each VERIFIED TRANSACTION verification.
// Assigns product labels so analytics has real grouping data.
// Some assigned to sub-merchants to test role isolation.

type BankKey = keyof typeof bankRefs;

function ref(bank: BankKey, idx = 0): any {
  return (bankRefs[bank] as any[])[idx];
}

export async function seedTransactions(prisma: PrismaClient): Promise<void> {
  const txns = [
    {
      id: IDS.transaction1, verificationId: IDS.verification1,
      merchantId: IDS.merchant1, subMerchantId: IDS.subMerchant1,
      userId: IDS.subMerchant1User,
      bank: 'CBE' as BankKey, refIdx: 0, daysBack: 29, productLabel: 'Macchiato',
    },
    {
      id: IDS.transaction2, verificationId: IDS.verification2,
      merchantId: IDS.merchant1, subMerchantId: IDS.subMerchant1,
      userId: IDS.subMerchant1User,
      bank: 'CBE' as BankKey, refIdx: 1, daysBack: 27, productLabel: 'Cappuccino',
    },
    {
      id: IDS.transaction3, verificationId: IDS.verification3,
      merchantId: IDS.merchant1, subMerchantId: IDS.subMerchant2,
      userId: IDS.subMerchant2User,
      bank: 'TELEBIRR' as BankKey, refIdx: 0, daysBack: 25, productLabel: 'Croissant',
    },
    {
      id: IDS.transaction4, verificationId: IDS.verification4,
      merchantId: IDS.merchant1, subMerchantId: IDS.subMerchant2,
      userId: IDS.subMerchant2User,
      bank: 'AWASH' as BankKey, refIdx: 0, daysBack: 23, productLabel: 'Lunch Combo',
    },
    {
      id: IDS.transaction5, verificationId: IDS.verification5,
      merchantId: IDS.merchant1, subMerchantId: null,
      userId: IDS.merchant1User,
      bank: 'CBE' as BankKey, refIdx: 0, daysBack: 21, productLabel: 'Macchiato',
    },
    {
      id: IDS.transaction6, verificationId: IDS.verification6,
      merchantId: IDS.merchant1, subMerchantId: IDS.subMerchant1,
      userId: IDS.subMerchant1User,
      bank: 'DASHEN' as BankKey, refIdx: 0, daysBack: 19, productLabel: 'Cappuccino',
    },
    {
      id: IDS.transaction7, verificationId: IDS.verification7,
      merchantId: IDS.merchant1, subMerchantId: IDS.subMerchant1,
      userId: IDS.subMerchant1User,
      bank: 'MPESA' as BankKey, refIdx: 0, daysBack: 17, productLabel: 'Juice',
    },
    {
      id: IDS.transaction8, verificationId: IDS.verification8,
      merchantId: IDS.merchant1, subMerchantId: IDS.subMerchant2,
      userId: IDS.subMerchant2User,
      bank: 'ZEMEN' as BankKey, refIdx: 0, daysBack: 15, productLabel: 'Lunch Combo',
    },
    {
      id: IDS.transaction9, verificationId: IDS.verification9,
      merchantId: IDS.merchant1, subMerchantId: null,
      userId: IDS.merchant1User,
      bank: 'ABYSSINIA' as BankKey, refIdx: 0, daysBack: 12, productLabel: 'Macchiato',
    },
    {
      id: IDS.transaction10, verificationId: IDS.verification10,
      merchantId: IDS.merchant1, subMerchantId: IDS.subMerchant1,
      userId: IDS.subMerchant1User,
      bank: 'CBE' as BankKey, refIdx: 1, daysBack: 10, productLabel: 'Croissant',
    },
  ];

  let count = 0;
  for (const t of txns) {
    const r = ref(t.bank, t.refIdx);
    // Fixture dates are documentation only; runtime uses now-relative dates so
    // the dashboard always shows fresh data.
    const paidAt = daysAgo(t.daysBack);

    await prisma.transaction.upsert({
      where:  { verificationId: t.verificationId },
      create: {
        id:               t.id,
        merchantId:       t.merchantId,
        verificationId:   t.verificationId,
        subMerchantId:    t.subMerchantId,
        verifiedByUserId: t.userId,
        bankCode:         t.bank as any,
        bankReference:    r?.reference ?? `SEED-${t.id.slice(-4)}`,
        amountMinor:      r ? etbToMinor(r.amount / 100) : etbToMinor(50),
        senderName:       r?.sender ?? null,
        receiverName:     r?.receiver ?? null,
        paidAt,
        status:           'VERIFIED',
        productLabel:     t.productLabel,
      },
      update: { productLabel: t.productLabel, paidAt },
    });
    count++;
  }

  log('transactions', count);
}
