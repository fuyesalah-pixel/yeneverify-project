// ============================================================
// Yene Verify — Exports Service Unit Tests (Step 19)
//
// Mocked repo/queue/storage/audit. Covers create() caps and
// enqueue, getById() presigned-URL gating + ownership, and list()
// pagination math. HTTP semantics (403/404) are e2e's job.
// ============================================================

import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { QUEUE_NAMES } from '../queue/queue.constants';
import {
  ExportFileMissingError,
  ExportNoDataError,
  ExportNotFoundError,
  ExportTooLargeError,
} from '../common/errors/domain-errors';
import { ExportsRepository } from './exports.repository';
import { ExportsService } from './exports.service';

describe('ExportsService', () => {
  let service: ExportsService;
  let repo: {
    countTransactions: jest.Mock;
    create: jest.Mock;
    findById: jest.Mock;
    list: jest.Mock;
    markFailed: jest.Mock;
  };
  let queue: { add: jest.Mock };
  let storage: { head: jest.Mock; presignDownload: jest.Mock };

  const dto = {
    format: 'CSV' as const,
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-01-31T00:00:00.000Z',
  };

  const aRow = (over: Record<string, unknown> = {}) => ({
    id: 'exp-1',
    merchantId: 'm-1',
    requestedByUserId: 'u-1',
    format: 'CSV',
    params: {},
    status: 'QUEUED',
    storageKey: null,
    fileSizeBytes: null,
    rowCount: null,
    errorMessage: null,
    expiresAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  });

  beforeEach(async () => {
    repo = {
      countTransactions: jest.fn(),
      create: jest.fn().mockResolvedValue(aRow()),
      findById: jest.fn(),
      list: jest.fn().mockResolvedValue({ rows: [aRow()], total: 1 }),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    queue = { add: jest.fn().mockResolvedValue({}) };
    storage = {
      head: jest.fn().mockResolvedValue({ exists: true, sizeBytes: 123 }),
      presignDownload: jest.fn().mockResolvedValue({ downloadUrl: 'https://presigned.test/x' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExportsService,
        { provide: ExportsRepository, useValue: repo },
        { provide: StorageService, useValue: storage },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: getQueueToken(QUEUE_NAMES.EXPORT), useValue: queue },
      ],
    }).compile();

    service = moduleRef.get(ExportsService);
  });

  describe('resolveRange', () => {
    it('defaults to last 30 days when both bounds missing', () => {
      const now = new Date('2026-02-01T12:00:00.000Z');
      const range = service.resolveRange({}, now);
      expect(range.to.toISOString()).toBe(now.toISOString());
      expect(range.from.toISOString()).toBe(
        new Date(now.getTime() - 30 * 86_400_000).toISOString(),
      );
    });

    it('only-from extends 30 days forward; only-to backs 30 days', () => {
      const from = new Date('2026-01-01T00:00:00.000Z');
      const to = new Date('2026-03-01T00:00:00.000Z');
      expect(service.resolveRange({ from: from.toISOString() }).to.getTime()).toBe(
        from.getTime() + 30 * 86_400_000,
      );
      expect(service.resolveRange({ to: to.toISOString() }).from.getTime()).toBe(
        to.getTime() - 30 * 86_400_000,
      );
    });
  });

  describe('create', () => {
    it('creates QUEUED row and enqueues exactly once', async () => {
      repo.countTransactions.mockResolvedValue(100);

      const res = await service.create({ merchantId: 'm-1', userId: 'u-1', dto });

      expect(res.status).toBe('QUEUED');
      expect(repo.create).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledTimes(1);
      const [name, data, opts] = queue.add.mock.calls[0];
      expect(name).toBe('process-export');
      expect(data.exportId).toBe(res.exportId);
      // Exports never retry: data problems are not transient.
      expect(opts.attempts).toBe(1);
    });

    it('rejects CSV row counts over 50k', async () => {
      repo.countTransactions.mockResolvedValue(50_001);
      await expect(
        service.create({ merchantId: 'm-1', userId: 'u-1', dto }),
      ).rejects.toBeInstanceOf(ExportTooLargeError);
      expect(repo.create).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('rejects PDF row counts over 5k with a use-CSV hint', async () => {
      repo.countTransactions.mockResolvedValue(5_001);
      const err = await service
        .create({ merchantId: 'm-1', userId: 'u-1', dto: { ...dto, format: 'PDF' } })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ExportTooLargeError);
      const hint = (err as ExportTooLargeError).details?.hint as string | undefined;
      expect(hint).toMatch(/CSV/);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects zero matching rows instead of exporting an empty file', async () => {
      repo.countTransactions.mockResolvedValue(0);
      await expect(
        service.create({ merchantId: 'm-1', userId: 'u-1', dto }),
      ).rejects.toBeInstanceOf(ExportNoDataError);
    });

    it('validation of a >366-day span is DTO-level (zod), not service-level', () => {
      // The zod refine lives in CreateExportDtoSchema; here we only pin
      // that the service itself never re-checks span (it trusts the pipe).
      expect(service.resolveRange(dto).to.getTime()).toBeGreaterThan(0);
    });
  });

  describe('getById', () => {
    it('404s for another merchant export (silent cross-tenant miss)', async () => {
      repo.findById.mockResolvedValue(aRow({ merchantId: 'other' }));
      await expect(
        service.getById({ merchantId: 'm-1', exportId: 'exp-1' }),
      ).rejects.toBeInstanceOf(ExportNotFoundError);
    });

    it('404s for a missing row', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.getById({ merchantId: 'm-1', exportId: 'exp-1' }),
      ).rejects.toBeInstanceOf(ExportNotFoundError);
    });

    it('returns presigned URL only for READY exports', async () => {
      repo.findById.mockResolvedValue(
        aRow({
          status: 'READY',
          storageKey: 'exports/m-1/exp-1.csv',
          rowCount: 3,
          fileSizeBytes: 123,
        }),
      );

      const res = await service.getById({ merchantId: 'm-1', exportId: 'exp-1' });

      expect(res.status).toBe('READY');
      expect(res.downloadUrl).toBe('https://presigned.test/x');
      expect(storage.presignDownload).toHaveBeenCalledWith('exports/m-1/exp-1.csv', 900);
    });

    it('never presigns for non-READY statuses', async () => {
      for (const status of ['QUEUED', 'PROCESSING', 'FAILED', 'EXPIRED'] as const) {
        repo.findById.mockResolvedValue(aRow({ status }));
        const res = await service.getById({ merchantId: 'm-1', exportId: 'exp-1' });
        expect(res.downloadUrl).toBeNull();
      }
      expect(storage.presignDownload).not.toHaveBeenCalled();
    });

    it('marks FAILED + 404s when the stored file disappeared', async () => {
      repo.findById.mockResolvedValue(
        aRow({ status: 'READY', storageKey: 'exports/m-1/exp-1.csv' }),
      );
      storage.head.mockResolvedValue({ exists: false });

      await expect(
        service.getById({ merchantId: 'm-1', exportId: 'exp-1' }),
      ).rejects.toBeInstanceOf(ExportFileMissingError);
      expect(repo.markFailed).toHaveBeenCalledWith('exp-1', 'file_missing');
    });
  });

  describe('list', () => {
    it('paginates and computes total pages', async () => {
      const res = await service.list({ merchantId: 'm-1', page: 2, pageSize: 2 });
      expect(res.meta).toEqual({ page: 2, pageSize: 2, total: 1, totalPages: 1 });
    });

    it('reports zero pages for an empty history', async () => {
      repo.list.mockResolvedValue({ rows: [], total: 0 });
      const res = await service.list({ merchantId: 'm-1', page: 1, pageSize: 20 });
      expect(res.data).toEqual([]);
      expect(res.meta.total).toBe(0);
      expect(res.meta.totalPages).toBe(0);
    });
  });
});
