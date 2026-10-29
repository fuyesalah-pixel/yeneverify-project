// ============================================================
// Yene Verify — Exports Service (Step 19)
//
// POST /exports  → validate + count-estimate + QUEUED row + enqueue
// GET /exports/:id → status; presigned URL ONLY while READY
// GET /exports    → paginated history
//
// Caps enforced at creation:
//   CSV  ≤ 50_000 rows   (else EXPORT_TOO_LARGE, hint to narrow)
//   PDF  ≤  5_000 rows   (else EXPORT_TOO_LARGE, hint: use CSV)
//
// Zero matching rows is a 400 EXPORT_NO_DATA — an empty file is
// never a useful deliverable.
// ============================================================

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import {
  ExportFileMissingError,
  ExportNoDataError,
  ExportNotFoundError,
  ExportTooLargeError,
} from '../common/errors/domain-errors';
import { ExportsRepository, type ExportRecord } from './exports.repository';
import type { CreateExportDto } from './dto/create-export.dto';
import type {
  ExportCreatedResponseDto,
  ExportDetailResponseDto,
  ExportListResponseDto,
} from './dto/export-response.dto';

export const EXPORT_JOB_NAME = 'process-export';
export const EXPORT_JOB_ID_PREFIX = 'export-';

/** Hard cap for a CSV export. */
export const CSV_ROW_LIMIT = 50_000;
/** Hard cap for a PDF export (larger → use CSV). */
export const PDF_ROW_LIMIT_EARLY = 5_000;

/** TTL in seconds for presigned download URLs. */
export const DOWNLOAD_TTL_SECONDS = 900; // 15 minutes

/** How long the export row (and file) live before expiry cleanup. */
export const EXPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const DAY_MS = 86_400_000;

export interface ExportRange {
  from: Date;
  to: Date;
}

@Injectable()
export class ExportsService {
  constructor(
    private readonly repo: ExportsRepository,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    @InjectQueue(QUEUE_NAMES.EXPORT) private readonly queue: Queue,
  ) {}

  /** Range resolution shared by create + processor. */
  resolveRange(dto: Pick<CreateExportDto, 'from' | 'to'>, now = new Date()): ExportRange {
    const from = dto.from ? new Date(dto.from) : undefined;
    const to = dto.to ? new Date(dto.to) : undefined;
    if (from && to) return { from, to };
    if (from) return { from, to: new Date(from.getTime() + 30 * DAY_MS) };
    if (to) return { from: new Date(to.getTime() - 30 * DAY_MS), to };
    // Default: last 30 days, inclusive-right like analytics windows.
    return { from: new Date(now.getTime() - 30 * DAY_MS), to: new Date(now.getTime()) };
  }

  private whereParams(
    merchantId: string,
    range: ExportRange,
    dto: Pick<CreateExportDto, 'status' | 'subMerchantId' | 'bankCode'>,
  ) {
    return {
      merchantId,
      from: range.from,
      to: range.to,
      status: dto.status,
      subMerchantId: dto.subMerchantId,
      bankCode: dto.bankCode,
    };
  }

  async create(input: {
    merchantId: string;
    userId: string;
    dto: CreateExportDto;
  }): Promise<ExportCreatedResponseDto> {
    const { merchantId, userId, dto } = input;
    const range = this.resolveRange(dto);
    const where = this.whereParams(merchantId, range, dto);

    // 1. Estimate: the count vs caps decision happens BEFORE the row
    //    exists, so an oversized request never even enqueues.
    const count = await this.repo.countTransactions(where);
    if (count === 0) throw new ExportNoDataError();
    if (count > CSV_ROW_LIMIT) {
      throw new ExportTooLargeError(
        'CSV',
        count,
        'Narrow the date range or filter by status/or bank.',
      );
    }
    if (dto.format === 'PDF' && count > PDF_ROW_LIMIT_EARLY) {
      throw new ExportTooLargeError('PDF', count, 'Use format CSV or narrow the date range.');
    }

    // 2. Row + enqueue. attempts=1: data-shape failures are not
    //    transient — the merchant re-requests instead.
    const exportId = crypto.randomUUID();
    await this.repo.create({
      id: exportId,
      merchantId,
      requestedByUserId: userId,
      format: dto.format,
      params: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.subMerchantId ? { subMerchantId: dto.subMerchantId } : {}),
        ...(dto.bankCode ? { bankCode: dto.bankCode } : {}),
      },
      expiresAt: new Date(Date.now() + EXPORT_RETENTION_MS),
    });
    await this.queue.add(
      EXPORT_JOB_NAME,
      { exportId },
      {
        jobId: `${EXPORT_JOB_ID_PREFIX}${exportId}`,
        attempts: 1,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86_400, count: 5000 },
      },
    );

    return { exportId, status: 'QUEUED' };
  }

  async getById(input: { merchantId: string; exportId: string }): Promise<ExportDetailResponseDto> {
    const row = await this.repo.findById(input.exportId);
    if (!row || row.merchantId !== input.merchantId) {
      throw new ExportNotFoundError(input.exportId);
    }

    // Cross-tenant 404 stays silent — never confirm the id exists.
    return this.toDetail(row);
  }

  async list(input: {
    merchantId: string;
    page: number;
    pageSize: number;
    status?: 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED' | 'EXPIRED';
  }): Promise<ExportListResponseDto> {
    const { rows, total } = await this.repo.list(input.merchantId, {
      page: input.page,
      pageSize: input.pageSize,
      status: input.status,
    });
    const totalPages = total === 0 ? 0 : Math.ceil(total / input.pageSize);
    return {
      data: rows.map((row) => ({
        id: row.id,
        format: row.format,
        status: row.status,
        rowCount: row.rowCount,
        createdAt: row.createdAt.toISOString(),
      })),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages,
      },
    };
  }

  // ── detail mapping ─────────────────────────────────────────────────────

  private async toDetail(row: ExportRecord): Promise<ExportDetailResponseDto> {
    let downloadUrl: string | null = null;

    if (row.status === 'READY' && row.storageKey) {
      // Physical check first: a cleaned externally-missing file is a
      // 404 + FAILED row, not a broken presigned link handed to the
      // client to discover.
      const head = await this.storage.head(row.storageKey);
      if (!head?.exists) {
        await this.repo.markFailed(row.id, 'file_missing');
        this.audit.log({
          actorType: 'SYSTEM',
          action: 'export.file_lost',
          targetType: 'EXPORT',
          targetId: row.id,
          metadata: { storageKey: row.storageKey },
        });
        throw new ExportFileMissingError(row.id);
      }
      const presigned = await this.storage.presignDownload(row.storageKey, DOWNLOAD_TTL_SECONDS);
      downloadUrl = presigned.downloadUrl;
    }

    return {
      id: row.id,
      format: row.format,
      status: row.status,
      rowCount: row.rowCount,
      fileSizeBytes: row.fileSizeBytes,
      downloadUrl,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
