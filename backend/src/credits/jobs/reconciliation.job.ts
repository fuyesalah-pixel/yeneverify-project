// ============================================================
// Yene Verify — Nightly Credits Reconciliation Job (14.3 Part B)
//
// BullMQ repeatable job on QUEUE_NAMES.MAINTENANCE, daily 03:00
// Africa/Addis_Ababa. Walks every ACTIVE merchant and asks
// CreditsService.reconcile() to compare the cached balance with
// the ledger sum — the single authoritative truth check for the
// credits feature.
//
// Failure isolation: one merchant's reconcile error never stops
// the walk. The aggregate outcome is audited as SYSTEM
// ('credits.reconciliation.completed') so ops can alert on any
// adjusted drift.
// ============================================================

import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { CreditsService } from '../credits.service';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

export const RECONCILE_JOB_NAME = 'reconcile-credits';
export const RECONCILE_REPEAT_PATTERN = '0 3 * * *';
export const RECONCIVE_TZ = 'Africa/Addis_Ababa';

interface ReconcileJobData {
  triggeredBy?: 'schedule' | 'manual';
}

@Processor(QUEUE_NAMES.MAINTENANCE)
@Injectable()
export class ReconciliationJob extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ReconciliationJob.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.MAINTENANCE) private readonly queue: Queue,
    private readonly credits: CreditsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    super();
  }

  /**
   * Registers the nightly schedule. BullMQ keys repeatables by
   * jobId + pattern, so re-running this on every app boot is
   * idempotent — it upserts rather than duplicates.
   */
  onModuleInit(): void {
    void this.queue
      .add(RECONCILE_JOB_NAME, {} satisfies ReconcileJobData, {
        repeat: { pattern: RECONCILE_REPEAT_PATTERN, tz: RECONCIVE_TZ },
        jobId: RECONCILE_JOB_NAME,
        removeOnComplete: { age: 86_400, count: 30 },
        removeOnFail: { age: 86_400, count: 30 },
      })
      .then(() => {
        this.logger.log(
          `reconcile.schedule.registered pattern=${RECONCILE_REPEAT_PATTERN} tz=${RECONCIVE_TZ}`,
        );
      })
      .catch((err: unknown) => {
        this.logger.error(
          `reconcile.schedule.register.failed error=${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }

  async process(job: Job<ReconcileJobData>): Promise<void> {
    if (job.name !== RECONCILE_JOB_NAME) {
      return; // Other maintenance jobs share this queue later.
    }

    const startedAt = Date.now();
    const merchants = await this.prisma.merchant.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });

    let reconciled = 0;
    let adjusted = 0;
    let failed = 0;
    const drifts: { merchantId: string; drift: string }[] = [];

    for (const m of merchants) {
      try {
        const result = await this.credits.reconcile(m.id);
        reconciled++;
        if (result.adjusted) {
          adjusted++;
          drifts.push({ merchantId: m.id, drift: result.drift.toString() });
          // Drift on a financial cache is worth WARN noise, always.
          this.logger.warn(
            `reconcile.drift merchantId=${m.id} previous=${result.previousBalance.toString()} ledger=${result.ledgerBalance.toString()} drift=${result.drift.toString()}`,
          );
        }
      } catch (err) {
        failed++;
        this.logger.error(
          `reconcile.failed merchantId=${m.id} error=${err instanceof Error ? err.message : String(err)}`,
        );
        // Continue to the next merchant — one failure never stops the walk.
      }
    }

    const summary = {
      merchants: merchants.length,
      reconciled,
      adjusted,
      failed,
      drifts,
      durationMs: Date.now() - startedAt,
      trigger: job.data?.triggeredBy ?? 'schedule',
    };
    this.logger.log({ event: 'reconcile.completed', ...summary }, 'reconcile.completed');

    this.audit.log({
      actorType: 'SYSTEM',
      action: 'credits.reconciliation.completed',
      metadata: { ...summary, drifts: summary.drifts },
    });
  }
}
