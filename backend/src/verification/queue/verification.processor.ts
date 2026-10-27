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
import { CreditsService } from '../../credits/credits.service';
import { AuditService } from '../../audit/audit.service';
import { ERROR_CODES } from '../../common/constants/error-codes';

/** Error codes whose ERROR verdict is worth another adapter attempt. */
const RETRYABLE_ERROR_CODES = new Set([
  'BANK_ADAPTER_TIMEOUT',
  'BANK_ADAPTER_ERROR',
  'BANK_ADAPTER_UNAVAILABLE',
]);

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
            // and the terminal attempt consumes then.
            throw new RetryableJobError(result.errorCode);
          }
          this.logger.warn(
            `verification.job.exhausted verificationId=${verificationId} errorCode=${result.errorCode} attempts=${attempt}`,
          );
          await this.consumeForVerdict(actorFields.merchantId, verificationId, result);
          return;
        }
        // Non-retryable: verdict is final ERROR already persisted.
        await this.consumeForVerdict(actorFields.merchantId, verificationId, result);
        this.logger.log(
          `verification.job.complete (non-retryable ERROR) verificationId=${verificationId} attempt=${attempt} durationMs=${Date.now() - startedAt} status=${result.status}`,
        );
        return;
      }

      // Any other terminal verdict (VERIFIED/FAKE/DUPLICATE/NEEDS_REVIEW)
      // is billed according to CREDIT_COST before the job completes.
      await this.consumeForVerdict(actorFields.merchantId, verificationId, result);
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
      await this.credits.consume({ merchantId, verificationId, verificationStatus: result.status });
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
  ): Promise<{ merchantId: string; requestedByUserId: string }> {
    const loaded = await this.repo.loadForProcessing(verificationId);
    if (!loaded) {
      // Let process() raise VerificationNotFoundError itself.
      return { merchantId: 'missing', requestedByUserId: 'missing' };
    }
    return {
      merchantId: loaded.verification.merchantId,
      requestedByUserId: loaded.verification.verifiedByUserId,
    };
  }

  // ── Worker observability events (log-only; FCM dispatch is Step 15) ──

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
