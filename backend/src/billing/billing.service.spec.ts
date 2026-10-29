// ============================================================
// Yene Verify — BillingService Unit Tests (Step 16)
//
// The money-in state machine is exhaustively exercised in isolation:
// initiation guards, submission guards, and every verdict branch of
// handleVerificationResult. The transaction path is driven by giving
// $transaction a fully-mocked TransactionClient so the approval writes
// (subscription create/extend/replace, ledger grant, billing flip) are
// all observable without a database.
// ============================================================

import {
  BillingSessionNotFoundError,
  BillingSessionNotPendingError,
} from '../common/errors/domain-errors';
import { ERROR_CODES } from '../common/constants/error-codes';
import { BillingService } from './billing.service';
import type { BillingRepository, BillingSessionRow } from './billing.repository';
import type { PrismaService } from '../prisma/prisma.service';
import type { CreditsService } from '../credits/credits.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { AuditService } from '../audit/audit.service';
import type { AppConfigService } from '../config/config.service';
import type { VerificationQueueService } from '../verification/queue/verification-queue.service';

// ── Fixtures ─────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<BillingSessionRow> = {}): BillingSessionRow {
  return {
    id: 'bill-1',
    merchantId: 'merch-77',
    packageCode: 'BUSINESS',
    expectedAmountMinor: 99900n,
    submittedAmountMinor: null,
    senderName: null,
    receiverName: null,
    bankCode: null,
    bankReference: null,
    paidAt: null,
    receiptId: null,
    verificationId: null,
    status: 'PENDING',
    reviewerUserId: null,
    reviewedAt: null,
    reviewNote: null,
    subscriptionId: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...overrides,
  } as BillingSessionRow;
}

function verdict(
  overrides: Partial<Parameters<BillingService['handleVerificationResult']>[1]> = {},
) {
  return {
    status: 'VERIFIED' as const,
    amountMinor: 99900n,
    bankCode: 'TEST_BANK',
    bankReference: 'TKOK123',
    senderName: 'E2E Sender',
    receiverName: 'Yene Verify',
    paidAt: new Date('2026-10-20T10:00:00Z'),
    errorCode: null,
    errorMessage: null,
    ...overrides,
  };
}

const BUSINESS_PACKAGE = {
  code: 'BUSINESS',
  name: 'Business',
  priceMinor: 99900n,
  creditsPerMonth: 400,
  unlimited: false,
  active: true,
};

const PREMIUM_PACKAGE = {
  code: 'PREMIUM',
  name: 'Premium',
  priceMinor: 99900n,
  creditsPerMonth: null,
  unlimited: true,
  active: true,
};

// ── Harness ──────────────────────────────────────────────────────────────

