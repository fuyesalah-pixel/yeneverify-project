// ============================================================
// Yene Verify — Exports Processor (Step 19)
//
// BullMQ worker for QUEUE_NAMES.EXPORT. Runs the async half of an
// export: QUEUED row → PROCESSING → READY (or FAILED).
//
//   1. Load the export row; only a QUEUED row is processed
//      (idempotent replay + double-enqueue protection).
//   2. Stream matching transactions in 5k-row pages so a 50k-row
//      export never holds five duplicate result sets in memory.
//   3. Format (CSV or PDF) and PUT through StorageService
//      (local driver in dev, R2 in prod).
//   4. Mark READY with storage key, size, row count, new expiry.
//   5. Notify the requesting user (SYSTEM notification row the
//      in-app inbox shows even if every FCM push fails).
//   6. Audit 'export.completed' with rowCount + duration.
//
// NO RETRIES by design (enqueued with attempts: 1): data problems
// are not transient — the merchant requests a fresh export. Any
// failure → status FAILED with error_message + 'export.failed' audit.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ExportsRepository } from './exports.repository';
import { formatCsv } from './csv-formatter';
import { buildPdf } from './pdf-formatter';
import { EXPORT_JOB_NAME, EXPORT_RETENTION_MS } from './exports.service';

interface ExportJobData {
  exportId: string;
}

interface ExportParams {
  from: string;
  to: string;
  status?: string;
  subMerchantId?: string;
  bankCode?: string;
}

const CHUNK_SIZE = 5_000;

@Processor(QUEUE_NAMES.EXPORT)
@Injectable()
export class ExportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportsProcessor.name);

  constructor(
    private readonly repo: ExportsRepository,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<ExportJobData>): Promise<void> {
    if (job.name !== EXPORT_JOB_NAME) return;
    const exportId = job.data.exportId;

    const row = await this.repo.findById(exportId);
    if (!row) {
      this.logger.warn(`export.row.missing exportId=${exportId}`);
      return;
    }
    if (row.status !== 'QUEUED') {
      // Replay/double-enqueue: the row's status is the idempotency gate.
      this.logger.log(`export.skip.notQueued exportId=${exportId} status=${row.status}`);
      return;
    }

    const startedAt = Date.now();
    await this.repo.markProcessing(exportId);

    try {
      const params = (row.params ?? {}) as unknown as ExportParams;
      const where = {
        merchantId: row.merchantId,
        from: new Date(params.from),
        to: new Date(params.to),
        status: params.status as never,
        subMerchantId: params.subMerchantId,
        bankCode: params.bankCode,
      };

      // ── Chunked read: page until short (bounded by create-time count) ──
      const rows = [];
      for (let page = 1; ; page += 1) {
        const chunk = await this.repo.findRowsPage(where, page, CHUNK_SIZE);
        rows.push(...chunk);
        if (chunk.length < CHUNK_SIZE) break;
      }

      const wrap = {
        merchantName: await this.merchantName(row.merchantId),
        fromIso: params.from.slice(0, 10),
        toIso: params.to.slice(0, 10),
      };
      const body = row.format === 'CSV' ? formatCsv(rows) : (await buildPdf(rows, wrap)).buffer;

      const extension = row.format === 'CSV' ? 'csv' : 'pdf';
      const storageKey = `exports/${row.merchantId}/${row.id}.${extension}`;
      await this.storage.putObject(storageKey, body);

      const head = await this.storage.head(storageKey);
      const fileSizeBytes = head?.sizeBytes ?? body.length;

      await this.repo.markReady(row.id, {
        storageKey,
        fileSizeBytes,
        rowCount: rows.length,
        expiresAt: new Date(Date.now() + EXPORT_RETENTION_MS),
      });

      await this.notifications.notify({
        userId: row.requestedByUserId,
        merchantId: row.merchantId,
        type: 'SYSTEM',
        title: 'Export ready',
        body:
          row.format === 'CSV'
            ? 'Your CSV export is ready to download.'
            : 'Your PDF export is ready to download.',
        data: { exportId: row.id },
      });

      const durationMs = Date.now() - startedAt;
      this.audit.log({
        actorType: 'SYSTEM',
        action: 'export.completed',
        targetType: 'EXPORT',
        targetId: row.id,
        metadata: { format: row.format, rowCount: rows.length, fileSizeBytes, durationMs },
      });
      this.logger.log(
        `export.completed exportId=${row.id} format=${row.format} rows=${rows.length} bytes=${fileSizeBytes} durationMs=${durationMs}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.markFailed(exportId, message).catch(() => undefined);
      this.audit.log({
        actorType: 'SYSTEM',
        action: 'export.failed',
        targetType: 'EXPORT',
        targetId: exportId,
        metadata: { error: message },
      });
      this.logger.error(`export.failed exportId=${exportId} error=${message}`);
      // Deliberately no rethrow: attempts=1, the merchant re-requests.
    }
  }

  private async merchantName(merchantId: string): Promise<string> {
    const m = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { businessName: true },
    });
    return m?.businessName ?? 'Merchant';
  }
}
