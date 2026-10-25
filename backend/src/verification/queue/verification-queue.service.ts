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
export const VERIFICATION_JOB_ID_PREFIX = 'verification:';

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
   * Manual retry (admin/merchant driven in 13E.3). A completed or fully
   * failed job with this jobId no longer blocks re-adding, so this is a
   * fresh attempt — and process() itself replays finalized rows without
   * redoing work (proven in 13E.1).
   */
  async retry(verificationId: string): Promise<void> {
    this.logger.log(`Manual retry requested for verification ${verificationId}`);
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
