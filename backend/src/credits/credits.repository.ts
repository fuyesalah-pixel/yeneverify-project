// ============================================================
// Yene Verify — Credits Repository
// Every Prisma read/write for the credit ledger lives here so the
// service stays testable and the immutability rules stay in one
// place: this repository NEVER calls update() or delete() on
// credit_transactions — the DB rules block it anyway (Step 6).
//
// Transaction participation: every method takes an optional
// `tx?: Prisma.TransactionClient`. Callers inside prisma.$transaction
// pass their tx so reads and writes hit the same snapshot; standalone
// callers omit it and the default PrismaService client is used.
// ============================================================

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreditTransaction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../common/utils/id.util';
import type { SubscriptionContext } from './credits.types';

type Client = Prisma.TransactionClient | PrismaService;
export type Tx = Prisma.TransactionClient;

export interface InsertCreditTxInput {
  merchantId: string;
  type: 'GRANT' | 'CONSUME' | 'REFUND' | 'ADJUSTMENT' | 'EXPIRE';
  amount: bigint; // signed
  balanceAfter: bigint;
  verificationId?: string;
  billingVerificationId?: string;
  subscriptionId?: string;
  reason?: string;
  actorUserId?: string;
}

export interface VerificationOwnership {
  merchantId: string;
  status: string;
}

@Injectable()
export class CreditsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Cached balance from merchants.credits_balance (the CACHE, not truth). */
  async findBalance(merchantId: string, tx?: Tx): Promise<bigint> {
    const client = (tx ?? this.prisma) as Client;
    const merchant = await client.merchant.findUnique({
      where: { id: merchantId },
      select: { creditsBalance: true },
    });
    return merchant?.creditsBalance ?? 0n;
  }

  /**
   * The ledger sum — the SOURCE OF TRUTH for the balance.
   *
   * ADJUSTMENT rows are EXCLUDED: they are audit records written by
   * reconcile() documenting a cache correction, not balance entries.
   * Including them would make every reconciliation change the sum that
   * reconcile just computed, so the cache could never agree with the
   * ledger again. Only GRANT/CONSUME/REFUND/EXPIRE move credits.
   */
  async sumLedgerForMerchant(merchantId: string, tx?: Tx): Promise<bigint> {
    const client = (tx ?? this.prisma) as Client;
    const agg = await client.creditTransaction.aggregate({
      where: { merchantId, type: { not: 'ADJUSTMENT' } },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0n;
  }

  /** The ACTIVE-most subscription plus its package's unlimited flag. */
  async findSubscriptionContext(merchantId: string, tx?: Tx): Promise<SubscriptionContext | null> {
    const client = (tx ?? this.prisma) as Client;
    const subscription = await client.subscription.findFirst({
      where: { merchantId, status: { in: ['ACTIVE', 'EXPIRED'] } },
      orderBy: { createdAt: 'desc' },
      include: { package: { select: { unlimited: true } } },
    });
    if (!subscription) return null;
    return {
      merchantId,
      subscriptionId: subscription.id,
      status: subscription.status,
      packageCode: subscription.packageCode,
      unlimited: subscription.package?.unlimited ?? false,
    };
  }

  /** Ownership + status check before consuming credits for a verification. */
  async findVerificationForConsume(
    verificationId: string,
    tx?: Tx,
  ): Promise<VerificationOwnership | null> {
    const client = (tx ?? this.prisma) as Client;
    const verification = await client.verification.findUnique({
      where: { id: verificationId },
      select: { merchantId: true, status: true },
    });
    return verification ?? null;
  }

  /** Idempotency guard: the CONSUME row recorded for this verification, if any. */
  async findConsumptionForVerification(
    verificationId: string,
    tx?: Tx,
  ): Promise<CreditTransaction | null> {
    const client = (tx ?? this.prisma) as Client;
    return client.creditTransaction.findFirst({
      where: { verificationId, type: 'CONSUME' },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** APPEND-ONLY insert. There is deliberately no update/delete counterpart. */
  async insertCreditTx(input: InsertCreditTxInput, tx?: Tx): Promise<CreditTransaction> {
    const client = (tx ?? this.prisma) as Client;
    return client.creditTransaction.create({
      data: {
        id: newId(),
        merchantId: input.merchantId,
        type: input.type,
        amount: input.amount,
        balanceAfter: input.balanceAfter,
        verificationId: input.verificationId ?? null,
        billingVerificationId: input.billingVerificationId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        reason: input.reason ?? null,
        actorUserId: input.actorUserId ?? null,
      },
    });
  }

  /** Cache write. merchants.credits_balance is updated INSIDE the ledger tx. */
  async updateCachedBalance(merchantId: string, newBalance: bigint, tx?: Tx): Promise<void> {
    const client = (tx ?? this.prisma) as Client;
    await client.merchant.update({
      where: { id: merchantId },
      data: { creditsBalance: newBalance, creditsUpdatedAt: new Date() },
    });
  }

  /** Append-only history page. */
  async listHistory(
    merchantId: string,
    query: { page: number; pageSize: number; sortOrder: 'asc' | 'desc' },
    tx?: Tx,
  ): Promise<{ rows: CreditTransaction[]; total: number }> {
    const client = (tx ?? this.prisma) as Client;
    const [rows, total] = await Promise.all([
      client.creditTransaction.findMany({
        where: { merchantId },
        orderBy: { createdAt: query.sortOrder },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      client.creditTransaction.count({ where: { merchantId } }),
    ]);
    return { rows, total };
  }
}
