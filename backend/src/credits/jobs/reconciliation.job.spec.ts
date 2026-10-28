// ============================================================
// Yene Verify — ReconciliationJob Unit Tests
// The walk must be per-merchant tolerant, report correct counts,
// and audit the aggregate as SYSTEM — while never treating
// non-reconcile maintenance jobs as its own.
// ============================================================

import { Logger } from '@nestjs/common';
import { ReconciliationJob, RECONCILE_JOB_NAME } from './reconciliation.job';
import { CreditsService } from '../credits.service';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

const M1 = '11111111-1111-4111-8111-111111111111';
const M2 = '22222222-2222-4222-8222-222222222222';
const M3 = '33333333-3333-4333-8333-333333333333';

type ReconcileSpy = jest.SpyInstance<ReturnType<CreditsService['reconcile']>, [merchantId: string]>;
type QueueMock = { add: jest.Mock };

function buildJob(
  creditsSpy: ReconcileSpy,
  queue: QueueMock,
  audit: { log: jest.Mock },
): ReconciliationJob {
  const job = new ReconciliationJob(
    queue as never,
    { reconcile: creditsSpy } as unknown as CreditsService,
    {
      merchant: { findMany: jest.fn().mockResolvedValue([{ id: M1 }, { id: M2 }, { id: M3 }]) },
    } as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  // WorkerHost's parent ctor needs no pool in unit tests.
  return job;
}

describe('ReconciliationJob', () => {
  let creditsSpy: ReconcileSpy;
  let queue: QueueMock;
  let audit: { log: jest.Mock };

  beforeEach(() => {
    creditsSpy = jest.fn() as unknown as ReconcileSpy;
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    audit = { log: jest.fn() };
  });

  it('onModuleInit registers a nightly repeatable job at 03:00 Africa/Addis_Ababa', async () => {
    const job = buildJob(creditsSpy, queue, audit);
    job.onModuleInit();
    await Promise.resolve(); // flush the registrations async chain
    expect(queue.add).toHaveBeenCalledTimes(1);
    const [name, , opts] = queue.add.mock.calls[0];
    expect(name).toBe('reconcile-credits');
    expect(opts.repeat).toEqual({ pattern: '0 3 * * *', tz: 'Africa/Addis_Ababa' });
    expect(opts.jobId).toBe('reconcile-credits');
    expect(opts.removeOnComplete).toEqual({ age: 86_400, count: 30 });
  });

  it('reconciles every ACTIVE merchant and reports adjusted drift', async () => {
    creditsSpy
      .mockResolvedValueOnce({
        merchantId: M1,
        previousBalance: 8n,
        ledgerBalance: 0n,
        drift: -8n,
        adjusted: false,
      })
      .mockResolvedValueOnce({
        merchantId: M2,
        previousBalance: 5n,
        ledgerBalance: 4n,
        drift: -1n,
        adjusted: true,
      })
      .mockResolvedValueOnce({
        merchantId: M3,
        previousBalance: 2n,
        ledgerBalance: 2n,
        drift: 0n,
        adjusted: false,
      });

    const job = buildJob(creditsSpy, queue, audit);
    await job.process({ name: RECONCILE_JOB_NAME, data: {} } as never);

    expect(creditsSpy).toHaveBeenCalledTimes(3);
    expect(creditsSpy).toHaveBeenCalledWith(M1);
    const [entry] = audit.log.mock.calls[0];
    expect(entry.actorType).toBe('SYSTEM');
    expect(entry.action).toBe('credits.reconciliation.completed');
    expect(entry.metadata?.adjusted).toBe(1);
    expect(entry.metadata?.reconciled).toBe(3);
    expect(entry.metadata?.failed).toBe(0);
    expect(entry.metadata?.drifts).toEqual([{ merchantId: M2, drift: '-1' }]);
  });

  it('one merchant failing does not stop the walk', async () => {
    creditsSpy
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({
        merchantId: M2,
        previousBalance: 0n,
        ledgerBalance: 0n,
        drift: 0n,
        adjusted: false,
      })
      .mockResolvedValueOnce({
        merchantId: M3,
        previousBalance: 0n,
        ledgerBalance: 0n,
        drift: 0n,
        adjusted: false,
      });

    const job = buildJob(creditsSpy, queue, audit);
    await job.process({ name: RECONCILE_JOB_NAME, data: {} } as never);

    expect(creditsSpy).toHaveBeenCalledTimes(3);
    const [entry] = audit.log.mock.calls[0];
    expect(entry.metadata?.failed).toBe(1);
    expect(entry.metadata?.reconciled).toBe(2);
    expect(entry.metadata?.drifts).toEqual([]);
  });

  it('audits the aggregate as a SYSTEM actor', async () => {
    creditsSpy.mockResolvedValue({
      merchantId: M1,
      previousBalance: 0n,
      ledgerBalance: 0n,
      drift: 0n,
      adjusted: false,
    });
    const job = buildJob(creditsSpy, queue, audit);
    await job.process({ name: RECONCILE_JOB_NAME, data: {} } as never);

    const [entry] = audit.log.mock.calls[0];
    expect(entry.actorType).toBe('SYSTEM');
    expect(entry.action).toBe('credits.reconciliation.completed');
  });

  it('ignores other maintenance jobs on the same queue', async () => {
    const job = buildJob(creditsSpy, queue, audit);
    const spy = jest.spyOn(job, 'process');
    await job.process({ name: 'other-maintenance', data: {} } as never);
    expect(creditsSpy).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });
});
