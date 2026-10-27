// ============================================================
// Yene Verify — Verification Queue Service (13E.2)
//
// Thin producer over the VERIFICATION BullMQ queue. Two enqueues
// for the same verificationId collapse into ONE job (BullMQ dedups
// on equal jobId), so double-click retries are safe.
//
// HTTP endpoints that call this live in 13E.3 — nothing here is
// route-exposed.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { AppConfigService } from '../../config/config.service';

export const VERIFICATION_JOB_NAME = 'process-verification';
// BullMQ forbids ':' inside custom job ids (Custom Id cannot contain
// ':'), so the dedup prefix uses a dash instead of the natural
// 'verification:<uuid>' colon form.
export const VERIFICATION_JOB_ID_PREFIX = 'verification-';

@Injectable()
export class VerificationQueueService {
  private readonly logger = new Logger(VerificationQueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.VERIFICATION) private readonly queue: Queue,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Enqueue a verification for processing. Idempotent per verificationId:
   * BullMQ refuses a second job while the first is still waiting.
   */
  async enqueue(verificationId: string, opts?: { delayMs?: number }): Promise<void> {
    const jobId = `${VERIFICATION_JOB_ID_PREFIX}${verificationId}`;
    await this.queue.add(
      VERIFICATION_JOB_NAME,
      { verificationId },
      {
        jobId,
        attempts: this.config.queue.jobAttempts,
        backoff: { type: 'exponential', delay: this.config.queue.backoffMs },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400, count: 5000 },
        ...(opts?.delayMs !== undefined && { delay: opts.delayMs }),
      },
    );
  }

  /**
   * Manual retry (admin/merchant driven in 13E.3).
   *
   * BullMQ ADD script dedups on custom jobId against a job hash that exists
   * in ANY state — including retained completed/failed jobs (removeOnComplete
   * keeps them for 1h). A bare re-add is therefore a silent no-op after a
   * terminal attempt. Only an ACTIVE/WAITING job may legitimately block a
   * retry, so we remove terminal leftovers first, then enqueue. If enqueue
   * still dedups (mid-flight retry race), process()'s idempotent replay is
   * the backstop.
   */
  async retry(verificationId: string): Promise<void> {
    this.logger.log(`Manual retry requested for verification ${verificationId}`);
    const jobId = `${VERIFICATION_JOB_ID_PREFIX}${verificationId}`;
    try {
      const existing = await this.queue.getJob(jobId);
      if (existing && ['completed', 'failed'].includes(await existing.getState())) {
        await existing.remove();
        this.logger.log(`Removed terminal job ${jobId} before re-enqueue`);
      }
    } catch (err) {
      // Removing is best-effort; if the job is mid-state removal is refused.
      this.logger.warn(`Job cleanup before retry skipped: ${(err as Error).message}`);
    }
    await this.enqueue(verificationId);
  }

  /** Redis reachability probe for health surfaces. */
  async health(): Promise<boolean> {
    try {
      // IRedisClient's public type omits PING; any live client understands it.
      const client = (await this.queue.client) as unknown as
        { ping?: () => Promise<unknown> } | undefined;
      await client?.ping?.();
      return true;
    } catch {
      return false;
    }
  }
}
