// ============================================================
// Yene Verify — Billing Service (Step 16)
//
// The money-in loop:
//
//   initiate → instructions + PENDING billing session
//   submit   → verification row (source=BILLING) + enqueue
//   verdict  → handleVerificationResult():
//     VERIFIED  + exact amount  → APPROVED + credits + subscription
//     VERIFIED  + wrong amount  → AMOUNT_MISMATCH (admin review)
//     FAKE / DUPLICATE          → rejected outright
//     ERROR / NEEDS_REVIEW      → NEEDS_REVIEW  (admin review)
//
// Rules (Step 16 spec):
//   - Zero amount tolerance — bigint equality on minor units.
//   - BILLING verifications consume 0 credits (the processor never
//     routes them through CreditsService.consume).
//   - Each approved billing grants the package allotment immediately
//     (two same-month approvals = 2× credits); package changes take
//     effect now, old plan expires immediately — no proration.
//   - The billing row is the source of truth; notifications go through
//     NotificationsService.notify() and never block or throw.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { BankCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreditsService } from '../credits/credits.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VerificationQueueService } from '../verification/queue/verification-queue.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODES } from '../common/constants/error-codes';
import {
  BillingSessionNotPendingError,
  BillingSessionNotFoundError,
} from '../common/errors/domain-errors';
import { newId } from '../common/utils/id.util';
import type { AuthUser } from '../common/types/auth-user.type';
import type {
  BillingDetailResponseDto,
  BillingInitiationResponseDto,
  BillingListResponseDto,
  BillingSubmittedResponseDto,
} from './dto';
import { BillingRepository, BillingSessionRow, BillingVerdict } from './billing.repository';

/** Subscription term granted per approved payment. */
const SUBSCRIPTION_TERM_DAYS = 30;

/** The DB BankCode enum carries the seven real banks only (13E rule). */
const DB_BANK_CODES: ReadonlySet<string> = new Set([
  'CBE',
  'TELEBIRR',
  'AWASH',
  'DASHEN',
  'ABYSSINIA',
  'MPESA',
  'ZEMEN',
] as string[]);

function normalizeBankCode(bankCode: string | null | undefined): BankCode | null {
  return bankCode && DB_BANK_CODES.has(bankCode) ? (bankCode as BankCode) : null;
}

