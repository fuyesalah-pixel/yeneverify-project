// ============================================================
// Yene Verify — Export Expiry Job (Step 19)
//
// BullMQ repeatable job on QUEUE_NAMES.MAINTENANCE, daily 04:00
// Africa/Addis_Ababa. Finds READY exports whose expires_at has
// passed and, for each one:
//   - deletes the stored file (best effort; missing file is fine)
//   - flips the row to EXPIRED
//
// One row's failure never stops the walk — and the shared
// MAINTENANCE queue means every job name is guarded, exactly like
// ReconciliationJob.
// ============================================================

import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { ExportsRepository } from '../exports.repository';
import { StorageService } from '../../storage/storage.service';

export const EXPIRE_EXPORTS_JOB_NAME = 'expire-exports';
export const EXPIRE_EXPORTS_REPEAT_PATTERN = '0 4 * * *';
export const EXPIRE_EXPORTS_TZ = 'Africa/Addis_Ababa';

@Processor(QUEUE_NAMES.MAINTENANCE)
@Injectable()
export class ExportsExpiryJob extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ExportsExpiryJob.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.MAINTENANCE) private readonly queue: Queue,
    private readonly repo: ExportsRepository,
    private readonly storage: StorageService,
  ) {
    super();
  }

  /** Registrable on every boot; BullMQ upserts repeatables by jobId+pattern. */
  onModuleInit(): void {
    void this.queue
      .add(
        EXPIRE_EXPORTS_JOB_NAME,
        {},
        {
          repeat: { pattern: EXPIRE_EXPORTS_REPEAT_PATTERN, tz: EXPIRE_EXPORTS_TZ },
          jobId: EXPIRE_EXPORTS_JOB_NAME,
          removeOnComplete: { age: 86_400, count: 30 },
          removeOnFail: { age: 86_400, count: 30 },
        },
      )
      .then(() => {
        this.logger.log(
          `expire-exports.schedule.registered pattern=${EXPIRE_EXPORTS_REPEAT_PATTERN} tz=${EXPIRE_EXPORTS_TZ}`,
        );
      })
      .catch((err: unknown) => {
        this.logger.error(
          `expire-exports.schedule.register.failed error=${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }

  async process(job: Job): Promise<void> {
    if (job.name !== EXPIRE_EXPORTS_JOB_NAME) {
      return; // Shared queue — ignore other maintenance jobs.
    }

    const now = new Date();
    const expired = await this.repo.findExpiredReady(now);

    let expiredCount = 0;
    let failed = 0;
    for (const row of expired) {
      try {
        // The stored object may already be gone (external cleanup):
        // the row transition is the contract, the delete is hygiene.
        if (row.storageKey) {
          await this.storage.delete(row.storageKey).catch(() => undefined);
        }
        await this.repo.markExpired(row.id);
        expiredCount += 1;
      } catch (err) {
        failed += 1;
        this.logger.error(
          `expire-exports.row.failed exportId=${row.id} error=${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    this.logger.log(
      `expire-exports.completed candidates=${expired.length} expired=${expiredCount} failed=${failed}`,
    );
  }
}
