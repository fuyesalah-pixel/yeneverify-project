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
  // BullMQ job hashes survive in terminal states while retention keeps them
  // (removeOnComplete/removeOnFail) — and the ADD script dedups on them.
  const jobHashes = new Map<string, { state: string }>();
  const removedJobs: string[] = [];

  const queue = {
    add: async (name: string, data: unknown, opts: Record<string, unknown>) => {
      const jobId = String(opts['jobId']);
      if (jobHashes.has(jobId)) return undefined; // BullMQ dedup contract
      const job = { name, data, opts };
      jobHashes.set(jobId, { state: 'waiting' });
      waitlist.set(jobId, job);
      added.push(job);
      return job;
    },
    getJob: async (jobId: string) => {
      if (!jobHashes.has(jobId)) return null; // moved out / removed
      const record = jobHashes.get(jobId)!;
      return {
        getState: async () => record.state,
        remove: async () => {
          jobHashes.delete(jobId);
          waitlist.delete(jobId);
          removedJobs.push(jobId);
        },
      };
    },
    /** Test helper to settle a retained job in a terminal state. */
    __settle: (jobId: string, state: 'completed' | 'failed' | 'active') => {
      const record = jobHashes.get(jobId);
      if (record) record.state = state;
      waitlist.delete(jobId);
    },
    __removedJobs: removedJobs,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: { ping: async (): Promise<any> => 'PONG' },
    __config: config,
  } as unknown as Queue & { __config: typeof config };

  return { queue, added, waitlist, jobHashes, removedJobs, config };
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

  it('uses jobId = verification-<id> (BullMQ forbids colons in custom ids)', async () => {
    await service.enqueue('vid-1');
    expect(queueMock.added[0].opts['jobId']).toBe('verification-vid-1');
    expect(queueMock.added[0].opts['attempts']).toBe(3);
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

  it('enqueue dedup contract holds across terminal states until the hash is removed', async () => {
    await service.enqueue('vid-term');
    (queueMock.queue as unknown as { __settle: (id: string, s: string) => void }).__settle(
      'verification-vid-term',
      'completed',
    );
    await service.enqueue('vid-term'); // retained hash → still deduped
    expect(queueMock.added).toHaveLength(1);
  });

  it('enqueues for different verificationIds do NOT collide', async () => {
    await service.enqueue('vid-a');
    await service.enqueue('vid-b');
    expect(queueMock.added).toHaveLength(2);
  });

  // ── retry() ──────────────────────────────────────────────────────────

  // REAL BullMQ behavior (found by the e2e): the ADD script dedups on the
  // custom jobId hash in ANY state. removeOnComplete keeps completed jobs
  // for 1h, so a bare re-add is a SILENT NO-OP after a terminal attempt and
  // the verification would stay PENDING forever. retry() must clear the
  // terminal leftover first.
  it('retry() removes a retained terminal (completed) job before re-enqueueing', async () => {
    await service.enqueue('vid-1');
    (queueMock.queue as unknown as { __settle: (id: string, s: string) => void }).__settle(
      'verification-vid-1',
      'completed',
    );

    await service.retry('vid-1');
    expect(queueMock.removedJobs).toEqual(['verification-vid-1']);
    expect(queueMock.added).toHaveLength(2); // fresh job after cleanup
  });

  it('retry() also clears FAILED (dead-letter) leftovers so an admin retry can take effect', async () => {
    await service.enqueue('vid-2');
    (queueMock.queue as unknown as { __settle: (id: string, s: string) => void }).__settle(
      'verification-vid-2',
      'failed',
    );

    await service.retry('vid-2');
    expect(queueMock.removedJobs).toEqual(['verification-vid-2']);
    expect(queueMock.added).toHaveLength(2);
  });

  it('retry() leaves an ACTIVE job in place and still attempts enqueue', async () => {
    await service.enqueue('vid-3');
    (queueMock.queue as unknown as { __settle: (id: string, s: string) => void }).__settle(
      'verification-vid-3',
      'active',
    );

    await service.retry('vid-3');
    expect(queueMock.removedJobs).toEqual([]); // active job must not be destroyed
    // The retained ACTIVE hash still dedups the add (correct BullMQ semantics:
    // only one attempt may be mid-flight); the PENDING row rides until it settles.
    expect(queueMock.added).toHaveLength(1);
  });

  it('retry() with no existing job just enqueues', async () => {
    await service.retry('vid-4');
    expect(queueMock.removedJobs).toEqual([]);
    expect(queueMock.added).toHaveLength(1);
    expect(queueMock.added[0].opts['jobId']).toBe('verification-vid-4');
    expect(queueMock.added[0].opts['attempts']).toBe(3);
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