describe('BillingService', () => {
  let service: BillingService;

  const prismaMock = {
    package: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    receipt: { findFirst: jest.fn() },
    verification: { create: jest.fn() },
    merchant: { update: jest.fn() },
    billingVerification: { updateMany: jest.fn(), update: jest.fn() },
    subscription: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const repoMock = {
    createSession: jest.fn(),
    findById: jest.fn(),
    findByIdAny: jest.fn(),
    findByVerificationId: jest.fn(),
    findReceiptUse: jest.fn(),
    linkSubmission: jest.fn(),
    recordVerifiedFacts: jest.fn(),
    recordOutcome: jest.fn(),
    findOwnerUserId: jest.fn(),
    list: jest.fn(),
  };
  const creditsMock = { grant: jest.fn() };
  const notificationsMock = { notify: jest.fn().mockResolvedValue({ notificationId: 'n1' }) };
  const auditMock = { log: jest.fn() };
  const queueMock = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const configMock = {
    payment: {
      accountName: 'Yene Verify',
      destinationCbe: '1000123456789',
      destinationTelebirr: '+251911000111',
      instructionsNote: 'Pay the exact amount.',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    auditMock.log.mockResolvedValue(undefined);
    repoMock.findOwnerUserId.mockResolvedValue('user-owner');
    repoMock.recordOutcome.mockResolvedValue(true);
    repoMock.recordVerifiedFacts.mockResolvedValue(undefined);
    prismaMock.billingVerification.updateMany.mockResolvedValue({ count: 1 });
    creditsMock.grant.mockResolvedValue({ granted: 400n, newBalance: 405n, txId: 'tx-1' });
    service = new BillingService(
      prismaMock as unknown as PrismaService,
      repoMock as unknown as BillingRepository,
      creditsMock as unknown as CreditsService,
      notificationsMock as unknown as NotificationsService,
      auditMock as unknown as AuditService,
      configMock as unknown as AppConfigService,
      queueMock as unknown as VerificationQueueService,
    );
  });

  // ── initiate() ─────────────────────────────────────────────────────────

  describe('initiate()', () => {
    it('creates a PENDING session with the package price and returns instructions', async () => {
      prismaMock.package.findUnique.mockResolvedValue(BUSINESS_PACKAGE);
      repoMock.createSession.mockResolvedValue(makeRow({ id: 'bill-new' }));

      const out = await service.initiate({
        merchantId: 'merch-77',
        userId: 'user-owner',
        dto: { packageCode: 'BUSINESS' },
      });

      expect(repoMock.createSession).toHaveBeenCalledWith({
        merchantId: 'merch-77',
        packageCode: 'BUSINESS',
        expectedAmountMinor: 99900n,
      });
      expect(out.billingSessionId).toBe('bill-new');
      expect(out.expectedAmountMinor).toBe('99900');
      expect(out.currency).toBe('ETB');
      expect(out.instructions.cbe).toEqual({
        accountNumber: '1000123456789',
        accountName: 'Yene Verify',
      });
      expect(out.instructions.telebirr.phoneNumber).toBe('+251911000111');
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'billing.initiated',
          targetType: 'billing_verification',
          targetId: 'bill-new',
        }),
      );
    });

    it('rejects FREE (auto-provisioned at onboarding) without opening a session', async () => {
      prismaMock.package.findUnique.mockResolvedValue({
        code: 'FREE',
        name: 'Free',
        priceMinor: 0n,
        creditsPerMonth: 10,
        unlimited: false,
        active: true,
      });

      await expect(
        service.initiate({ merchantId: 'm', userId: 'u', dto: { packageCode: 'FREE' } }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.BILLING_PACKAGE_NOT_PURCHASABLE,
        httpStatus: 400,
      });

      expect(repoMock.createSession).not.toHaveBeenCalled();
    });

    it('rejects an unknown package with 404', async () => {
      prismaMock.package.findUnique.mockResolvedValue(null);

      await expect(
        service.initiate({ merchantId: 'm', userId: 'u', dto: { packageCode: 'PREMIUM' } }),
      ).rejects.toMatchObject({ code: ERROR_CODES.BILLING_PACKAGE_NOT_FOUND, httpStatus: 404 });
    });

    it('rejects a package with no price configured', async () => {
      prismaMock.package.findUnique.mockResolvedValue({
        code: 'API',
        name: 'API',
        priceMinor: null,
        creditsPerMonth: null,
        unlimited: false,
        active: true,
      });

      await expect(
        service.initiate({ merchantId: 'm', userId: 'u', dto: { packageCode: 'PREMIUM' } }),
      ).rejects.toMatchObject({ code: ERROR_CODES.BILLING_PACKAGE_NOT_PURCHASABLE });
    });
  });

  // ── submit() ───────────────────────────────────────────────────────────

  describe('submit()', () => {
    const baseInput = {
      user: { id: 'user-owner', role: 'MERCHANT' } as never,
      merchantId: 'merch-77',
      dto: { billingSessionId: 'bill-1', receiptId: 'receipt-9' },
    };

    beforeEach(() => {
      prismaMock.verification.create.mockResolvedValue({ id: null });
      repoMock.linkSubmission.mockResolvedValue(true);
      prismaMock.receipt.findFirst.mockResolvedValue({ id: 'receipt-9' });
      repoMock.findReceiptUse.mockResolvedValue(null);
    });

    it('creates the source=BILLING verification, links it, and enqueues the job', async () => {
      repoMock.findById.mockResolvedValue(makeRow());
      prismaMock.verification.create.mockResolvedValue({ id: 'ver-new' });
      repoMock.linkSubmission.mockResolvedValue(true);

      const out = await service.submit(baseInput);

      expect(prismaMock.verification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            merchantId: 'merch-77',
            verifiedByUserId: 'user-owner',
            receiptId: 'receipt-9',
            source: 'BILLING',
            status: 'PENDING',
          }),
        }),
      );
      expect(repoMock.linkSubmission).toHaveBeenCalledWith({
        billingSessionId: 'bill-1',
        receiptId: 'receipt-9',
        verificationId: expect.any(String),
      });
      expect(queueMock.enqueue).toHaveBeenCalledWith(expect.any(String));
      expect(out).toEqual(
        expect.objectContaining({
          billingVerificationId: 'bill-1',
          verificationId: expect.any(String),
          status: 'PENDING',
        }),
      );
    });

    it('rejects an unknown or foreign-tenant session', async () => {
      repoMock.findById.mockResolvedValue(null);
      await expect(service.submit(baseInput)).rejects.toBeInstanceOf(BillingSessionNotFoundError);
      expect(queueMock.enqueue).not.toHaveBeenCalled();
    });

    it('rejects a session that already left PENDING', async () => {
      repoMock.findById.mockResolvedValue(makeRow({ status: 'APPROVED' }));
      await expect(service.submit(baseInput)).rejects.toBeInstanceOf(BillingSessionNotPendingError);
      expect(prismaMock.verification.create).not.toHaveBeenCalled();
    });

    it('rejects a receipt that does not belong to the tenant', async () => {
      repoMock.findById.mockResolvedValue(makeRow());
      prismaMock.receipt.findFirst.mockResolvedValue(null);
      await expect(service.submit(baseInput)).rejects.toMatchObject({
        code: ERROR_CODES.RECEIPT_NOT_FOUND,
        httpStatus: 404,
      });
    });

    it('rejects a receipt already used by another billing session', async () => {
      repoMock.findById.mockResolvedValue(makeRow());
      repoMock.findReceiptUse.mockResolvedValue(makeRow({ id: 'bill-other' }));
      await expect(service.submit(baseInput)).rejects.toMatchObject({
        code: ERROR_CODES.BILLING_RECEIPT_ALREADY_USED,
        httpStatus: 409,
      });
      expect(prismaMock.verification.create).not.toHaveBeenCalled();
    });

    it('rejects when the guarded link loses the race (verdict already landed)', async () => {
      repoMock.findById.mockResolvedValue(makeRow());
      repoMock.linkSubmission.mockResolvedValue(false);
      await expect(service.submit(baseInput)).rejects.toBeInstanceOf(BillingSessionNotPendingError);
      expect(queueMock.enqueue).not.toHaveBeenCalled();
    });
  });

  // ── handleVerificationResult() ─────────────────────────────────────────

  describe('handleVerificationResult()', () => {
    describe('VERIFIED → exact amount', () => {
      beforeEach(() => {
        prismaMock.package.findUniqueOrThrow.mockResolvedValue(BUSINESS_PACKAGE);
        prismaMock.subscription.findFirst.mockResolvedValue(null);
        prismaMock.subscription.create.mockResolvedValue({ id: 'sub-new' });
        prismaMock.merchant.update.mockResolvedValue({});
        prismaMock.billingVerification.update.mockResolvedValue({});
        prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
          fn(txOf(prismaMock)),
        );
        repoMock.findByIdAny.mockResolvedValue(makeRow());
      });

      it('creates a subscription, grants 400 credits, flips to APPROVED and notifies', async () => {
        await service.handleVerificationResult('bill-1', verdict({}));

        expect(repoMock.recordVerifiedFacts).toHaveBeenCalledWith(
          'bill-1',
          expect.objectContaining({ submittedAmountMinor: 99900n }),
        );
        expect(creditsMock.grant).toHaveBeenCalledTimes(1);
        const grantCall = creditsMock.grant.mock.calls[0];
        expect(grantCall[0]).toMatchObject({
          merchantId: 'merch-77',
          amount: 400n,
          type: 'GRANT',
          subscriptionId: 'sub-new',
          billingVerificationId: 'bill-1',
        });
        expect(prismaMock.subscription.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              packageCode: 'BUSINESS',
              status: 'ACTIVE',
              autoRenew: false,
            }),
          }),
        );
        expect(prismaMock.merchant.update).toHaveBeenCalledWith({
          where: { id: 'merch-77' },
          data: { subscriptionId: 'sub-new', currentPackageCode: 'BUSINESS' },
        });
        expect(prismaMock.billingVerification.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'bill-1' },
            data: expect.objectContaining({
              status: 'APPROVED',
              subscriptionId: 'sub-new',
            }),
          }),
        );
        // 25+ subscribed sanity: mock returns 400 granted → notify body count
        expect(notificationsMock.notify).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-owner',
            type: 'BILLING_APPROVED',
            body: expect.stringContaining('400 credits'),
          }),
        );
        expect(auditMock.log).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'billing.approved', targetId: 'bill-1' }),
        );
      });

      it('extends an existing same-package subscription and still grants the allotment', async () => {
        const activeSub = {
          id: 'sub-active',
          packageCode: 'BUSINESS',
          status: 'ACTIVE' as never,
          expiresAt: new Date(Date.now() + 5 * 86_400_000),
        };
        prismaMock.subscription.findFirst.mockResolvedValue(activeSub);
        prismaMock.subscription.update.mockResolvedValue({});

        await service.handleVerificationResult('bill-1', verdict({}));

        expect(prismaMock.subscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'sub-active' },
            data: expect.objectContaining({
              status: 'ACTIVE',
              expiresAt: expect.any(Date),
            }),
          }),
        );
        // Decision (Watch #3): each approved billing grants the allotment
        // immediately — two same-month payments pay for two months of credits.
        expect(creditsMock.grant).toHaveBeenCalledTimes(1);
        expect(creditsMock.grant.mock.calls[0][0]).toMatchObject({ amount: 400n });
        expect(notificationsMock.notify).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ subscriptionId: 'sub-active' }),
          }),
        );
      });

      it('replaces a different package (old EXPIRED immediately, no proration)', async () => {
        prismaMock.subscription.findFirst.mockResolvedValue({
          id: 'sub-old',
          packageCode: 'PREMIUM',
          status: 'ACTIVE' as never,
          expiresAt: new Date(Date.now() + 20 * 86_400_000),
        });
        prismaMock.subscription.create.mockResolvedValue({ id: 'sub-new' });

        await service.handleVerificationResult('bill-1', verdict({}));

        expect(prismaMock.subscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'sub-old' },
            data: expect.objectContaining({ status: 'EXPIRED', expiresAt: expect.any(Date) }),
          }),
        );
        expect(prismaMock.subscription.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              packageCode: 'BUSINESS',
              status: 'ACTIVE',
              autoRenew: false,
            }),
          }),
        );
      });
    });

    describe('VERIFIED → PREMIUM (unlimited)', () => {
      it('grants 0 credits (no ledger row) and notifies with the unlimited copy', async () => {
        repoMock.findByIdAny.mockResolvedValue(makeRow({ packageCode: 'PREMIUM' }));
        prismaMock.package.findUniqueOrThrow.mockResolvedValue(PREMIUM_PACKAGE);
        prismaMock.subscription.findFirst.mockResolvedValue(null);
        prismaMock.subscription.create.mockResolvedValue({ id: 'sub-prem' });
        prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
          fn(txOf(prismaMock)),
        );

        await service.handleVerificationResult('bill-1', verdict({ amountMinor: 99900n }));

        // Unlimited: NO grant ever touches the ledger.
        expect(creditsMock.grant).not.toHaveBeenCalled();
        expect(notificationsMock.notify).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'BILLING_APPROVED',
            body: expect.stringContaining('unlimited'),
          }),
        );
      });
    });

    describe('VERIFIED → amount mismatch', () => {
      it('AMOUNT_MISMATCH with zero tolerance; no credits, no subscription', async () => {
        repoMock.findByIdAny.mockImplementation(async (id: string) => makeRow({ id }));
        await service.handleVerificationResult('bill-1', verdict({ amountMinor: 99000n }));

        expect(repoMock.recordOutcome).toHaveBeenCalledWith(
          'bill-1',
          expect.objectContaining({ status: 'AMOUNT_MISMATCH', subscriptionId: null }),
        );
        // Zero tolerance: 99999 vs 99900 is as much a mismatch as 99000.
        await service.handleVerificationResult('bill-2', verdict({ amountMinor: 99999n }));
        expect(repoMock.recordOutcome).toHaveBeenCalledWith(
          'bill-2',
          expect.objectContaining({ status: 'AMOUNT_MISMATCH' }),
        );
        expect(creditsMock.grant).not.toHaveBeenCalled();
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(notificationsMock.notify).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'BILLING_REJECTED',
            data: expect.objectContaining({
              expectedAmountMinor: '99900',
              submittedAmountMinor: '99000',
            }),
          }),
        );
        expect(auditMock.log).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'billing.amount_mismatch', targetId: 'bill-1' }),
        );
      });

      it('a missing extracted amount is a mismatch, not an approval', async () => {
        repoMock.findByIdAny.mockResolvedValue(makeRow());
        await service.handleVerificationResult('bill-1', verdict({ amountMinor: null }));
        expect(repoMock.recordOutcome).toHaveBeenCalledWith(
          'bill-1',
          expect.objectContaining({ status: 'AMOUNT_MISMATCH' }),
        );
      });
    });

    it('FAKE → FAKE, no credits, merchant notified', async () => {
      repoMock.findByIdAny.mockResolvedValue(makeRow());
      await service.handleVerificationResult('bill-1', verdict({ status: 'FAKE' }));

      expect(repoMock.recordOutcome).toHaveBeenCalledWith(
        'bill-1',
        expect.objectContaining({ status: 'FAKE', subscriptionId: null }),
      );
      expect(notificationsMock.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BILLING_REJECTED',
          data: expect.objectContaining({ status: 'FAKE' }),
        }),
      );
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'billing.fake', targetId: 'bill-1' }),
      );
    });

    it('DUPLICATE → DUPLICATE, no credits', async () => {
      repoMock.findByIdAny.mockResolvedValue(makeRow());
      await service.handleVerificationResult('bill-1', verdict({ status: 'DUPLICATE' }));
      expect(repoMock.recordOutcome).toHaveBeenCalledWith(
        'bill-1',
        expect.objectContaining({ status: 'DUPLICATE' }),
      );
      expect(creditsMock.grant).not.toHaveBeenCalled();
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'billing.duplicate' }),
      );
    });

    it('ERROR → NEEDS_REVIEW with the verification reason in reviewNote', async () => {
      repoMock.findByIdAny.mockResolvedValue(makeRow());
      await service.handleVerificationResult(
        'bill-1',
        verdict({ status: 'ERROR', errorCode: 'BANK_ADAPTER_TIMEOUT', errorMessage: 'timed out' }),
      );

      expect(repoMock.recordOutcome).toHaveBeenCalledWith(
        'bill-1',
        expect.objectContaining({
          status: 'NEEDS_REVIEW',
          reviewNote: expect.stringContaining('BANK_ADAPTER_TIMEOUT'),
        }),
      );
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'billing.error_needs_review' }),
      );
    });

    it('NEEDS_REVIEW verdict → NEEDS_REVIEW (admin queue)', async () => {
      repoMock.findByIdAny.mockResolvedValue(makeRow());
      await service.handleVerificationResult('bill-1', verdict({ status: 'NEEDS_REVIEW' }));
      expect(repoMock.recordOutcome).toHaveBeenCalledWith(
        'bill-1',
        expect.objectContaining({ status: 'NEEDS_REVIEW' }),
      );
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'billing.needs_review' }),
      );
    });

    it('the approval transaction failing downgrades the session to NEEDS_REVIEW, never throws', async () => {
      repoMock.findByIdAny.mockResolvedValue(makeRow());
      prismaMock.$transaction.mockRejectedValue(new Error('ledger collision'));

      await expect(
        service.handleVerificationResult('bill-1', verdict({})),
      ).resolves.toBeUndefined();

      expect(prismaMock.billingVerification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bill-1', status: 'PENDING' },
          data: expect.objectContaining({ status: 'NEEDS_REVIEW' }),
        }),
      );
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'billing.approval_failed' }),
      );
      expect(notificationsMock.notify).not.toHaveBeenCalled();
    });

    it('a rejection handler crash still moves PENDING → NEEDS_REVIEW (never stuck)', async () => {
      repoMock.findByIdAny.mockResolvedValue(makeRow());
      repoMock.recordOutcome.mockRejectedValue(new Error('db dead'));

      await expect(
        service.handleVerificationResult('bill-1', verdict({ status: 'ERROR' })),
      ).resolves.toBeUndefined();

      expect(prismaMock.billingVerification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bill-1', status: 'PENDING' },
          data: expect.objectContaining({ status: 'NEEDS_REVIEW' }),
        }),
      );
    });

    it('an already-settled session is idempotently skipped (redelivery safe)', async () => {
      repoMock.findByIdAny.mockResolvedValue(makeRow({ status: 'APPROVED' }));
      await service.handleVerificationResult('bill-1', verdict({}));

      expect(repoMock.recordOutcome).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(notificationsMock.notify).not.toHaveBeenCalled();
    });
  });
});

// txOf projects the outer prisma mock onto the TransactionClient shape
// settleApproval() uses — same objects, one namespace.
function txOf(prisma: {
  package: unknown;
  subscription: unknown;
  merchant: unknown;
  billingVerification: unknown;
}): unknown {
  return {
    package: prisma.package,
    subscription: prisma.subscription,
    merchant: prisma.merchant,
    billingVerification: prisma.billingVerification,
  };
}
