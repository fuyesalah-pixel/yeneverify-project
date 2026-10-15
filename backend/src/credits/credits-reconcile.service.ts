import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { AppConfigService } from '../config';

// ============================================================
// Yene Verify — Credits Reconciliation Service
//
// Purpose:
//   merchants.credits_balance is a cached column for fast reads.
//   The immutable credit_transactions ledger is always authoritative.
//   This service compares the two and alerts on any drift.
//
// Runs:
//   - Nightly as a BullMQ scheduled job (cron: 0 2 * * *)
//   - On-demand via admin endpoint (future Step 8+)
//   - At startup in non-production for early drift detection
//
// From MASTER_CONTEXT.md §19.9:
//   "Any code path that gates a verification reads the ledger sum —
//    never the cache."
//
// Usage:
//   const result = await creditsReconcileService.reconcileAll();
//   const result = await creditsReconcileService.reconcileMerchant(merchantId);
// ============================================================

export interface ReconciliationResult {
  merchantId: string;
  ledgerBalance: bigint;
  cachedBalance: bigint;
  hasDrift: boolean;
  delta: bigint;
  fixedAt?: Date;
}

export interface ReconciliationSummary {
  checkedAt: Date;
  totalMerchants: number;
  driftCount: number;
  results: ReconciliationResult[];
  durationMs: number;
}

