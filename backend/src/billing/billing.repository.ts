// ============================================================
// Yene Verify — Billing Repository (Step 16)
//
// All direct Prisma access for the billing_verifications table.
// Merchant-level reads are always tenant-scoped by merchantId in
// the WHERE clause. Cross-merchant internal helpers (findByIdAny,
// findByVerificationId, findOwnerUserId) are used only by the
// processor's post-verdict callback and never surface through an
// HTTP route in this step.
// ============================================================

import { Injectable } from '@nestjs/common';
import type {
  BankCode,
  BillingStatus,
  BillingVerification,
  PackageCode,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../common/utils/id.util';

/** The verifications row's status snapshot as the billing state machine consumes it. */
export interface BillingVerdict {
  status: 'VERIFIED' | 'FAKE' | 'DUPLICATE' | 'NEEDS_REVIEW' | 'ERROR';
  amountMinor: bigint | null;
  bankCode: string | null;
  bankReference: string | null;
  senderName: string | null;
  receiverName: string | null;
  paidAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
}

/** Persisted snapshot facts carried onto the billing row from a verdict. */
export interface BillingFacts {
  submittedAmountMinor: bigint | null;
  bankCode: BankCode | null;
  bankReference: string | null;
  senderName: string | null;
  receiverName: string | null;
  paidAt: Date | null;
}

export type BillingSessionRow = BillingVerification;

@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(input: {
    merchantId: string;
    packageCode: string;
    expectedAmountMinor: bigint;
  }): Promise<BillingSessionRow> {
    // IDs have no DB default: the app must supply one on every insert
    // (newId() → UUIDv7). Same convention as every other create here.
    return this.prisma.billingVerification.create({
      data: {
        id: newId(),
        merchantId: input.merchantId,
        packageCode: input.packageCode as unknown as PackageCode,
        expectedAmountMinor: input.expectedAmountMinor,
        status: 'PENDING',
      },
    });
  }

  /** Tenant-scoped load — the resolve-for-an-endpoint read. */
  async findById(merchantId: string, billingSessionId: string): Promise<BillingSessionRow | null> {
    return this.prisma.billingVerification.findFirst({
      where: { id: billingSessionId, merchantId },
    });
  }

  /** Cross-tenant internal lookup for the verdict handler. */
  async findByIdAny(billingSessionId: string): Promise<BillingSessionRow | null> {
    return this.prisma.billingVerification.findUnique({ where: { id: billingSessionId } });
  }

  /** The billing session a verification belongs to (processor callback). */
  async findByVerificationId(verificationId: string): Promise<BillingSessionRow | null> {
    return this.prisma.billingVerification.findFirst({
      where: { verificationId },
    });
  }

  /** Any prior billing session that already used this receipt (0 or 1 in practice). */
  async findReceiptUse(receiptId: string): Promise<BillingSessionRow | null> {
    return this.prisma.billingVerification.findFirst({
      where: { receiptId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Claim the session: link receipt + verification atomically only while
   * the row is still PENDING. Returns false if the state has moved.
   * @prisma/transactional-safe: updateMany with where is a single
   * unconditional guarded update, not a read-then-write.
   */
  async linkSubmission(input: {
    billingSessionId: string;
    receiptId: string;
    verificationId: string;
  }): Promise<boolean> {
    const result = await this.prisma.billingVerification.updateMany({
      where: { id: input.billingSessionId, status: 'PENDING' },
      data: {
        receiptId: input.receiptId,
        verificationId: input.verificationId,
      },
    });
    return result.count === 1;
  }

  /** Snapshot the extracted facts once VERIFIED reaches the gate. */
  async recordVerifiedFacts(billingSessionId: string, facts: BillingFacts): Promise<void> {
    await this.prisma.billingVerification.update({
      where: { id: billingSessionId },
      data: {
        submittedAmountMinor: facts.submittedAmountMinor,
        bankCode: facts.bankCode,
        bankReference: facts.bankReference,
        senderName: facts.senderName,
        receiverName: facts.receiverName,
        paidAt: facts.paidAt,
      },
    });
  }

  /**
   * Move a PENDING session into its terminal billing state atomically.
   * @returns whether the transition landed (false if it was already claimed).
   */
  async recordOutcome(
    billingSessionId: string,
    input: {
      status: Exclude<BillingStatus, 'PENDING'>;
      submittedAmountMinor: bigint | null;
      bankCode: BankCode | null;
      bankReference: string | null;
      senderName: string | null;
      receiverName: string | null;
      paidAt: Date | null;
      reviewNote: string | null;
      subscriptionId: string | null;
    },
  ): Promise<boolean> {
    const result = await this.prisma.billingVerification.updateMany({
      where: { id: billingSessionId, status: 'PENDING' },
      data: {
        status: input.status,
        submittedAmountMinor: input.submittedAmountMinor,
        bankCode: input.bankCode,
        bankReference: input.bankReference,
        senderName: input.senderName,
        receiverName: input.receiverName,
        paidAt: input.paidAt,
        reviewNote: input.reviewNote,
        subscriptionId: input.subscriptionId,
      },
    });
    return result.count === 1;
  }

  /** The merchant owner's user id (recipients of billing notifications). */
  async findOwnerUserId(merchantId: string): Promise<string | null> {
    const owner = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { ownerUserId: true },
    });
    return owner?.ownerUserId ?? null;
  }

  async list(
    merchantId: string,
    opts: { page: number; pageSize: number; status: string | null },
  ): Promise<{ rows: BillingSessionRow[]; total: number }> {
    const where: Prisma.BillingVerificationWhereInput = {
      merchantId,
      ...(opts.status ? { status: { equals: opts.status as BillingStatus } } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.billingVerification.count({ where }),
      this.prisma.billingVerification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
    ]);
    return { rows, total };
  }
}
