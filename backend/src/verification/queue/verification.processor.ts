// ============================================================
// Yene Verify — Verification Processor (13E.2)
//
// BullMQ worker for QUEUE_NAMES.VERIFICATION. Dequeues a
// { verificationId } job, calls VerificationsService.process(),
// and decides: done, or retry.
//
// RETRY SEMANTICS (the critical distinction):
//   - process() RETURNED a verdict (VERIFIED/FAKE/DUPLICATE/NEEDS_REVIEW)
//     → job succeeds. Verdicts are definitive; re-running them would
//     hammer banks for receipts that don't exist (accidental DoS).
//   - process() RETURNED ERROR with a retryable code (timeout/
//     adapter error/unavailable) → throw, BullMQ re-attempts.
//   - process() RETURNED ERROR with a non-retryable code
//     (reference not found, OCR garbage…) → job succeeds; the ERROR
//     status is already persisted for the merchant to see.
//   - process() THREW (infra bug, DB down) → mark the row ERROR so
//     nobody is stuck PENDING, then re-throw for BullMQ retries.
// ============================================================

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { AppConfigService } from '../../config/config.service';
import { VerificationsService } from '../verifications/verifications.service';
import { VerificationsRepository } from '../verifications/verifications.repository';
import { CreditsService, LOW_CREDITS_WARNING_THRESHOLD } from '../../credits/credits.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { BillingService } from '../../billing/billing.service';
import type { BillingVerdict } from '../../billing/billing.repository';
import { AuditService } from '../../audit/audit.service';
import { ERROR_CODES } from '../../common/constants/error-codes';

/** Error codes whose ERROR verdict is worth another adapter attempt. */
const RETRYABLE_ERROR_CODES = new Set([
  'BANK_ADAPTER_TIMEOUT',
  'BANK_ADAPTER_ERROR',
  'BANK_ADAPTER_UNAVAILABLE',
]);

/** User-facing push title for each terminal verdict. */
const VERDICT_NOTIFICATION_TITLE: Record<string, string> = {
  VERIFIED: 'Payment verified',
  DUPLICATE: 'Duplicate receipt',
  FAKE: 'Fake receipt detected',
  ERROR: 'Verification failed',
  NEEDS_REVIEW: 'Needs review',
};

/** User-facing push body for each terminal verdict. */
function verdictBody(result: {
  status: string;
  bankReference: string | null;
  amountMinor: bigint | null;
}): string {
  switch (result.status) {
    case 'VERIFIED':
      return `Reference ${result.bankReference ?? ''} verified successfully.`.replace('  ', ' ');
    case 'FAKE':
      return `Reference ${result.bankReference ?? ''} could not be verified with the bank.`;
    case 'DUPLICATE':
      return `Reference ${result.bankReference ?? ''} was already verified before.`;
    default:
      return 'This verification needs your attention. Open the app for details.';
  }
}

/**
 * Thrown ONLY for retryable outcomes. BullMQ counts it against the
 * job's attempts budget; everything else completes the job.
 */
export class RetryableJobError extends Error {
  readonly errorCode: string;
  constructor(errorCode: string) {
    super(`Retryable adapter error: ${errorCode}`);
    this.name = 'RetryableJobError';
    this.errorCode = errorCode;
  }
}

type VerificationJobData = { verificationId: string };

