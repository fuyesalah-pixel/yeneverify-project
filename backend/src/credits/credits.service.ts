// ============================================================
// Yene Verify — Credits Service
// The single API for all credit operations. The ledger is
// append-only: this service ONLY inserts credit_transactions rows
// and never updates/deletes them (DB rules from Step 6 agree).
// merchants.credits_balance is a transactionally-maintained CACHE;
// SUM(credit_transactions.amount) is the source of truth.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import type { CreditTransaction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundError, TenantIsolationError } from '../common/errors/domain-errors';
import { CreditsRepository, Tx } from './credits.repository';
import { CreditGrantInvalidError, CreditLedgerError, CreditsExhaustedError } from './credit-errors';
import {
  ConsumeInput,
  ConsumeResult,
  CreditTransactionDto,
  GrantInput,
  GrantResult,
  ListCreditHistoryQuery,
  Paginated,
  ReconcileResult,
  SubmissionCheckResult,
} from './credits.types';

// ── POLICY (baked in as a product decision — tune here, nowhere else) ──
// Merchants pay for confirmed answers: VERIFIED and DUPLICATE cost 1
// credit. FAKE costs nothing — the merchant learned something valuable
// (that receipt is fraudulent); charging for that would discourage
// fraud detection. ERROR and NEEDS_REVIEW cost nothing — merchants
// should never pay for our infrastructure failures or unresolved
// reviews. A NEEDS_REVIEW verification MAY be charged later at
// resolution time, in which case 14.2 consumes with status VERIFIED.
// PENDING costs nothing until a terminal status is known.
// ---------------------------------------------------------------------------
export const CREDIT_COST: Record<
  'PENDING' | 'VERIFIED' | 'FAKE' | 'DUPLICATE' | 'NEEDS_REVIEW' | 'ERROR',
  bigint
> = {
  PENDING: 0n,
  VERIFIED: 1n,
  DUPLICATE: 1n,
  FAKE: 0n,
  ERROR: 0n,
  NEEDS_REVIEW: 0n,
};