@Injectable()
export class CreditsReconcileService {
  private readonly logger = new Logger(CreditsReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    _config: AppConfigService,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Reconciles ALL merchants.
   * Called by the nightly cron job.
   * Fixes any detected drift and logs to audit_logs.
   */
  async reconcileAll(): Promise<ReconciliationSummary> {
    const startedAt = Date.now();
    this.logger.log('Starting nightly credit reconciliation for all merchants…');

    const merchants = await this.prisma.merchant.findMany({
      where: { deletedAt: null },
      select: { id: true, creditsBalance: true },
    });

    const results: ReconciliationResult[] = [];
    let driftCount = 0;

    for (const merchant of merchants) {
      const result = await this.reconcileMerchant(merchant.id);
      results.push(result);
      if (result.hasDrift) driftCount++;
    }

    const summary: ReconciliationSummary = {
      checkedAt: new Date(),
      totalMerchants: merchants.length,
      driftCount,
      results,
      durationMs: Date.now() - startedAt,
    };

    if (driftCount > 0) {
      this.logger.warn(
        `Reconciliation complete: ${driftCount}/${merchants.length} merchants had drift. ` +
          `All corrected. Duration: ${summary.durationMs}ms`,
      );
    } else {
      this.logger.log(
        `Reconciliation complete: ${merchants.length} merchants checked, no drift found. ` +
          `Duration: ${summary.durationMs}ms`,
      );
    }

    return summary;
  }

  /**
   * Reconciles a SINGLE merchant.
   * Reads the authoritative ledger sum, compares to the cached column,
   * and fixes drift if found.
   * Safe to call at any time — uses a transaction to prevent race conditions.
   */
  async reconcileMerchant(merchantId: string): Promise<ReconciliationResult> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Compute authoritative balance from the immutable ledger
      const ledgerResult = await tx.creditTransaction.aggregate({
        where: { merchantId },
        _sum: { amount: true },
      });

      const ledgerBalance = ledgerResult._sum.amount ?? 0n;

      // 2. Read the cached balance
      const merchant = await tx.merchant.findUniqueOrThrow({
        where: { id: merchantId },
        select: { creditsBalance: true },
      });

      const cachedBalance = merchant.creditsBalance;
      const delta = ledgerBalance - cachedBalance;
      const hasDrift = delta !== 0n;

      if (hasDrift) {
        this.logger.warn(
          `Credit drift detected for merchant ${merchantId}: ` +
            `ledger=${ledgerBalance}, cache=${cachedBalance}, delta=${delta}`,
        );

        // 3. Fix the cache
        await tx.merchant.update({
          where: { id: merchantId },
          data: {
            creditsBalance: ledgerBalance,
            creditsUpdatedAt: new Date(),
          },
        });

        // 4. Write an audit log entry for the correction
        // Import newId lazily to avoid circular dep issues
        const { newId } = await import('../common/utils/uuid');
        await tx.auditLog.create({
          data: {
            id: newId(),
            actorType: 'SYSTEM',
            merchantId,
            action: 'credit.reconcile.fix',
            targetType: 'merchant',
            targetId: merchantId,
            before: { creditsBalance: cachedBalance.toString() },
            after: { creditsBalance: ledgerBalance.toString() },
            metadata: {
              delta: delta.toString(),
              ledgerBalance: ledgerBalance.toString(),
              cachedBalance: cachedBalance.toString(),
            },
          },
        });

        return {
          merchantId,
          ledgerBalance,
          cachedBalance,
          hasDrift: true,
          delta,
          fixedAt: new Date(),
        };
      }

      return {
        merchantId,
        ledgerBalance,
        cachedBalance,
        hasDrift: false,
        delta: 0n,
      };
    });
  }

  /**
   * Reads the AUTHORITATIVE credit balance from the ledger.
   * Use this for any gate check (can this merchant verify?).
   * NEVER use merchants.credits_balance for gating decisions.
   */
  async getLedgerBalance(merchantId: string): Promise<bigint> {
    const result = await this.prisma.creditTransaction.aggregate({
      where: { merchantId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0n;
  }

  /**
   * Checks whether a merchant has enough credits to perform a verification.
   * Reads from the ledger sum (authoritative), not the cache.
   *
   * @returns true if the merchant has at least 1 credit remaining,
   *          false if they are at 0 (hard block).
   */
  async hasCreditsForVerification(merchantId: string): Promise<boolean> {
    // Check active subscription — unlimited plans bypass credit check
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { currentPackageCode: true },
    });

    if (
      merchant?.currentPackageCode === 'PREMIUM' ||
      merchant?.currentPackageCode === 'BUSINESS_PRO' ||
      merchant?.currentPackageCode === 'API'
    ) {
      return true; // unlimited plan
    }

    const balance = await this.getLedgerBalance(merchantId);
    return balance > 0n;
  }

  /**
   * Deducts one credit for a completed verification.
   * Writes a CONSUME entry to the immutable ledger.
   * Also updates the cached balance transactionally.
   *
   * Called by VerificationService after a successful verification.
   * NOT called for billing verifications (they are free).
   */
  async consumeCredit(merchantId: string, verificationId: string): Promise<void> {
    const { newId } = await import('../common/utils/uuid');

    await this.prisma.$transaction(async (tx) => {
      // Lock the merchant row to prevent race conditions
      const merchant = await tx.$queryRaw<[{ credits_balance: bigint }]>`
        SELECT credits_balance FROM merchants
        WHERE id = ${merchantId}::uuid
        FOR UPDATE
      `;

      const currentBalance = merchant[0]?.credits_balance ?? 0n;

      if (currentBalance <= 0n) {
        throw new Error(`CREDITS_INSUFFICIENT: merchant ${merchantId} has no credits`);
      }

      const newBalance = currentBalance - 1n;

      // Append to immutable ledger
      await tx.creditTransaction.create({
        data: {
          id: newId(),
          merchantId,
          type: 'CONSUME',
          amount: -1n,
          balanceAfter: newBalance,
          verificationId,
          reason: 'Verification credit consumption',
        },
      });

      // Update cache
      await tx.merchant.update({
        where: { id: merchantId },
        data: {
          creditsBalance: newBalance,
          creditsUpdatedAt: new Date(),
        },
      });
    });

    this.logger.debug(`Credit consumed for merchant ${merchantId}, verification ${verificationId}`);
  }

  /**
   * Grants credits to a merchant (e.g., after a billing verification is approved).
   * Writes a GRANT entry to the immutable ledger.
   * Also updates the cached balance transactionally.
   */
  async grantCredits(
    merchantId: string,
    amount: bigint,
    opts: {
      subscriptionId?: string;
      billingVerificationId?: string;
      reason?: string;
      actorUserId?: string;
    } = {},
  ): Promise<void> {
    const { newId } = await import('../common/utils/uuid');

    await this.prisma.$transaction(async (tx) => {
      const merchant = await tx.$queryRaw<[{ credits_balance: bigint }]>`
        SELECT credits_balance FROM merchants
        WHERE id = ${merchantId}::uuid
        FOR UPDATE
      `;

      const currentBalance = merchant[0]?.credits_balance ?? 0n;
      const newBalance = currentBalance + amount;

      await tx.creditTransaction.create({
        data: {
          id: newId(),
          merchantId,
          type: 'GRANT',
          amount,
          balanceAfter: newBalance,
          subscriptionId: opts.subscriptionId,
          billingVerificationId: opts.billingVerificationId,
          reason: opts.reason ?? 'Package activation',
          actorUserId: opts.actorUserId,
        },
      });

      await tx.merchant.update({
        where: { id: merchantId },
        data: {
          creditsBalance: newBalance,
          creditsUpdatedAt: new Date(),
        },
      });
    });

    this.logger.log(`Granted ${amount} credits to merchant ${merchantId}`);
  }
}
