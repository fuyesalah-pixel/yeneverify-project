// ============================================================
// Yene Verify — Shared fixture helpers self-test
//
// One suite (backlog item 23's proof) validating the helpers:
//   - generatePhone stays unique across many calls in-run
//   - createMerchantFixture satisfies all FK chains + DB checks,
//     twice in a row without collision (fresh ids per call)
//   - initialCredits land as an immutable GRANT ledger row with
//     the balance cache coherent
//   - createSubMerchantFixture links ACTIVE into the merchant
//   - createTransactionFixture materializes receipt → verification
//     → transaction with matching fields
//   - resetFixtureState removes only the soft rows, never the
//     immutable ones
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  generatePhone,
  createMerchantFixture,
  createSubMerchantFixture,
  createTransactionFixture,
  resetFixtureState,
} from './index';

jest.setTimeout(120_000);

describe('test/fixtures helpers', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const merchantIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
    await app.init();
    prisma = app.get(PrismaService);
  }, 60_000);

  afterAll(async () => {
    // Soft children go home; user/merchant rows stay (same policy as suites).
    await resetFixtureState(prisma, { userIds, merchantIds });
    await app.close();
  });

  it('generatePhone produces unique valid Ethiopian numbers', () => {
    const phones = new Set<string>(Array.from({ length: 50 }, () => generatePhone()));
    expect(phones.size).toBe(50);
    for (const phone of phones) {
      expect(phone).toMatch(/^\+2519\d{8}$/);
    }
  });

  it('createMerchantFixture creates the full chain — twice without collision', async () => {
    const a = await createMerchantFixture(prisma, { initialCredits: 400 });
    const b = await createMerchantFixture(prisma, { initialCredits: 400 });
    merchantIds.push(a.merchantId, b.merchantId);
    userIds.push(a.userId, b.userId);

    expect(new Set([a.subscriptionId, b.subscriptionId]).size).toBe(2);
    expect(new Set([a.userId, b.userId]).size).toBe(2);

    const user = await prisma.user.findUnique({ where: { id: a.userId } });
    expect(user?.role).toBe('MERCHANT');
    expect(user?.status).toBe('ACTIVE');

    const merchant = await prisma.merchant.findUnique({ where: { id: a.merchantId } });
    expect(merchant?.status).toBe('ACTIVE');
    expect(merchant?.subscriptionId).toBe(a.subscriptionId);
    expect(merchant?.creditsBalance).toBe(400n);

    const subscription = await prisma.subscription.findUnique({
      where: { id: a.subscriptionId },
    });
    expect(subscription?.status).toBe('ACTIVE');
    expect(subscription?.packageCode).toBe('BUSINESS');
    expect(subscription?.expiresAt?.getTime()).toBeGreaterThan(Date.now());

    // Initial credits: fixture must keep the cache reconciled with the ledger.
    const ledger = await prisma.creditTransaction.findMany({
      where: { merchantId: a.merchantId },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe('GRANT');
    expect(ledger[0].amount).toBe(400n);
    expect(ledger[0].balanceAfter).toBe(400n);
  });

  it('createSubMerchantFixture links an ACTIVE team member with a unique phone', async () => {
    const m = await createMerchantFixture(prisma);
    merchantIds.push(m.merchantId);
    userIds.push(m.userId);

    const sub = await createSubMerchantFixture(prisma, {
      merchantId: m.merchantId,
      branchLabel: 'Bole',
    });
    userIds.push(sub.userId);

    const subRow = await prisma.subMerchant.findUnique({ where: { id: sub.subMerchantId } });
    expect(subRow?.merchantId).toBe(m.merchantId);
    expect(subRow?.status).toBe('ACTIVE');
    expect(subRow?.branchLabel).toBe('Bole');

    const user = await prisma.user.findUnique({ where: { id: sub.userId } });
    expect(user?.role).toBe('SUB_MERCHANT');
    expect(user?.phone).toMatch(/^\+2519\d{8}$/);
  });

  it('createTransactionFixture materializes receipt → verification → transaction', async () => {
    const m = await createMerchantFixture(prisma);
    merchantIds.push(m.merchantId);
    userIds.push(m.userId);

    const tx = await createTransactionFixture(prisma, {
      merchantId: m.merchantId,
      verifiedByUserId: m.userId,
      amountMinor: 725_000n,
      productLabel: 'Latte',
    });

    const verification = await prisma.verification.findUnique({
      where: { id: tx.verificationId },
    });
    expect(verification?.status).toBe('VERIFIED');
    expect(verification?.receiptId).toBe(tx.receiptId);

    const row = await prisma.transaction.findUnique({ where: { id: tx.transactionId } });
    expect(row?.amountMinor).toBe(725_000n);
    expect(row?.bankReference).toBe(tx.bankReference);
    expect(row?.productLabel).toBe('Latte');
    expect(row?.paidAt.getTime() ?? 0).not.toBeNaN();
  });

  it('resetFixtureState clears soft rows for a given scope and skips the ledger', async () => {
    const m = await createMerchantFixture(prisma, { initialCredits: 10, withDevice: true });
    merchantIds.push(m.merchantId);
    userIds.push(m.userId);

    await createTransactionFixture(prisma, {
      merchantId: m.merchantId,
      verifiedByUserId: m.userId,
    });

    await resetFixtureState(prisma, {
      userIds: [m.userId],
      merchantIds: [m.merchantId],
    });

    expect(await prisma.device.count({ where: { userId: m.userId } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: m.userId } })).toBe(0);
    expect(await prisma.transaction.count({ where: { merchantId: m.merchantId } })).toBe(0);
    expect(await prisma.verification.count({ where: { merchantId: m.merchantId } })).toBe(0);
    expect(await prisma.receipt.count({ where: { merchantId: m.merchantId } })).toBe(0);

    // Immutable tables untouched.
    const merchant = await prisma.merchant.findUnique({ where: { id: m.merchantId } });
    expect(merchant).not.toBeNull();
    expect(await prisma.creditTransaction.count({ where: { merchantId: m.merchantId } })).toBe(1);
  });
});
