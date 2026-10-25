// ============================================================
// Yene Verify — VerificationQueueService Unit Tests (13E.2)
//
// Queue is mocked; the mock ADDS BullMQ's jobId-dedup contract so
// the "two enqueues → one job" assertion exercises the semantics we
// rely on, not just call counts.
// ============================================================

import type { Queue } from 'bullmq';
import { VerificationQueueService } from './verification-queue.service';

type AddedJob = { name: string; data: unknown; opts: Record<string, unknown> };

function makeQueueMock(config: { jobAttempts: number; backoffMs: number }) {
  const waitlist = new Map<string, AddedJob>();
  const added: AddedJob[] = [];

  const queue = {
    add: async (name: string, data: unknown, opts: Record<string, unknown>) => {
      const jobId = String(opts['jobId']);
      if (waitlist.has(jobId)) return undefined; // BullMQ dedup contract
      const job = { name, data, opts };
      waitlist.set(jobId, job);
      added.push(job);
      return job;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: { ping: async (): Promise<any> => 'PONG' },
    __config: config,
  } as unknown as Queue & { __config: typeof config };

  return { queue, added, waitlist, config };
}

const CONFIG = { jobAttempts: 3, backoffMs: 2000 } as const;
// The fake queue needs a config object unreachable from the service;
// the service reads attempts/backoff from AppConfigService (mocked).

describe('VerificationQueueService', () => {
  let service: VerificationQueueService;
  let queueMock: ReturnType<typeof makeQueueMock>;

  beforeEach(() => {
    queueMock = makeQueueMock(CONFIG);
    service = new VerificationQueueService(
      queueMock.queue,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { queue: CONFIG } as any,
    );
  });

  // ── enqueue() ────────────────────────────────────────────────────────

  it('uses jobId = verification:<id>', async () => {
    await service.enqueue('vid-1');
    expect(queueMock.added[0].opts['jobId']).toBe('verification:vid-1');
  });

  it('sets attempts: 3 from config', async () => {
    await service.enqueue('vid-1');
    expect(queueMock.added[0].opts['attempts']).toBe(3);
  });

  it('sets exponential backoff', async () => {
    await service.enqueue('vid-1');
    expect(queueMock.added[0].opts['backoff']).toEqual({
      type: 'exponential',
      delay: 2000,
    });
  });

  it('sets removeOnComplete and removeOnFail retention windows', async () => {
    await service.enqueue('vid-1');
    expect(queueMock.added[0].opts['removeOnComplete']).toEqual({ age: 3600, count: 1000 });
    expect(queueMock.added[0].opts['removeOnFail']).toEqual({ age: 86400, count: 5000 });
  });

  it('forwards delayMs as a job delay option', async () => {
    await service.enqueue('vid-1', { delayMs: 5000 });
    expect(queueMock.added[0].opts['delay']).toBe(5000);
  });

  it('omits delay when delayMs is not provided', async () => {
    await service.enqueue('vid-1');
    expect('delay' in queueMock.added[0].opts).toBe(false);
  });

  it('carries the verificationId in the job payload', async () => {
    await service.enqueue('vid-9');
    expect(queueMock.added[0].data).toEqual({ verificationId: 'vid-9' });
    expect(queueMock.added[0].name).toBe('process-verification');
  });

  // ── jobId dedup (BullMQ contract) ─────────────────────────────────────

  it('two enqueues for the same verificationId produce ONE job', async () => {
    await service.enqueue('vid-dedup');
    await service.enqueue('vid-dedup');
    expect(queueMock.added).toHaveLength(1);
  });

  it('enqueues for different verificationIds do NOT collide', async () => {
    await service.enqueue('vid-a');
    await service.enqueue('vid-b');
    expect(queueMock.added).toHaveLength(2);
  });

  // ── retry() ──────────────────────────────────────────────────────────

  it('retry() re-enqueues with the same idempotent jobId', async () => {
    await service.retry('vid-1');
    expect(queueMock.added[0].opts['jobId']).toBe('verification:vid-1');
    expect(queueMock.added[0].opts['attempts']).toBe(3);
  });

  it('retry() after a COMPLETED job adds a fresh job (waitlist no longer holds it)', async () => {
    // Simulate BullMQ moving the job out of the waitlist once completed.
    await service.enqueue('vid-1');
    queueMock.waitlist.delete('verification:vid-1');
    await service.retry('vid-1');
    expect(queueMock.added).toHaveLength(2);
  });

  // ── health() ─────────────────────────────────────────────────────────

  it('health() returns true when Redis pings', async () => {
    await expect(service.health()).resolves.toBe(true);
  });

  it('health() returns false when Redis is unreachable', async () => {
    // bullmq exposes a lazy client promise; a connection failure surfaces
    // when the service awaits it.
    (queueMock.queue as unknown as { client: Promise<never> }).client = Promise.reject(
      new Error('ECONNREFUSED'),
    );
    await expect(service.health()).resolves.toBe(false);
  });
});
