// ============================================================
// Yene Verify — Credits Service Unit Tests
// Repository + audit + prisma are mocked: these assert the
// financial-policy and idempotency logic, not the plumbing.
// ============================================================

import { Test } from '@nestjs/testing';
import { CreditsService } from './credits.service';
import { CreditsRepository } from './credits.repository';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreditGrantInvalidError, CreditsExhaustedError } from './credit-errors';
import { NotFoundError, TenantIsolationError } from '../common/errors/domain-errors';

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111';
const VERIFICATION_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_MERCHANT_ID = '33333333-3333-4333-8333-333333333333';

describe('CreditsService', () => {
  let service: CreditsService;
  let repo: Record<string, jest.Mock>;
  let audit: { log: jest.Mock };
  let prisma: { $transaction: jest.Mock };

  beforeEach(async () => {
    repo = {
      findBalance: jest.fn().mockResolvedValue(10n),
      sumLedgerForMerchant: jest.fn().mockResolvedValue(10n),
      findSubscriptionContext: jest.fn().mockResolvedValue({
        merchantId: MERCHANT_ID,
        subscriptionId: 'sub-1',
        status: 'ACTIVE',
        packageCode: 'BUSINESS',
        unlimited: false,
      }),
      findVerificationForConsume: jest
        .fn()
        .mockResolvedValue({ merchantId: MERCHANT_ID, status: 'VERIFIED' }),
      findConsumptionForVerification: jest.fn().mockResolvedValue(null),
      insertCreditTx: jest.fn().mockImplementation((input: Record<string, unknown>) =>
        Promise.resolve({
          id: `tx-${(globalThis as unknown as { __txSeq: number }).__txSeq}`,
          ...input,
          createdAt: new Date(),
        }),
      ),
      updateCachedBalance: jest.fn().mockResolvedValue(undefined),
      listHistory: jest.fn(),
    };
    audit = { log: jest.fn() };
    prisma = { $transaction: jest.fn() };

    // Auto-increment fake tx ids inside the insert stub.
    (globalThis as unknown as { __txSeq: number }).__txSeq = 0;
    (repo.insertCreditTx as jest.Mock).mockImplementation((input: Record<string, unknown>) => {
      (globalThis as unknown as { __txSeq: number }).__txSeq += 1;
      return Promise.resolve({
        id: `tx-${(globalThis as unknown as { __txSeq: number }).__txSeq}`,
        ...input,
        createdAt: new Date(),
      });
    });

    // The service's runInTx uses $transaction(async fn) when no tx is passed:
    // run the callback immediately (single-arg variant).
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn({ __txMarker: true }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreditsService,
        { provide: CreditsRepository, useValue: repo },
        { provide: AuditService, useValue: audit },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(CreditsService);
  });

  // ── consume: cost policy ────────────────────────────────────────────────

  it('consume VERIFIED → 1 credit, ledger row, new balance decremented', async () => {
    const res = await service.consume({
      merchantId: MERCHANT_ID,
      verificationId: VERIFICATION_ID,
      verificationStatus: 'VERIFIED',
    });

    expect(res.consumed).toBe(1n);
    expect(res.newBalance).toBe(9n);
    expect(res.txId).toBeTruthy();
    expect(repo.insertCreditTx).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CONSUME',
        amount: -1n,
        balanceAfter: 9n,
        verificationId: VERIFICATION_ID,
      }),
      expect.anything(),
    );
    expect(repo.updateCachedBalance).toHaveBeenCalledWith(MERCHANT_ID, 9n, expect.anything());
  });

  it('consume FAKE → 0 credits, no ledger row, balance unchanged', async () => {
    const res = await service.consume({
      merchantId: MERCHANT_ID,
      verificationId: VERIFICATION_ID,
      verificationStatus: 'FAKE',
    });

    expect(res.consumed).toBe(0n);
    expect(res.newBalance).toBe(10n);
    expect(res.txId).toBeNull();
    expect(repo.insertCreditTx).not.toHaveBeenCalled();
  });

  it('consume DUPLICATE → 1 credit (same as VERIFIED)', async () => {
    const res = await service.consume({
      merchantId: MERCHANT_ID,
      verificationId: VERIFICATION_ID,
      verificationStatus: 'DUPLICATE',
    });
    expect(res.consumed).toBe(1n);
    expect(repo.insertCreditTx).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CONSUME', amount: -1n }),
      expect.anything(),
    );
  });

  it('consume ERROR → 0 credits, no ledger row', async () => {
    const res = await service.consume({
      merchantId: MERCHANT_ID,
      verificationId: VERIFICATION_ID,
      verificationStatus: 'ERROR',
    });

    expect(res.consumed).toBe(0n);
    expect(res.txId).toBeNull();
    expect(repo.insertCreditTx).not.toHaveBeenCalled();
  });

  it('consume NEEDS_REVIEW → 0 credits, no ledger row', async () => {
    const res = await service.consume({
      merchantId: MERCHANT_ID,
      verificationId: VERIFICATION_ID,
      verificationStatus: 'NEEDS_REVIEW',
    });

    expect(res.consumed).toBe(0n);
    expect(res.txId).toBeNull();
    expect(repo.insertCreditTx).not.toHaveBeenCalled();
  });

  // ── consume: ownership ──────────────────────────────────────────────────

  it('consume for an unknown verification → NotFoundError', async () => {
    repo.findVerificationForConsume.mockResolvedValue(null);
    await expect(
      service.consume({
        merchantId: MERCHANT_ID,
        verificationId: VERIFICATION_ID,
        verificationStatus: 'VERIFIED',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.insertCreditTx).not.toHaveBeenCalled();
  });

  it('consume for another merchant’s verification → TenantIsolationError', async () => {
    repo.findVerificationForConsume.mockResolvedValue({
      merchantId: OTHER_MERCHANT_ID,
      status: 'VERIFIED',
    });
    await expect(
      service.consume({
        merchantId: MERCHANT_ID,
        verificationId: VERIFICATION_ID,
        verificationStatus: 'VERIFIED',
      }),
    ).rejects.toBeInstanceOf(TenantIsolationError);
    expect(repo.insertCreditTx).not.toHaveBeenCalled();
  });

  // ── consume: unlimited + idempotency + exhaustion ──────────────────────

  it('consume on an unlimited plan → 0 credits, no ledger row, no balance change', async () => {
    repo.findSubscriptionContext.mockResolvedValue({
      merchantId: MERCHANT_ID,
      subscriptionId: 'sub-2',
      status: 'ACTIVE',
      packageCode: 'PREMIUM',
      unlimited: true,
    });

    const res = await service.consume({
      merchantId: MERCHANT_ID,
      verificationId: VERIFICATION_ID,
      verificationStatus: 'VERIFIED',
    });

    expect(res.consumed).toBe(0n);
    expect(res.txId).toBeNull();
    expect(repo.insertCreditTx).not.toHaveBeenCalled();
    expect(repo.updateCachedBalance).not.toHaveBeenCalled();
  });

  it('consume is idempotent: a replayed verificationId returns the existing result and writes NOTHING', async () => {
    const existingRow = {
      id: 'tx-existing',
      merchantId: MERCHANT_ID,
      type: 'CONSUME',
      amount: -1n,
      balanceAfter: 9n,
      verificationId: VERIFICATION_ID,
      createdAt: new Date(),
    };
    repo.findConsumptionForVerification.mockResolvedValue(existingRow);

    const res = await service.consume({
      merchantId: MERCHANT_ID,
      verificationId: VERIFICATION_ID,
      verificationStatus: 'VERIFIED',
    });

    expect(res).toEqual({ consumed: 1n, newBalance: 9n, txId: 'tx-existing' });
    expect(repo.insertCreditTx).not.toHaveBeenCalled();
    // Called once for the idempotency check inside the tx (and NOT again).
    expect(repo.findConsumptionForVerification).toHaveBeenCalledTimes(1);
  });

  it('consume with balance=0 → CreditsExhaustedError (402-shaped)', async () => {
    repo.sumLedgerForMerchant.mockResolvedValue(0n);
    repo.findBalance.mockResolvedValue(0n);

    await expect(
      service.consume({
        merchantId: MERCHANT_ID,
        verificationId: VERIFICATION_ID,
        verificationStatus: 'VERIFIED',
      }),
    ).rejects.toBeInstanceOf(CreditsExhaustedError);
    expect(repo.insertCreditTx).not.toHaveBeenCalled();
  });

  // ── grant ──────────────────────────────────────────────────────────────

  it('grant() → ledger row with the signed amount and updated cache', async () => {
    const res = await service.grant({
      merchantId: MERCHANT_ID,
      amount: 10n,
      type: 'GRANT',
      subscriptionId: 'sub-1',
      reason: 'BUSINESS package activation',
    });

    expect(res.granted).toBe(10n);
    expect(res.newBalance).toBe(20n);
    expect(repo.insertCreditTx).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'GRANT', amount: 10n, balanceAfter: 20n }),
      expect.anything(),
    );
    expect(repo.updateCachedBalance).toHaveBeenCalledWith(MERCHANT_ID, 20n, expect.anything());
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'credits.granted' }));
  });

  it('grant() with amount=0 → CreditGrantInvalidError', async () => {
    await expect(
      service.grant({ merchantId: MERCHANT_ID, amount: 0n, type: 'GRANT' }),
    ).rejects.toBeInstanceOf(CreditGrantInvalidError);
    expect(repo.insertCreditTx).not.toHaveBeenCalled();
  });

  it('grant() with a negative amount → CreditGrantInvalidError', async () => {
    await expect(
      service.grant({ merchantId: MERCHANT_ID, amount: -5n, type: 'ADJUSTMENT' }),
    ).rejects.toBeInstanceOf(CreditGrantInvalidError);
    expect(repo.insertCreditTx).not.toHaveBeenCalled();
  });

  it('grant() of a REFUND keeps the ledger append-only', async () => {
    await service.grant({
      merchantId: MERCHANT_ID,
      amount: 1n,
      type: 'REFUND',
      reason: 'service credit',
    });

    expect(repo.insertCreditTx).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'REFUND', amount: 1n }),
      expect.anything(),
    );
  });

  // ── reconcile ──────────────────────────────────────────────────────────

  it('reconcile with no drift → adjusted=false, no writes', async () => {
    repo.findBalance.mockResolvedValue(10n);
    repo.sumLedgerForMerchant.mockResolvedValue(10n);

    const res = await service.reconcile(MERCHANT_ID);

    expect(res.adjusted).toBe(false);
    expect(res.drift).toBe(0n);
    expect(repo.insertCreditTx).not.toHaveBeenCalled();
  });

  it('reconcile with drift → ADJUSTMENT row inserted, cached balance fixed to the ledger sum', async () => {
    repo.findBalance.mockResolvedValue(10n); // cache says 10
    repo.sumLedgerForMerchant.mockResolvedValue(7n); // ledger says 7

    const res = await service.reconcile(MERCHANT_ID);

    expect(res.adjusted).toBe(true);
    expect(res.drift).toBe(-3n);
    expect(repo.insertCreditTx).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADJUSTMENT',
        amount: -3n,
        balanceAfter: 7n,
        reason: 'reconciliation',
      }),
      expect.anything(),
    );
    expect(repo.updateCachedBalance).toHaveBeenCalledWith(MERCHANT_ID, 7n, expect.anything());
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'credits.reconciled' }),
    );
  });

  it('reconcile with a hung cache (e2e corruption shape: cache high) → drift negative, cache snaps down', async () => {
    repo.findBalance.mockResolvedValue(100n);
    repo.sumLedgerForMerchant.mockResolvedValue(8n);

    const res = await service.reconcile(MERCHANT_ID);

    expect(res.adjusted).toBe(true);
    expect(res.drift).toBe(-92n);
    expect(repo.updateCachedBalance).toHaveBeenCalledWith(MERCHANT_ID, 8n, expect.anything());
  });

  // ── checkSubmissionAllowed ─────────────────────────────────────────────

  it('checkSubmissionAllowed on an unlimited plan → allowed, no low-balance flag', async () => {
    repo.findSubscriptionContext.mockResolvedValue({
      merchantId: MERCHANT_ID,
      subscriptionId: 'sub-2',
      status: 'ACTIVE',
      packageCode: 'PREMIUM',
      unlimited: true,
    });

    const res = await service.checkSubmissionAllowed(MERCHANT_ID);

    expect(res.allowed).toBe(true);
    expect(res.unlimited).toBe(true);
    expect(res.lowBalance).toBe(false);
    expect(res.reason).toBeUndefined();
  });

  it('checkSubmissionAllowed with balance=0 → not allowed, INSUFFICIENT_CREDITS', async () => {
    repo.findBalance.mockResolvedValue(0n);
    repo.sumLedgerForMerchant.mockResolvedValue(0n);
    const res = await service.checkSubmissionAllowed(MERCHANT_ID);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('INSUFFICIENT_CREDITS');
  });

  it('checkSubmissionAllowed with balance=5 → allowed with lowBalance=true', async () => {
    repo.findBalance.mockResolvedValue(5n);
    const res = await service.checkSubmissionAllowed(MERCHANT_ID);
    expect(res.allowed).toBe(true);
    expect(res.lowBalance).toBe(true);
  });

  it('checkSubmissionAllowed with balance=21 → allowed, no low-balance flag (threshold is <= 20)', async () => {
    repo.findBalance.mockResolvedValue(21n);
    const res = await service.checkSubmissionAllowed(MERCHANT_ID);
    expect(res.allowed).toBe(true);
    expect(res.lowBalance).toBe(false);
  });

  it('checkSubmissionAllowed with an EXPIRED subscription → not allowed, SUBSCRIPTION_EXPIRED', async () => {
    repo.findSubscriptionContext.mockResolvedValue({
      merchantId: MERCHANT_ID,
      subscriptionId: 'sub-9',
      status: 'EXPIRED',
      packageCode: 'BUSINESS',
      unlimited: false,
    });

    const res = await service.checkSubmissionAllowed(MERCHANT_ID);

    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('SUBSCRIPTION_EXPIRED');
  });

  // ── getBalance / getHistory ─────────────────────────────────────────────

  it('getBalance returns the cache and unlimited flag', async () => {
    repo.findBalance.mockResolvedValue(390n);
    const res = await service.getBalance(MERCHANT_ID);
    expect(res).toEqual({ balance: 390n, unlimited: false });
  });

  it('getHistory maps rows to stringified DTOs with meta', async () => {
    repo.listHistory.mockResolvedValue({
      rows: [
        {
          id: 'tx-1',
          merchantId: MERCHANT_ID,
          type: 'CONSUME',
          amount: -1n,
          balanceAfter: 399n,
          verificationId: VERIFICATION_ID,
          billingVerificationId: null,
          subscriptionId: null,
          reason: null,
          actorUserId: null,
          createdAt: new Date('2026-10-01T00:00:00Z'),
        },
      ],
      total: 1,
    });

    const res = await service.getHistory(MERCHANT_ID, { page: 1, pageSize: 20 });

    expect(res.meta).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
    expect(res.data[0]).toMatchObject({ amount: '-1', balanceAfter: '399' });
  });

  // ── transaction participation ──────────────────────────────────────────

  it('consume() with an explicit tx uses it instead of opening a new transaction', async () => {
    const callerTx = { __callerTx: true };

    await service.consume(
      { merchantId: MERCHANT_ID, verificationId: VERIFICATION_ID, verificationStatus: 'VERIFIED' },
      callerTx as never,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(repo.insertCreditTx).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CONSUME', amount: -1n }),
      callerTx,
    );
  });
});
