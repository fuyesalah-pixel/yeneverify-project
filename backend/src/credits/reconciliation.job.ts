import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';

export interface CreditReconciliationReport {
  checkedMerchants: number;
  driftedMerchants: number;
  correctedMerchants: number;
  unresolvedMerchants: number;
  maxAbsoluteDriftMinor: bigint;
  merchantIds: string[];
  generatedAt: Date;
}

/**
 * Nightly credit-cache reconciliation.
 *
 * `merchants.credits_balance` is a read-optimized cache. The immutable
 * `credit_transactions` ledger is authoritative. This job compares the two
 * using integer minor units only, repairs safe drift in one transaction, and
 * returns metadata for an alert. It never updates or deletes ledger rows.
 *
 * Scheduling is deliberately left to the queue/cron wiring step. Invoke
 * `run()` once per night with the migration/admin-capable connection policy.
 */
@Injectable()
export class CreditReconciliationJob {
  private readonly logger = new Logger(CreditReconciliationJob.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(): Promise<CreditReconciliationReport> {
    const report = await this.prisma.runAsAdmin(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          merchant_id: string;
          ledger_balance: bigint;
          cached_balance: bigint;
        }>
      >`
        SELECT
          m.id AS merchant_id,
          COALESCE(SUM(ct.amount), 0)::bigint AS ledger_balance,
          m.credits_balance AS cached_balance
        FROM merchants m
        LEFT JOIN credit_transactions ct ON ct.merchant_id = m.id
        WHERE m.deleted_at IS NULL
        GROUP BY m.id, m.credits_balance
        ORDER BY m.id
      `;

      let drifted = 0;
      let corrected = 0;
      let unresolved = 0;
      let maxAbsoluteDrift = 0n;
      const merchantIds: string[] = [];

      for (const row of rows) {
        const drift = row.ledger_balance - row.cached_balance;
        if (drift === 0n) continue;

        drifted += 1;
        const absolute = drift < 0n ? -drift : drift;
        if (absolute > maxAbsoluteDrift) maxAbsoluteDrift = absolute;
        merchantIds.push(row.merchant_id);

        // A negative ledger balance indicates corrupted data. Never write a
        // negative cache value; surface it for manual investigation instead.
        if (row.ledger_balance < 0n) {
          unresolved += 1;
          continue;
        }

        await tx.merchant.update({
          where: { id: row.merchant_id },
          data: {
            creditsBalance: row.ledger_balance,
            creditsUpdatedAt: new Date(),
          },
        });
        corrected += 1;
      }

      return {
        checkedMerchants: rows.length,
        driftedMerchants: drifted,
        correctedMerchants: corrected,
        unresolvedMerchants: unresolved,
        maxAbsoluteDriftMinor: maxAbsoluteDrift,
        merchantIds,
        generatedAt: new Date(),
      } satisfies CreditReconciliationReport;
    });

    // Log metadata only. Merchant IDs are not PII, but keep output bounded.
    this.logger.warn(
      `Credit reconciliation complete: checked=${report.checkedMerchants} ` +
        `drifted=${report.driftedMerchants} corrected=${report.correctedMerchants} ` +
        `unresolved=${report.unresolvedMerchants}`,
    );

    if (report.unresolvedMerchants > 0 || report.driftedMerchants > 0) {
      // The queue/observability adapter can turn this into an alert. Do not
      // include ledger amounts or customer data in the alert payload.
      this.logger.error('Credit reconciliation drift detected; manual review required.');
    }

    return report;
  }
}

/** Narrow helper for callers that need a typed transaction boundary. */
export type ReconciliationTransaction = Prisma.TransactionClient;