/** Warn the client when the balance drops to/below this (finite plans only). */
export const LOW_CREDITS_WARNING_THRESHOLD = 20n;

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    private readonly repo: CreditsRepository,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  // ── consume ────────────────────────────────────────────────────────────

  /**
   * Called by the verification flow AFTER the adapter returns.
   * Idempotent: the same verificationId never double-consumes.
   * Pass `tx` to participate in the caller's transaction (14.2 does this
   * whenever the verification finalize and the consume should commit
   * atomically); omit it to run standalone.
   */
  async consume(input: ConsumeInput, tx?: Tx): Promise<ConsumeResult> {
    const cost = CREDIT_COST[input.verificationStatus as keyof typeof CREDIT_COST] ?? 0n;

    // 1. The verification must exist and belong to the merchant.
    const verification = await this.repo.findVerificationForConsume(input.verificationId, tx);
    if (!verification) {
      throw new NotFoundError('Verification not found for credit consumption', {
        verificationId: input.verificationId,
      });
    }
    if (verification.merchantId !== input.merchantId) {
      throw new TenantIsolationError();
    }

    // 0-consumes (free verdict / unlimited / idempotent replay) return
    // unchanged balances without touching the ledger.
    if (cost === 0n) {
      const balance = await this.repo.findBalance(input.merchantId, tx);
      return { consumed: 0n, newBalance: balance, txId: null };
    }

    // Steps 4-7 run in one transaction so the ledger row and the cached
    // balance can never diverge within the ledger's own truth.
    const result = await this.runInTx(tx, async (runTx) => {
      // 4. Idempotency — a CONSUME row for this verification already exists.
      const existing = await this.repo.findConsumptionForVerification(input.verificationId, runTx);
      if (existing) {
        // Same verificationId → same result, no double-consume. The stored
        // row is signed (CONSUME rows negative); report the magnitude.
        return {
          consumed: -BigInt(existing.amount),
          newBalance: BigInt(existing.balanceAfter),
          txId: existing.id,
        };
      }

      // 5-6. Determine the balance from the LEDGER (source of truth), not
      // the cache, so a drifted cache can never enable a free consume.
      const ledgerBalance = await this.repo.sumLedgerForMerchant(input.merchantId, runTx);

      const ctx = await this.repo.findSubscriptionContext(input.merchantId, runTx);
      if (ctx?.unlimited) {
        // Unlimited plans never touch a finite balance and never write
        // CONSUME rows (the schema also forbids zero-amount rows).
        return { consumed: 0n, newBalance: ledgerBalance, txId: null };
      }

      if (ledgerBalance < cost) {
        throw new CreditsExhaustedError(ledgerBalance);
      }

      const newBalance = ledgerBalance - cost;
      const row = await this.safeInsert(
        'consume',
        {
          merchantId: input.merchantId,
          type: 'CONSUME',
          amount: -cost,
          balanceAfter: newBalance,
          verificationId: input.verificationId,
          reason: `Verification ${input.verificationStatus}`,
          actorUserId: input.actorUserId,
        },
        runTx,
      );
      // Keep the cache inside the same transaction. Signed decrement,
      // guarded: a consume that loses a race for the last credit fails
      // here atomically instead of pushing the cache negative.
      await this.repo.updateCachedBalance(input.merchantId, -cost, runTx);
      return { consumed: cost, newBalance, txId: row.id };
    });

    this.auditConsumed(input, result.consumed, result.newBalance, result.txId === null);
    return result;
  }

  // ── grant ──────────────────────────────────────────────────────────────

  /** Package activation (Step 16), seed, or admin adjustments. */
  async grant(input: GrantInput, tx?: Tx): Promise<GrantResult> {
    if (input.amount <= 0n) {
      throw new CreditGrantInvalidError(input.amount);
    }

    const result = await this.runInTx(tx, async (runTx) => {
      const ledgerBalance = await this.repo.sumLedgerForMerchant(input.merchantId, runTx);
      const newBalance = ledgerBalance + input.amount;
      const row = await this.safeInsert(
        'grant',
        {
          merchantId: input.merchantId,
          type: input.type,
          amount: input.amount,
          balanceAfter: newBalance,
          subscriptionId: input.subscriptionId,
          billingVerificationId: input.billingVerificationId,
          reason: input.reason,
          actorUserId: input.actorUserId,
        },
        runTx,
      );
      // Increment-only cache write: a grant never clobbers a consume
      // running concurrently (absolute writes would).
      await this.repo.updateCachedBalance(input.merchantId, input.amount, runTx);
      return { granted: input.amount, newBalance, txId: row.id };
    });

    this.audit.log({
      actorType: input.actorUserId ? 'ADMIN' : 'SYSTEM',
      actorUserId: input.actorUserId,
      action: 'credits.granted',
      targetType: 'merchant',
      targetId: input.merchantId,
      metadata: {
        granted: result.granted.toString(),
        newBalance: result.newBalance.toString(),
        ledgerType: input.type,
        reason: input.reason,
        subscriptionId: input.subscriptionId,
      },
    });
    return result;
  }

  // ── manual adjustment (admin) ───────────────────────────────────────────

  /**
   * Signed manual correction, written by an admin from the console.
   *
   * Unlike grant() this accepts a negative amount (remove credits), so the
   * ledger row type follows the sign: GRANT for a credit, CONSUME for a
   * debit. Both types count toward the ledger sum, unlike ADJUSTMENT rows,
   * which are cache-correction records written by reconcile() and are
   * deliberately excluded from the sum.
   *
   * The balance comes from the LEDGER, never the cache, and a debit that
   * would push the merchant negative is rejected before any row is written.
   */
  async adjust(input: {
    merchantId: string;
    amount: bigint;
    reason: string;
    actorUserId: string;
  }): Promise<{ previousBalance: bigint; newBalance: bigint; txId: string }> {
    if (input.amount === 0n) {
      throw new CreditGrantInvalidError(input.amount);
    }

    const result = await this.runInTx(undefined, async (runTx) => {
      const ledgerBalance = await this.repo.sumLedgerForMerchant(input.merchantId, runTx);
      const newBalance = ledgerBalance + input.amount;

      if (newBalance < 0n) {
        throw new CreditsExhaustedError(ledgerBalance);
      }

      const row = await this.safeInsert(
        'adjust',
        {
          merchantId: input.merchantId,
          type: input.amount > 0n ? 'GRANT' : 'CONSUME',
          amount: input.amount,
          balanceAfter: newBalance,
          reason: input.reason,
          actorUserId: input.actorUserId,
        },
        runTx,
      );
      await this.repo.updateCachedBalance(input.merchantId, input.amount, runTx);
      return { previousBalance: ledgerBalance, newBalance, txId: row.id };
    });

    this.audit.log({
      actorType: 'ADMIN',
      actorUserId: input.actorUserId,
      action: 'credits.adjusted',
      targetType: 'merchant',
      targetId: input.merchantId,
      metadata: {
        amount: input.amount.toString(),
        previousBalance: result.previousBalance.toString(),
        newBalance: result.newBalance.toString(),
        reason: input.reason,
        ledgerType: input.amount > 0n ? 'GRANT' : 'CONSUME',
      },
    });

    return result;
  }

  // ── reconcile ──────────────────────────────────────────────────────────

  /**
   * Nightly job (14.4): if the cached balance drifted from the ledger
   * sum, insert an ADJUSTMENT row for the delta and fix the cache.
   *
   * The ADJUSTMENT row is an AUDIT record only (sumLedger excludes it),
   * so this write never shifts the ledger sum it just measured — the
   * cache is set to the pre-insertion sum, which remains the truth.
   */
  async reconcile(merchantId: string): Promise<ReconcileResult> {
    const previousBalance = await this.repo.findBalance(merchantId);
    const ledgerBalance = await this.repo.sumLedgerForMerchant(merchantId);
    const drift = ledgerBalance - previousBalance;

    if (drift === 0n) {
      return { merchantId, previousBalance, ledgerBalance, drift: 0n, adjusted: false };
    }

    await this.prisma.$transaction(async (runTx) => {
      await this.safeInsert(
        'reconcile',
        {
          merchantId,
          type: 'ADJUSTMENT',
          amount: drift,
          balanceAfter: ledgerBalance,
          reason: 'reconciliation',
        },
        runTx,
      );
      // Set the cache back to the ledger sum by applying the signed
      // drift as an increment — absolute writes would clobber any
      // concurrent consume/grant.
      await this.repo.updateCachedBalance(merchantId, drift, runTx);
    });

    this.audit.log({
      actorType: 'SYSTEM',
      action: 'credits.reconciled',
      targetType: 'merchant',
      targetId: merchantId,
      metadata: {
        drift: drift.toString(),
        previousBalance: previousBalance.toString(),
        ledgerBalance: ledgerBalance.toString(),
      },
    });

    return { merchantId, previousBalance, ledgerBalance, drift, adjusted: true };
  }

  // ── read models ────────────────────────────────────────────────────────

  async getBalance(merchantId: string): Promise<{ balance: bigint; unlimited: boolean }> {
    const [balance, ctx] = await Promise.all([
      this.repo.findBalance(merchantId),
      this.repo.findSubscriptionContext(merchantId),
    ]);
    return { balance, unlimited: ctx?.unlimited ?? false };
  }

  async getHistory(
    merchantId: string,
    query: ListCreditHistoryQuery,
  ): Promise<Paginated<CreditTransactionDto>> {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const { rows, total } = await this.repo.listHistory(merchantId, {
      page,
      pageSize,
      sortOrder: query.sortOrder ?? 'desc',
    });
    return {
      data: rows.map((row) => this.toDto(row)),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // ── submission gate (14.3) ─────────────────────────────────────────────

  /** Called by POST /verifications BEFORE enqueueing. */
  async checkSubmissionAllowed(merchantId: string): Promise<SubmissionCheckResult> {
    const [balance, ctx] = await Promise.all([
      this.repo.findBalance(merchantId),
      this.repo.findSubscriptionContext(merchantId),
    ]);

    if (ctx && ctx.status === 'EXPIRED') {
      return {
        allowed: false,
        reason: 'SUBSCRIPTION_EXPIRED',
        balance,
        unlimited: false,
        lowBalance: false,
      };
    }

    if (ctx?.unlimited) {
      return { allowed: true, balance, unlimited: true, lowBalance: false };
    }

    if (balance === 0n) {
      return {
        allowed: false,
        reason: 'INSUFFICIENT_CREDITS',
        balance,
        unlimited: false,
        lowBalance: false,
      };
    }

    return {
      allowed: true,
      balance,
      unlimited: false,
      lowBalance: balance <= LOW_CREDITS_WARNING_THRESHOLD,
    };
  }

  // ── internals ──────────────────────────────────────────────────────────

  /** Participate in an existing tx, or open a fresh one. */
  private async runInTx<T>(tx: Tx | undefined, fn: (runTx: Tx) => Promise<T>): Promise<T> {
    if (tx) return fn(tx);
    return this.prisma.$transaction(fn);
  }

  /** Wrap the append-only insert; surface unexpected DB failures as 500s. */
  private async safeInsert(
    operation: 'consume' | 'grant' | 'reconcile' | 'adjust',
    input: Parameters<CreditsRepository['insertCreditTx']>[0],
    tx: Tx,
  ) {
    try {
      return await this.repo.insertCreditTx(input, tx);
    } catch (err) {
      this.logger.error({ event: 'credits.ledger.insert.failed', operation, error: String(err) });
      throw new CreditLedgerError(operation, { originalError: String(err).slice(0, 400) });
    }
  }

  /** Audit the outcome (outside the tx — audit is append-only and never blocks). */
  private auditConsumed(
    input: ConsumeInput,
    consumed: bigint,
    newBalance: bigint,
    idempotentReplay: boolean,
  ): void {
    this.audit.log({
      actorType: 'USER',
      actorUserId: input.actorUserId,
      action: 'credits.consumed',
      targetType: 'verification',
      targetId: input.verificationId,
      metadata: {
        merchantId: input.merchantId,
        consumed: consumed.toString(),
        newBalance: newBalance.toString(),
        idempotentReplay,
      },
    });
  }

  private toDto(row: CreditTransaction): CreditTransactionDto {
    return {
      id: row.id,
      merchantId: row.merchantId,
      type: row.type,
      amount: row.amount.toString(),
      balanceAfter: row.balanceAfter.toString(),
      verificationId: row.verificationId,
      billingVerificationId: row.billingVerificationId,
      subscriptionId: row.subscriptionId,
      reason: row.reason,
      actorUserId: row.actorUserId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