@Processor(QUEUE_NAMES.VERIFICATION)
@Injectable()
export class VerificationProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(VerificationProcessor.name);

  constructor(
    private readonly service: VerificationsService,
    private readonly repo: VerificationsRepository,
    private readonly config: AppConfigService,
    private readonly credits: CreditsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly billing: BillingService,
  ) {
    super();
  }

  /** Apply the env-driven worker concurrency (QUEUE_VERIFICATION_CONCURRENCY). */
  onModuleInit(): void {
    this.worker.concurrency = this.config.queue.verificationConcurrency;
  }

  async process(job: Job<VerificationJobData>): Promise<void> {
    const { verificationId } = job.data;
    const attempt = job.attemptsMade + 1;
    const startedAt = Date.now();

    this.logger.log(
      `verification.job.start jobId=${String(job.id)} verificationId=${verificationId} attempt=${attempt}`,
    );

    try {
      // Real merchant identity, loaded from the row the service reads
      // anyway — process() uses these for duplicate firstMerchantId and
      // audit attribution. A literal 'system' would poison both.
      const actorFields = await this.loadActorFields(verificationId);
      const result = await this.service.process({
        verificationId,
        ...actorFields,
        requestId: `job:${String(job.id)}`,
      });

      if (result.status === 'ERROR') {
        if (result.errorCode && RETRYABLE_ERROR_CODES.has(result.errorCode)) {
          const attempts = this.config.queue.jobAttempts;
          if (attempt < attempts) {
            // Retry path: NO consume here — the retry re-runs the adapter
            // and the terminal attempt settles then.
            throw new RetryableJobError(result.errorCode);
          }
          this.logger.warn(
            `verification.job.exhausted verificationId=${verificationId} errorCode=${result.errorCode} attempts=${attempt}`,
          );
          await this.settleVerdict(actorFields, result, verificationId);
          this.notifyVerdict(actorFields, result, verificationId);
          return;
        }
        // Non-retryable: verdict is final ERROR already persisted.
        await this.settleVerdict(actorFields, result, verificationId);
        this.notifyVerdict(actorFields, result, verificationId);
        this.logger.log(
          `verification.job.complete (non-retryable ERROR) verificationId=${verificationId} attempt=${attempt} durationMs=${Date.now() - startedAt} status=${result.status}`,
        );
        return;
      }

      // Any other terminal verdict (VERIFIED/FAKE/DUPLICATE/NEEDS_REVIEW)
      // is settled after process() committed it.
      await this.settleVerdict(actorFields, result, verificationId);
      this.notifyVerdict(actorFields, result, verificationId);
      this.logger.log(
        `verification.job.complete verificationId=${verificationId} attempt=${attempt} durationMs=${Date.now() - startedAt} status=${result.status}`,
      );
    } catch (err) {
      if (err instanceof RetryableJobError) throw err;
      // Unexpected failure: never leave a merchant PENDING forever.
      // Best-effort — the original error must not be masked.
      await this.repo
        .markErrorIfPending(verificationId, ERROR_CODES.VERIFICATION_QUEUE_FAILURE)
        .catch(() => undefined);
      throw err;
    }
  }

  /**
   * Pushes the terminal verdict to the user who asked for the check
   * (Step 15: VERIFICATION_RESULT via the notify() choke point).
   *
   * Fully fire-and-forget: never awaited from the job path, never
   * allows a notification failure (row-creation included) to affect
   * a verdict or its billing — both have already committed by now.
   */
  private notifyVerdict(
    actorFields: { merchantId: string; requestedByUserId: string; source: string },
    result: {
      status: string;
      bankReference: string | null;
      amountMinor: bigint | null;
    },
    verificationId: string,
  ): void {
    // BILLING verifications notify through the billing handler with
    // billing-specific copy — the generic verdict push would be noise.
    if (actorFields.source === 'BILLING') return;

    const title = VERDICT_NOTIFICATION_TITLE[result.status] ?? 'Verification update';
    this.notifications
      .notify({
        userId: actorFields.requestedByUserId,
        merchantId: actorFields.merchantId,
        type: 'VERIFICATION_RESULT',
        title,
        body: verdictBody(result),
        data: {
          verificationId,
          status: result.status,
          ...(result.bankReference ? { bankReference: result.bankReference } : {}),
        },
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `notification.verification_result.failed verificationId=${verificationId} error=${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }

  /**
   * Post-verdict routing, after process() has committed the verdict:
   *
   *   source=BILLING      → BillingService (credits/consume path is
   *   SKIPPED entirely per the Step 16 policy: BILLING verifications
   *   consume 0 credits — the merchant is BUYING them). Errors must
   *   never retry the job: re-running would re-verify the payment.
   *   source=TRANSACTION  → billed per CREDIT_COST, low-balance
   *   inbox hooks fire exactly as in 14.x.
   */
  private async settleVerdict(
    actorFields: { merchantId: string; requestedByUserId: string; source: string },
    result: {
      status: string;
      errorCode?: string | null;
      errorMessage?: string | null;
      amountMinor?: bigint | null;
      bankCode?: string | null;
      bankReference?: string | null;
      senderName?: string | null;
      receiverName?: string | null;
      paidAt?: Date | null;
    },
    verificationId: string,
  ): Promise<void> {
    if (actorFields.source === 'BILLING') {
      try {
        await this.billing.handleVerificationResultForVerification(verificationId, {
          status: result.status as BillingVerdict['status'],
          amountMinor: result.amountMinor ?? null,
          bankCode: result.bankCode ?? null,
          bankReference: result.bankReference ?? null,
          senderName: result.senderName ?? null,
          receiverName: result.receiverName ?? null,
          paidAt: result.paidAt ?? null,
          errorCode: result.errorCode ?? null,
          errorMessage: result.errorMessage ?? null,
        });
      } catch (err) {
        // The billing handler is designed not to throw; a failure here is
        // an infra bug. Log + audit, complete the job — NEVER throw, or
        // BullMQ would re-verify an already-settled payment.
        this.logger.error(
          `billing.settle_failed verificationId=${verificationId} error=${err instanceof Error ? err.message : String(err)}`,
        );
        this.audit.log({
          actorType: 'SYSTEM',
          action: 'billing.settle_failed',
          targetType: 'verification',
          targetId: verificationId,
          metadata: {
            merchantId: actorFields.merchantId,
            verdict: result.status,
            reason: err instanceof Error ? err.message : String(err),
          },
        });
      }
      return;
    }
    await this.consumeForVerdict(actorFields.merchantId, verificationId, result);
  }

  /**
   * Bills the verdict AFTER process() has committed it. Deliberately a
   * SEPARATE transaction: if consume fails (say the merchant raced out
   * of credits between submit and process), the verdict still stands —
   * we never let a credit-accounting error hide a legitimate answer.
   * Failures are logged + audited ('credits.consume_failed') and the
   * job completes normally.
   */
  private async consumeForVerdict(
    merchantId: string,
    verificationId: string,
    result: { status: string },
  ): Promise<void> {
    try {
      const consumeResult = await this.credits.consume({
        merchantId,
        verificationId,
        verificationStatus: result.status,
      });
      // Fire-and-forget inbox stubs (FCM delivery is Step 15). Never
      // delay the job on a notification write.
      if (consumeResult.consumed > 0n) {
        if (consumeResult.newBalance === 0n) {
          this.notifications.notifyExhausted(merchantId).catch(() => undefined);
        } else if (consumeResult.newBalance <= LOW_CREDITS_WARNING_THRESHOLD) {
          this.notifications
            .notifyLowBalance(merchantId, consumeResult.newBalance)
            .catch(() => undefined);
        }
      }
    } catch (err) {
      this.logger.error(
        `credits.consume_failed verificationId=${verificationId} status=${result.status} merchantId=${merchantId} error=${err instanceof Error ? err.message : String(err)}`,
      );
      // Audit is append-only — log-and-continue, never block the job.
      this.audit.log({
        actorType: 'SYSTEM',
        action: 'credits.consume_failed',
        targetType: 'verification',
        targetId: verificationId,
        metadata: {
          merchantId,
          verificationStatus: result.status,
          reason: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  /**
   * Loads the actor identity WITHOUT consuming process()'s idempotent
   * replay path: read-only look now, process() re-loads internally.
   */
  private async loadActorFields(
    verificationId: string,
  ): Promise<{ merchantId: string; requestedByUserId: string; source: string }> {
    const loaded = await this.repo.loadForProcessing(verificationId);
    if (!loaded) {
      // Let process() raise VerificationNotFoundError itself.
      return { merchantId: 'missing', requestedByUserId: 'missing', source: 'TRANSACTION' };
    }
    return {
      merchantId: loaded.verification.merchantId,
      requestedByUserId: loaded.verification.verifiedByUserId,
      source: loaded.verification.source ?? 'TRANSACTION',
    };
  }

  // ── Worker observability events (log-only) ──

  @OnWorkerEvent('completed')
  onCompleted(job: Job<VerificationJobData>): void {
    const duration = job.processedOn ? job.processedOn - job.timestamp : 0;
    this.logger.log(
      `worker.completed jobId=${String(job.id)} verificationId=${String(job.data?.verificationId ?? '')} durationMs=${duration}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<VerificationJobData> | undefined, err: Error): void {
    this.logger.error(`worker.failed jobId=${String(job?.id ?? '')} error=${err.message}`);
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error(`worker.error error=${err.message}`);
  }
}