/** Facts a verdict carries; persisted on the billing row before hat mode. */
type VerdictFacts = {
  submittedAmountMinor: bigint | null;
  bankCode: BankCode | null;
  bankReference: string | null;
  senderName: string | null;
  receiverName: string | null;
  paidAt: Date | null;
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: BillingRepository,
    private readonly credits: CreditsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly queue: VerificationQueueService,
    private readonly platform: PlatformConfigService,
  ) {}

  // ── Initiation ────────────────────────────────────────────────────────

  /**
   * Get payment instructions for a package and open a PENDING billing
   * session (the anchor for the upload flow). Receipt fields stay null
   * until /billing/submit links them.
   */
  async initiate(input: {
    merchantId: string;
    userId: string;
    dto: { packageCode: 'PREMIUM' | 'BUSINESS' | 'BUSINESS_PRO' | 'FREE' };
  }): Promise<BillingInitiationResponseDto> {
    const pkg = await this.prisma.package.findUnique({
      where: { code: input.dto.packageCode },
    });

    if (!pkg || !pkg.active) {
      throw new AppError(
        ERROR_CODES.BILLING_PACKAGE_NOT_FOUND,
        'The requested package does not exist.',
        404,
        { packageCode: input.dto.packageCode },
      );
    }
    const reason = this.purchasabilityProblem(pkg.code as string, pkg.priceMinor);
    if (reason) {
      throw new AppError(
        ERROR_CODES.BILLING_PACKAGE_NOT_PURCHASABLE,
        `Package ${pkg.code} cannot be purchased. ${reason}`,
        400,
        { packageCode: pkg.code, reason },
      );
    }

    const session = await this.repo.createSession({
      merchantId: input.merchantId,
      packageCode: pkg.code as string,
      expectedAmountMinor: pkg.priceMinor as bigint,
    });
    const payment = await this.platform.getPaymentInstructions();

    this.audit.log({
      actorType: 'USER',
      actorUserId: input.userId,
      action: 'billing.initiated',
      targetType: 'billing_verification',
      targetId: session.id,
      metadata: {
        merchantId: input.merchantId,
        packageCode: pkg.code,
        expectedAmountMinor: session.expectedAmountMinor.toString(),
      },
    });

    return {
      packageCode: pkg.code as string,
      packageName: pkg.name,
      expectedAmountMinor: session.expectedAmountMinor.toString(),
      currency: 'ETB',
      instructions: {
        cbe: {
          accountNumber: payment.cbeAccountNumber,
          accountName: payment.accountName,
        },
        telebirr: {
          phoneNumber: payment.telebirrPhoneNumber,
          accountName: payment.accountName,
        },
        note: payment.instructionsNote,
      },
      billingSessionId: session.id,
    };
  }

  /** FREE is provisioned at onboarding; API is a custom-priced engagement. */
  private purchasabilityProblem(packageCode: string, priceMinor: bigint | null): string | null {
    if (packageCode === 'FREE') {
      return 'The Free plan is provided automatically at onboarding.';
    }
    if (packageCode === 'API') {
      return 'API access is a custom-priced engagement; contact sales.';
    }
    if (priceMinor === null || priceMinor <= 0n) {
      return 'The package has no price configured.';
    }
    return null;
  }

  // ── Submission ────────────────────────────────────────────────────────

  /**
   * Link a completed receipt upload to the session, create the
   * source=BILLING verification row, enqueue it, return 202 data.
   *
   * Deliberately bypasses VerificationsService.submit(): that path runs
   * the credits submission gate (402 when the balance is 0) — but a
   * merchant buying credits may legitimately sit at zero. BILLING
   * verifications never consume credits either way (processor rule).
   */
  async submit(input: {
    user: AuthUser;
    merchantId: string;
    dto: { billingSessionId: string; receiptId: string };
  }): Promise<BillingSubmittedResponseDto> {
    const { user, merchantId, dto } = input;

    const session = await this.repo.findById(merchantId, dto.billingSessionId);
    if (!session) {
      throw new BillingSessionNotFoundError(dto.billingSessionId);
    }
    if (session.status !== 'PENDING') {
      throw new BillingSessionNotPendingError(session.id, session.status);
    }

    // The receipt must exist in this tenant (sub-merchants upload into
    // the owner merchant's tenant).
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: dto.receiptId, merchantId, deletedAt: null },
      select: { id: true },
    });
    if (!receipt) {
      throw new AppError(
        ERROR_CODES.RECEIPT_NOT_FOUND,
        'Receipt not found. Upload the payment screenshot first.',
        404,
        { receiptId: dto.receiptId },
      );
    }

    // Cheap pre-adapter duplicate guard: the same screenshot cannot open
    // two billing sessions (the fingerprint engine still catches any
    // re-verification across DIFFERENT receipts or tenants).
    const priorUse = await this.repo.findReceiptUse(dto.receiptId);
    if (priorUse && priorUse.id !== session.id) {
      throw new AppError(
        ERROR_CODES.BILLING_RECEIPT_ALREADY_USED,
        'This receipt has already been used for another billing.',
        409,
        { receiptId: dto.receiptId, existingBillingId: priorUse.id },
      );
    }

    const verificationId = newId();
    await this.prisma.verification.create({
      data: {
        id: verificationId,
        merchantId,
        verifiedByUserId: user.id,
        receiptId: dto.receiptId,
        source: 'BILLING',
        status: 'PENDING',
      },
      select: { id: true },
    });

    // updateMany(PENDING) is the guard: if a verdict already landed on
    // this session between our checks, the link is refused (409).
    const linked = await this.repo.linkSubmission({
      billingSessionId: session.id,
      receiptId: dto.receiptId,
      verificationId,
    });
    if (!linked) {
      throw new BillingSessionNotPendingError(session.id, 'UPDATED');
    }

    this.audit.log({
      actorType: 'USER',
      actorUserId: user.id,
      action: 'billing.submitted',
      targetType: 'billing_verification',
      targetId: session.id,
      metadata: { merchantId, verificationId, receiptId: dto.receiptId },
    });

    await this.queue.enqueue(verificationId);
    this.logger.log(
      `Billing session ${session.id} submitted verification ${verificationId} (merchant ${merchantId})`,
    );

    return {
      billingVerificationId: session.id,
      verificationId,
      status: 'PENDING',
    };
  }

  // ── Read models ───────────────────────────────────────────────────────

  async getForMerchant(input: {
    merchantId: string;
    billingSessionId: string;
  }): Promise<BillingDetailResponseDto> {
    const row = await this.repo.findById(input.merchantId, input.billingSessionId);
    if (!row) {
      throw new BillingSessionNotFoundError(input.billingSessionId);
    }
    return this.toDetail(row);
  }

  async list(input: {
    merchantId: string;
    query: { page: number; pageSize: number; status: string | null };
  }): Promise<BillingListResponseDto> {
    const page = Math.max(1, input.query.page);
    const pageSize = Math.min(100, Math.max(1, input.query.pageSize));
    const { rows, total } = await this.repo.list(input.merchantId, {
      page,
      pageSize,
      status: input.query.status,
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        packageCode: row.packageCode as string,
        expectedAmountMinor: row.expectedAmountMinor.toString(),
        submittedAmountMinor: row.submittedAmountMinor?.toString() ?? null,
        status: row.status as BillingDetailResponseDto['status'],
        bankReference: row.bankReference,
        createdAt: row.createdAt.toISOString(),
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  // ── Post-verdict handling (called by the processor) ───────────────────

  /** Processor entry point: resolve the billing session for a verification. */
  async handleVerificationResultForVerification(
    verificationId: string,
    result: BillingVerdict,
  ): Promise<void> {
    const session = await this.repo.findByVerificationId(verificationId);
    if (!session) {
      // Legacy direct /verifications BILLING submissions carry no session:
      // free verifications with nothing further to do (no billing row).
      this.logger.warn(
        `billing.session_missing verificationId=${verificationId} — verdict ${result.status} recorded on the verification only`,
      );
      return;
    }
    await this.handleVerificationResult(session.id, result);
  }

  /**
   * The single transition point after a terminal verdict. Only the exact
   * match path can surface a genuine failure (ledger/DB), and that is
   * downgraded to NEEDS_REVIEW — never a throw, never a job retry.
   */
  async handleVerificationResult(billingId: string, result: BillingVerdict): Promise<void> {
    const row = await this.repo.findByIdAny(billingId);
    if (!row) {
      this.logger.error(`billing.session_not_found billingId=${billingId}`);
      return;
    }
    if (row.status !== 'PENDING') {
      this.logger.log(
        `billing.already_settled billingId=${billingId} status=${row.status} — idempotent skip`,
      );
      return;
    }

    const verdictFacts: VerdictFacts = {
      submittedAmountMinor: result.amountMinor ?? null,
      bankCode: normalizeBankCode(result.bankCode),
      bankReference: result.bankReference,
      senderName: result.senderName,
      receiverName: result.receiverName,
      paidAt: result.paidAt,
    };

    // The extracted facts are business truth regardless of the gate —
    // persist them first so no review path ever lacks the amount.
    if (result.status === 'VERIFIED') {
      await this.repo.recordVerifiedFacts(row.id, verdictFacts);
      await this.onVerified(row, verdictFacts);
      return;
    }

    const { ownerUserId } = { ownerUserId: await this.repo.findOwnerUserId(row.merchantId) };

    try {
      switch (result.status) {
        case 'FAKE':
          await this.reject(
            row,
            'FAKE',
            verdictFacts,
            result,
            ownerUserId,
            'The payment receipt could not be verified. Please double-check your screenshot.',
          );
          await this.auditTransition('billing.fake', row, verdictFacts, result);
          break;
        case 'DUPLICATE':
          await this.reject(
            row,
            'DUPLICATE',
            verdictFacts,
            result,
            ownerUserId,
            'This receipt has already been used for another verification.',
          );
          await this.auditTransition('billing.duplicate', row, verdictFacts, result);
          break;
        case 'NEEDS_REVIEW':
        case 'ERROR':
          await this.reject(
            row,
            'NEEDS_REVIEW',
            verdictFacts,
            result,
            ownerUserId,
            "We couldn't verify your payment. An admin will review it within 24 hours.",
          );
          await this.auditTransition(
            result.status === 'ERROR' ? 'billing.error_needs_review' : 'billing.needs_review',
            row,
            verdictFacts,
            result,
          );
          break;
        default:
          this.logger.warn(
            `billing.unhandled_verdict billingId=${billingId} status=${result.status}`,
          );
      }
    } catch (err) {
      this.logger.error(
        `billing.handler_failed billingId=${billingId} status=${result.status} error=${err instanceof Error ? err.message : String(err)}`,
      );
      // Never leave a payment session stuck in PENDING — the admin queue
      // resolves it. updateMany(PENDING) keeps racing attempts safe.
      await this.prisma.billingVerification.updateMany({
        where: { id: billingId, status: 'PENDING' },
        data: {
          status: 'NEEDS_REVIEW',
          submittedAmountMinor: verdictFacts.submittedAmountMinor,
          reviewNote: 'Billing processing failed; an admin must review this payment.',
        },
      });
    }
  }

  /** VERIFIED → exact-match gate → APPROVED+grant or AMOUNT_MISMATCH. */
  private async onVerified(row: BillingSessionRow, facts: VerdictFacts): Promise<void> {
    const expected = row.expectedAmountMinor;
    const submitted = facts.submittedAmountMinor;
    const ownerUserId = await this.repo.findOwnerUserId(row.merchantId);

    // Zero tolerance — bigint equality in minor units. Any "rounding"
    // difference is an admin-review case in a payment system.
    if (submitted !== expected) {
      await this.repo.recordOutcome(row.id, {
        status: 'AMOUNT_MISMATCH',
        submittedAmountMinor: submitted,
        bankCode: facts.bankCode,
        bankReference: facts.bankReference,
        senderName: facts.senderName,
        receiverName: facts.receiverName,
        paidAt: facts.paidAt,
        reviewNote: `Expected ${expected.toString()} santim, received ${submitted ? submitted.toString() : 'nothing'}.`,
        subscriptionId: null,
      });
      if (ownerUserId) {
        void this.notifications.notify({
          userId: ownerUserId,
          merchantId: row.merchantId,
          type: 'BILLING_REJECTED',
          title: 'Payment amount does not match',
          body: "Payment amount doesn't match the package price. An admin will review.",
          data: {
            billingVerificationId: row.id,
            packageCode: row.packageCode as string,
            expectedAmountMinor: expected.toString(),
            submittedAmountMinor: submitted ? submitted.toString() : null,
          },
        });
      }
      await this.auditTransition('billing.amount_mismatch', row, facts, {
        errorCode: ERROR_CODES.BILLING_AMOUNT_MISMATCH,
      });
      return;
    }

    // Exact match → approve inside ONE transaction: subscription writes,
    // the ledger grant and the billing status flip commit together (or
    // the whole thing rolls back and NEEDS_REVIEW catches the fallout).
    let approval: { subscriptionId: string; granted: bigint };
    try {
      approval = await this.prisma.$transaction(async (tx) =>
        this.settleApproval(tx, row, facts, ownerUserId),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`billing.approval_txn_failed billingId=${row.id} error=${message}`);
      await this.prisma.billingVerification.updateMany({
        where: { id: row.id, status: 'PENDING' },
        data: {
          status: 'NEEDS_REVIEW',
          reviewNote: 'Payment verified but credit grant failed; an admin must review.',
        },
      });
      this.audit.log({
        actorType: 'SYSTEM',
        action: 'billing.approval_failed',
        targetType: 'billing_verification',
        targetId: row.id,
        metadata: {
          merchantId: row.merchantId,
          packageCode: row.packageCode as string,
          expectedAmountMinor: expected.toString(),
          reason: message.slice(0, 400),
        },
      });
      return;
    }

    if (ownerUserId) {
      void this.notifications.notify({
        userId: ownerUserId,
        merchantId: row.merchantId,
        type: 'BILLING_APPROVED',
        title: 'Payment verified',
        body:
          approval.granted > 0n
            ? `Payment verified. ${approval.granted.toString()} credits added. Your plan is now active.`
            : 'Payment verified. Your plan is now active with unlimited verifications.',
        data: {
          billingVerificationId: row.id,
          packageCode: row.packageCode as string,
          creditsGranted: approval.granted.toString(),
          subscriptionId: approval.subscriptionId,
        },
      });
    }
    await this.auditTransition('billing.approved', { ...row, status: 'PENDING' }, facts, {
      metadataNote: `subscription=${approval.subscriptionId} credits=${approval.granted.toString()}`,
    });
  }

  /**
   * The APPROVED state machine (runs inside the caller's transaction):
   * create / extend / replace the subscription, grant the package's
   * credits, flip the billing status, link subscription — atomically.
   */
  private async settleApproval(
    tx: Prisma.TransactionClient,
    row: BillingSessionRow,
    facts: VerdictFacts,
    ownerUserId: string | null,
  ): Promise<{ subscriptionId: string; granted: bigint }> {
    const pkg = await tx.package.findUniqueOrThrow({ where: { code: row.packageCode } });
    const now = new Date();
    const termEnd = (from: Date) =>
      new Date(from.getTime() + SUBSCRIPTION_TERM_DAYS * 24 * 60 * 60 * 1000);

    const active = await tx.subscription.findFirst({
      where: { merchantId: row.merchantId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    let subscriptionId: string;
    let granted = 0n;

    if (!active) {
      const created = await tx.subscription.create({
        data: {
          id: newId(),
          merchantId: row.merchantId,
          packageCode: row.packageCode as never,
          status: 'ACTIVE',
          startedAt: now,
          expiresAt: termEnd(now),
          autoRenew: false,
          billingVerificationId: row.id,
        },
        select: { id: true },
      });
      subscriptionId = created.id;
    } else if ((active.packageCode as string) === (row.packageCode as string)) {
      // Renewal: extend from the later of now / current expiry so an
      // early renewal never silently shortens the remaining term.
      const base = active.expiresAt && active.expiresAt > now ? active.expiresAt : now;
      await tx.subscription.update({
        where: { id: active.id },
        data: { status: 'ACTIVE', expiresAt: termEnd(base) },
      });
      subscriptionId = active.id;
    } else {
      // Package change: old plan expires immediately (no proration);
      // the new subscription starts its full 30-day term now.
      await tx.subscription.update({
        where: { id: active.id },
        data: { status: 'EXPIRED', expiresAt: now },
      });
      const created = await tx.subscription.create({
        data: {
          id: newId(),
          merchantId: row.merchantId,
          packageCode: row.packageCode as never,
          status: 'ACTIVE',
          startedAt: now,
          expiresAt: termEnd(now),
          autoRenew: false,
          billingVerificationId: row.id,
        },
        select: { id: true },
      });
      subscriptionId = created.id;
    }

    // Credits are real only on finite plans; unlimited plans consume 0
    // and are governed by the subscription's package.unlimited flag.
    if (!pkg.unlimited && pkg.creditsPerMonth && pkg.creditsPerMonth > 0) {
      const grant = await this.credits.grant(
        {
          merchantId: row.merchantId,
          amount: BigInt(pkg.creditsPerMonth),
          type: 'GRANT',
          subscriptionId,
          billingVerificationId: row.id,
          reason: `Package ${row.packageCode as string} activation`,
          actorUserId: ownerUserId ?? undefined,
        },
        tx,
      );
      granted = grant.granted;
    }

    await tx.merchant.update({
      where: { id: row.merchantId },
      data: {
        subscriptionId,
        currentPackageCode: row.packageCode as never,
      },
    });

    await tx.billingVerification.update({
      where: { id: row.id },
      data: {
        status: 'APPROVED',
        submittedAmountMinor: facts.submittedAmountMinor,
        bankCode: facts.bankCode,
        bankReference: facts.bankReference,
        senderName: facts.senderName,
        receiverName: facts.receiverName,
        paidAt: facts.paidAt,
        reviewNote: null,
        subscriptionId,
      },
    });

    return { subscriptionId, granted };
  }

  /** Non-VERIFIED terminal transitions: persist fields, then notify. */
  private async reject(
    row: BillingSessionRow,
    status: 'FAKE' | 'DUPLICATE' | 'NEEDS_REVIEW',
    facts: VerdictFacts,
    result: BillingVerdict,
    ownerUserId: string | null,
    body: string,
  ): Promise<void> {
    const reviewNote =
      status === 'NEEDS_REVIEW' && (result.errorCode || result.errorMessage)
        ? `verification ${result.errorCode ?? 'ERROR'}: ${result.errorMessage ?? ''}`.trim()
        : null;

    await this.repo.recordOutcome(row.id, {
      status,
      submittedAmountMinor: facts.submittedAmountMinor,
      bankCode: facts.bankCode,
      bankReference: facts.bankReference,
      senderName: facts.senderName,
      receiverName: facts.receiverName,
      paidAt: facts.paidAt,
      reviewNote,
      subscriptionId: null,
    });

    if (ownerUserId) {
      void this.notifications.notify({
        userId: ownerUserId,
        merchantId: row.merchantId,
        type: 'BILLING_REJECTED',
        title: status === 'FAKE' ? 'Payment could not be verified' : 'Billing update',
        body,
        data: {
          billingVerificationId: row.id,
          packageCode: row.packageCode as string,
          status,
          ...(result.errorCode ? { errorCode: result.errorCode } : {}),
          ...(facts.bankReference ? { bankReference: facts.bankReference } : {}),
        },
      });
    }
  }

  /** Every transition leaves an append-only audit trail entry. */
  private async auditTransition(
    action:
      | 'billing.approved'
      | 'billing.amount_mismatch'
      | 'billing.fake'
      | 'billing.duplicate'
      | 'billing.needs_review'
      | 'billing.error_needs_review',
    row: BillingSessionRow,
    facts: VerdictFacts,
    extra?: { errorCode?: string | null; metadataNote?: string | null },
  ): Promise<void> {
    this.audit.log({
      actorType: 'SYSTEM',
      action,
      targetType: 'billing_verification',
      targetId: row.id,
      metadata: {
        merchantId: row.merchantId,
        packageCode: row.packageCode as string,
        expectedAmountMinor: row.expectedAmountMinor.toString(),
        submittedAmountMinor: facts.submittedAmountMinor
          ? facts.submittedAmountMinor.toString()
          : null,
        ...(facts.bankReference ? { bankReference: facts.bankReference } : {}),
        ...(extra?.errorCode ? { errorCode: extra.errorCode } : {}),
        ...(extra?.metadataNote ? { note: extra.metadataNote } : {}),
      },
    });
  }

  // ── Mappers ───────────────────────────────────────────────────────────

  private toDetail(row: BillingSessionRow): BillingDetailResponseDto {
    return {
      id: row.id,
      packageCode: row.packageCode as string,
      expectedAmountMinor: row.expectedAmountMinor.toString(),
      submittedAmountMinor: row.submittedAmountMinor?.toString() ?? null,
      status: row.status as BillingDetailResponseDto['status'],
      bankCode: row.bankCode,
      bankReference: row.bankReference,
      senderName: row.senderName,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      verificationId: row.verificationId,
      subscriptionId: row.subscriptionId,
      reviewNote: row.reviewNote,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
