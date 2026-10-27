// ============================================================
// Yene Verify — Credits Repository Unit Tests
// Asserts every method delegates to the provided Prisma
// TransactionClient when one is passed, falls back to the default
// client otherwise, and honors pagination.
// (Typed as `any` shims deliberately: these are structural mocks of
// the Prisma delegate tree, not domain objects.)
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import { CreditsRepository } from './credits.repository';
import { PrismaService } from '../prisma/prisma.service';

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111';
const VERIFICATION_ID = '22222222-2222-4222-8222-222222222222';

/** A stubbed Prisma delegate tree matching the shape the repo touches. */
function makeClient(): any {
  return {
    merchant: { findUnique: jest.fn(), update: jest.fn() },
    creditTransaction: {
      aggregate: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    subscription: { findFirst: jest.fn() },
    verification: { findUnique: jest.fn() },
  };
}

describe('CreditsRepository', () => {
  let repo: CreditsRepository;
  let prisma: any; // the default (no-tx) client
  let tx: any; // the transaction-scoped client

  beforeEach(() => {
    prisma = makeClient();
    tx = makeClient();
    repo = new CreditsRepository(prisma as PrismaService);
  });

  it('findBalance reads the provided tx, not the default client', async () => {
    tx.merchant.findUnique.mockResolvedValue({ creditsBalance: 390n });

    await expect(repo.findBalance(MERCHANT_ID, tx)).resolves.toBe(390n);
    expect(prisma.merchant.findUnique).not.toHaveBeenCalled();
    expect(tx.merchant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: MERCHANT_ID } }),
    );
  });

  it('findBalance without a tx reads the default client and defaults to 0n', async () => {
    prisma.merchant.findUnique.mockResolvedValue(null);
    await expect(repo.findBalance(MERCHANT_ID)).resolves.toBe(0n);
    expect(prisma.merchant.findUnique).toHaveBeenCalled();
  });

  it('sumLedgerForMerchant aggregates _sum.amount through the tx', async () => {
    tx.creditTransaction.aggregate.mockResolvedValue({ _sum: { amount: 12n } });
    await expect(repo.sumLedgerForMerchant(MERCHANT_ID, tx)).resolves.toBe(12n);
    expect(prisma.creditTransaction.aggregate).not.toHaveBeenCalled();

    tx.creditTransaction.aggregate.mockResolvedValue({ _sum: { amount: null } });
    await expect(repo.sumLedgerForMerchant(MERCHANT_ID, tx)).resolves.toBe(0n); // empty ledger

    // ADJUSTMENT rows are audit records of cache corrections, never
    // balance entries — the sum must exclude them or every reconcile
    // would shift the sum it just measured.
    expect(tx.creditTransaction.aggregate).toHaveBeenCalledWith({
      where: { merchantId: MERCHANT_ID, type: { not: 'ADJUSTMENT' } },
      _sum: { amount: true },
    });
  });

  it('findSubscriptionContext maps the package unlimited flag', async () => {
    tx.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      merchantId: MERCHANT_ID,
      status: 'ACTIVE',
      packageCode: 'PREMIUM',
      package: { unlimited: true },
    });

    const ctx = await repo.findSubscriptionContext(MERCHANT_ID, tx);

    expect(ctx).toMatchObject({ subscriptionId: 'sub-1', packageCode: 'PREMIUM', unlimited: true });
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();

    prisma.subscription.findFirst.mockResolvedValue(null);
    await expect(repo.findSubscriptionContext(MERCHANT_ID)).resolves.toBeNull();
  });

  it('findConsumptionForVerification filters by type CONSUME on the tx', async () => {
    tx.creditTransaction.findFirst.mockResolvedValue({ id: 'tx-x' });
    await repo.findConsumptionForVerification(VERIFICATION_ID, tx);
    expect(tx.creditTransaction.findFirst).toHaveBeenCalledWith({
      where: { verificationId: VERIFICATION_ID, type: 'CONSUME' },
      orderBy: { createdAt: 'asc' },
    });
    expect(prisma.creditTransaction.findFirst).not.toHaveBeenCalled();
  });

  it('findVerificationForConsume selects only the ownership + status columns', async () => {
    tx.verification.findUnique.mockResolvedValue({ merchantId: MERCHANT_ID, status: 'VERIFIED' });
    const res = await repo.findVerificationForConsume(VERIFICATION_ID, tx);
    expect(res).toEqual({ merchantId: MERCHANT_ID, status: 'VERIFIED' });
    expect(tx.verification.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VERIFICATION_ID },
        select: { merchantId: true, status: true },
      }),
    );
  });

  it('insertCreditTx generates an id and never writes beyond the append-only columns', async () => {
    tx.creditTransaction.create.mockResolvedValue({ id: 'tx-new' });

    await repo.insertCreditTx(
      {
        merchantId: MERCHANT_ID,
        type: 'CONSUME',
        amount: -1n,
        balanceAfter: 389n,
        reason: 'Verification VERIFIED',
      },
      tx,
    );

    const arg = tx.creditTransaction.create.mock.calls[0][0];
    expect(arg.data).toMatchObject({
      merchantId: MERCHANT_ID,
      type: 'CONSUME',
      amount: -1n,
      balanceAfter: 389n,
    });
    expect(arg.data.id).toEqual(expect.any(String));
    expect(arg.data.verificationId).toBeNull();
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
  });

  it('updateCachedBalance writes credits_balance + credits_updated_at on the tx', async () => {
    await repo.updateCachedBalance(MERCHANT_ID, 389n, tx);
    expect(tx.merchant.update).toHaveBeenCalledWith({
      where: { id: MERCHANT_ID },
      data: { creditsBalance: 389n, creditsUpdatedAt: expect.any(Date) },
    });
    expect(prisma.merchant.update).not.toHaveBeenCalled();
  });

  it('listHistory applies page/pageSize and reports the total', async () => {
    tx.creditTransaction.findMany.mockResolvedValue([{ id: 'tx-1' }]);
    tx.creditTransaction.count.mockResolvedValue(41);

    const res = await repo.listHistory(
      MERCHANT_ID,
      { page: 3, pageSize: 20, sortOrder: 'desc' },
      tx,
    );

    expect(res.rows).toEqual([{ id: 'tx-1' }]);
    expect(res.total).toBe(41);
    expect(tx.creditTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20, orderBy: { createdAt: 'desc' } }),
    );
    expect(tx.creditTransaction.count).toHaveBeenCalledWith({ where: { merchantId: MERCHANT_ID } });
  });
});
