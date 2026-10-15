import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES } from './queue.constants';

/** Typed enqueue helpers for all application queues. */
@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.VERIFICATION) private readonly verificationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private readonly notificationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EXPORT) private readonly exportQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS) private readonly analyticsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MAINTENANCE) private readonly maintenanceQueue: Queue,
  ) {}

  async enqueueVerification(verificationId: string): Promise<void> {
    await this.verificationQueue.add(
      'verify-receipt',
      { verificationId },
      { jobId: verificationId },
    );
  }

  async enqueueNotification(payload: {
    userId: string;
    type: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    await this.notificationQueue.add('send-notification', payload);
  }

  async enqueueExport(exportId: string): Promise<void> {
    await this.exportQueue.add('generate-export', { exportId }, { jobId: exportId });
  }

  async enqueueAnalyticsSnapshot(merchantId: string): Promise<void> {
    await this.analyticsQueue.add('compute-snapshot', { merchantId });
  }

  async enqueueMaintenance(task: string, data?: Record<string, unknown>): Promise<void> {
    await this.maintenanceQueue.add(task, data ?? {});
  }
}
