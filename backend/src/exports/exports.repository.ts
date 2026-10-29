// ============================================================
// Yene Verify — Exports Repository (Step 19)
//
// Prisma access for the exports table and for the transaction-row
// queries an export consumes. Three responsibilities:
//
//   exports-row CRUD (create / status transitions / list)
//   transaction COUNT estimate (create-time guard, 50k cap)
//   chunked transaction row pages (processor streams 5k at a time)
//
// Every transaction query matches the same compiled `where` so the
// estimate and the streamed rows can never disagree.
// ============================================================

import { Injectable } from '@nestjs/common';
import type { ExportFormat, ExportStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateExportDto } from './dto/create-export.dto';

/** Shape fed to the formatters — fully resolved, no % relations. */
export interface ExportRow {
  paidAt: Date;
  bankCode: string;
  bankReference: string;
  amountMinor: bigint;
  senderName: string | null;
  receiverName: string | null;
  status: string;
  subMerchantLabel: string | null;
  productLabel: string | null;
}

/** Prisma row as returned by findRowsPage (subMerchant included). */
type TransactionRow = Prisma.TransactionGetPayload<{
  include: { subMerchant: { select: { branchLabel: true } } };
}>;

export interface ExportWhereParams {
  merchantId: string;
  from: Date;
  to: Date;
  status?: CreateExportDto['status'];
  subMerchantId?: string;
  bankCode?: string;
}

/** Plain export-row shape the service/processor consume. */
export interface ExportRecord {
  id: string;
  merchantId: string;
  requestedByUserId: string;
  format: ExportFormat;
  params: Prisma.JsonValue;
  status: ExportStatus;
  storageKey: string | null;
  fileSizeBytes: number | null;
  rowCount: number | null;
  errorMessage: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ExportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── exports rows ───────────────────────────────────────────────────────

  create(data: {
    id: string;
    merchantId: string;
    requestedByUserId: string;
    format: ExportFormat;
    params: Prisma.InputJsonValue;
    expiresAt: Date;
  }): Promise<ExportRecord> {
    return this.prisma.export.create({ data });
  }

  findById(id: string): Promise<ExportRecord | null> {
    return this.prisma.export.findUnique({ where: { id } });
  }

  markProcessing(id: string): Promise<void> {
    return this.prisma.export
      .update({ where: { id }, data: { status: 'PROCESSING' } })
      .then(() => undefined);
  }

  markReady(
    id: string,
    data: { storageKey: string; fileSizeBytes: number; rowCount: number; expiresAt: Date },
  ): Promise<void> {
    return this.prisma.export
      .update({ where: { id }, data: { status: 'READY', ...data } })
      .then(() => undefined);
  }

  markFailed(id: string, errorMessage: string): Promise<void> {
    return this.prisma.export
      .update({ where: { id }, data: { status: 'FAILED', errorMessage } })
      .then(() => undefined);
  }

  markExpired(id: string): Promise<void> {
    return this.prisma.export
      .update({ where: { id }, data: { status: 'EXPIRED' } })
      .then(() => undefined);
  }

  list(
    merchantId: string,
    params: { page: number; pageSize: number; status?: ExportStatus },
  ): Promise<{ rows: ExportRecord[]; total: number }> {
    const { page, pageSize, status } = params;
    return Promise.all([
      this.prisma.export.findMany({
        where: { merchantId, ...(status && { status }) },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.export.count({ where: { merchantId, ...(status && { status }) } }),
    ]).then(([rows, total]) => ({ rows, total }));
  }

  /** All READY exports whose expiry has passed — for the daily cleanup. */
  findExpiredReady(now: Date, limit = 200): Promise<ExportRecord[]> {
    return this.prisma.export.findMany({
      where: { status: 'READY', expiresAt: { lt: now } },
      take: limit,
    });
  }

  // ── transaction queries ────────────────────────────────────────────────

  /** The single compiled filter both count and streaming pages use. */
  private transactionWhere(p: ExportWhereParams): Prisma.TransactionWhereInput {
    return {
      merchantId: p.merchantId,
      deletedAt: null,
      paidAt: { gte: p.from, lte: p.to },
      ...(p.status ? { status: p.status as never } : {}),
      ...(p.subMerchantId ? { subMerchantId: p.subMerchantId } : {}),
      ...(p.bankCode ? { bankCode: p.bankCode as never } : {}),
    };
  }

  countTransactions(p: ExportWhereParams): Promise<number> {
    return this.prisma.transaction.count({ where: this.transactionWhere(p) });
  }

  /**
   * One keyset-style page of matching transactions, oldest first.
   * The processor walks pages of `pageSize` until short; the count
   * estimate guarantees this terminates within the 50k bound.
   */
  async findRowsPage(p: ExportWhereParams, page: number, pageSize = 5_000): Promise<ExportRow[]> {
    const rows: TransactionRow[] = await this.prisma.transaction.findMany({
      where: this.transactionWhere(p),
      orderBy: [{ paidAt: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { subMerchant: { select: { branchLabel: true } } },
    });
    return rows.map((r) => ({
      paidAt: r.paidAt,
      bankCode: r.bankCode,
      bankReference: r.bankReference,
      amountMinor: r.amountMinor,
      senderName: r.senderName,
      receiverName: r.receiverName,
      status: r.status,
      subMerchantLabel: r.subMerchant?.branchLabel ?? null,
      productLabel: r.productLabel,
    }));
  }
}
