import { PrismaClient } from '@prisma/client';
import { IDS } from './ids';
import { log, daysAgo, etbToMinor } from './helpers';
import { newId } from '../../src/common/utils/uuid';

// ── billing.seed.ts — dev/staging only ───────────────────────────────────
// 3 billing verifications:
//   1. APPROVED → merchant 1 BUSINESS activation (links to subscription1)
//   2. PENDING  → merchant 2 upgrading to BUSINESS
//   3. NEEDS_REVIEW → merchant 1 renewal with amount mismatch (900 vs 999)

export async function seedBilling(prisma: PrismaClient): Promise<void> {
  // ── Receipts for billing ───────────────────────────────────────────────
  const billingReceipts = [
    {
      id: IDS.receiptBilling1, merchantId: IDS.merchant1, userId: IDS.merchant1User,
      storageKey: `seed/billing/${IDS.receiptBilling1}.jpg`,
      sha: sha('br1'), daysBack: 16, method: 'UPLOAD' as const,
    },
    {
      id: IDS.receiptBilling2, merchantId: IDS.merchant2, userId: IDS.merchant2User,
      storageKey: `seed/billing/${IDS.receiptBilling2}.jpg`,
      sha: sha('br2'), daysBack: 2, method: 'UPLOAD' as const,
    },
    {
      id: IDS.receiptBilling3, merchantId: IDS.merchant1, userId: IDS.merchant1User,
      storageKey: `seed/billing/${IDS.receiptBilling3}.jpg`,
      sha: sha('br3'), daysBack: 7, method: 'PHOTO' as const,
    },
  ];

  for (const r of billingReceipts) {
    await prisma.receipt.upsert({
      where:  { id: r.id },
      create: {
        id: r.id, merchantId: r.merchantId, uploadedByUserId: r.userId,
        storageKey: r.storageKey, mimeType: 'image/jpeg', sizeBytes: 90000,
        sha256: r.sha, inputMethod: r.method,
        expiresAt: new Date(daysAgo(r.daysBack).getTime() + 90 * 24 * 60 * 60 * 1000),
        createdAt: daysAgo(r.daysBack),
      },
      update: {},
    });
  }

  // ── Verification runs for billing ─────────────────────────────────────
  const billingVerifs = [
    {
      id: IDS.verificationBilling1, receiptId: IDS.receiptBilling1,
      merchantId: IDS.merchant1, userId: IDS.merchant1User,
      bank: 'CBE', ref: 'FT26195DBK5W81465291', amount: etbToMinor(999),
      daysBack: 16, status: 'VERIFIED' as const,
    },
    {
      id: IDS.verificationBilling2, receiptId: IDS.receiptBilling2,
      merchantId: IDS.merchant2, userId: IDS.merchant2User,
      bank: 'TELEBIRR', ref: 'DEV6HKJX7K', amount: etbToMinor(999),
      daysBack: 2, status: 'PENDING' as const,
    },
    {
      id: IDS.verificationBilling3, receiptId: IDS.receiptBilling3,
      merchantId: IDS.merchant1, userId: IDS.merchant1User,
      bank: 'CBE', ref: 'FT26196AAK1X22334455', amount: etbToMinor(900), // wrong amount
      daysBack: 7, status: 'VERIFIED' as const,
    },
  ];

  for (const v of billingVerifs) {
    await prisma.verification.upsert({
      where:  { id: v.id },
      create: {
        id: v.id, merchantId: v.merchantId, verifiedByUserId: v.userId,
        receiptId: v.receiptId, source: 'BILLING',
        bankCode: v.bank as any, bankReference: v.ref, referenceNormalized: v.ref.toUpperCase(),
        amountMinor: v.amount, paidAt: daysAgo(v.daysBack), status: v.status,
        ocrRawText: `Bank: ${v.bank}\nRef: ${v.ref}\nAmount: ETB ${Number(v.amount) / 100}`,
        ocrConfidence: 0.97, attemptCount: 1,
        completedAt: new Date(daysAgo(v.daysBack).getTime() + 7000), durationMs: 6900,
        createdAt: daysAgo(v.daysBack),
      },
      update: { status: v.status },
    });
  }

  // ── BillingVerification rows ───────────────────────────────────────────
  // 1. APPROVED — links subscription, triggers GRANT
  await prisma.billingVerification.upsert({
    where:  { id: IDS.billingVerif1 },
    create: {
      id: IDS.billingVerif1, merchantId: IDS.merchant1, packageCode: 'BUSINESS',
      expectedAmountMinor: etbToMinor(999), submittedAmountMinor: etbToMinor(999),
      senderName: 'Selam Tadesse', receiverName: 'Yene Verify',
      bankCode: 'CBE', bankReference: 'FT26195DBK5W81465291', paidAt: daysAgo(16),
      receiptId: IDS.receiptBilling1, verificationId: IDS.verificationBilling1,
      status: 'APPROVED', subscriptionId: IDS.subscription1,
      reviewedAt: daysAgo(15), reviewNote: 'Auto-approved — amount matches',
    },
    update: { status: 'APPROVED' },
  });

  // GRANT credit transaction for the approved billing
  try {
    await prisma.creditTransaction.create({
      data: {
        id: newId(), merchantId: IDS.merchant1, type: 'GRANT',
        amount: 400n, balanceAfter: 400n,
        billingVerificationId: IDS.billingVerif1,
        subscriptionId: IDS.subscription1,
        reason: 'BUSINESS package activation via billing verification',
        createdAt: daysAgo(15),
      },
    });
  } catch { /* idempotency — immutable table */ }

  // 2. PENDING
  await prisma.billingVerification.upsert({
    where:  { id: IDS.billingVerif2 },
    create: {
      id: IDS.billingVerif2, merchantId: IDS.merchant2, packageCode: 'BUSINESS',
      expectedAmountMinor: etbToMinor(999), submittedAmountMinor: etbToMinor(999),
      senderName: 'Dawit Bekele', receiverName: 'Yene Verify',
      bankCode: 'TELEBIRR', bankReference: 'DEV6HKJX7K', paidAt: daysAgo(2),
      receiptId: IDS.receiptBilling2, verificationId: IDS.verificationBilling2,
      status: 'PENDING',
    },
    update: { status: 'PENDING' },
  });

  // 3. AMOUNT_MISMATCH → NEEDS_REVIEW
  await prisma.billingVerification.upsert({
    where:  { id: IDS.billingVerif3 },
    create: {
      id: IDS.billingVerif3, merchantId: IDS.merchant1, packageCode: 'BUSINESS',
      expectedAmountMinor: etbToMinor(999), submittedAmountMinor: etbToMinor(900),
      senderName: 'Selam Tadesse', receiverName: 'Yene Verify',
      bankCode: 'CBE', bankReference: 'FT26196AAK1X22334455', paidAt: daysAgo(7),
      receiptId: IDS.receiptBilling3, verificationId: IDS.verificationBilling3,
      status: 'AMOUNT_MISMATCH',
    },
    update: { status: 'AMOUNT_MISMATCH' },
  });

  log('billing-verifications', 3);
}

function sha(key: string): string {
  return Buffer.from(`billing-sha-${key}`).toString('hex').padEnd(64, '0').slice(0, 64);
}
