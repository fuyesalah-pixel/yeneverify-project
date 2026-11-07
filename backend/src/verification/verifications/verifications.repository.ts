// ============================================================
// Yene Verify — Verifications Repository (13E.1)
//
// All Prisma access for verifications rows lives here so
// VerificationsService stays testable against mocks. 13E.2/13E.3
// extend this file; do not duplicate its queries elsewhere.
// ============================================================

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { newId } from '../../common/utils/id.util';
import type {
  SupplementaryPrompt,
  VerificationResult,
  VerdictOutcome,
  VerdictStatus,
} from './verifications.types';

// ============================================================
// 13E.3 — API-facing queries. Sub-merchant scoping happens HERE, in
// the WHERE clause (Watch rule: never filter in JS after fetch).
// ============================================================

/** The detail projection shared by GET /verifications/:id. */
const DETAIL_SELECT = {
  id: true,
  source: true,
  bankCode: true,
  bankReference: true,
  referenceNormalized: true,
  amountMinor: true,
  senderName: true,
  receiverName: true,
  paidAt: true,
  status: true,
  ocrConfidence: true,
  adapterMetadata: true,
  errorCode: true,
  errorMessage: true,
  durationMs: true,
  createdAt: true,
  completedAt: true,
  receipt: { select: { id: true, mimeType: true, sizeBytes: true, createdAt: true } },
} satisfies Prisma.VerificationSelect;

export type VerificationDetailRow = Prisma.VerificationGetPayload<{ select: typeof DETAIL_SELECT }>;

export type CreatePendingInput = {
  merchantId: string;
  verifiedByUserId: string;
  receiptId: string;
  source: 'TRANSACTION' | 'BILLING';
  /** Client-scanned QR hint; persisted so the queue worker sees it. */
  qrContent?: string | null;
  qrType?: string | null;
  /** On-device ML Kit OCR hint; persisted for the queue worker. */
  clientOcrText?: string | null;
  clientOcrConfidence?: number | null;
};

export type VerificationSummaryRow = {
  id: string;
  status: string;
  bankCode: string | null;
  bankReference: string | null;
  senderName: string | null;
  receiverName: string | null;
  amountMinor: bigint | null;
  createdAt: Date;
  completedAt: Date | null;
};

export type ListSummariesFilter = {
  merchantId: string;
  /** Set for SUB_MERCHANT callers: hard user scope in SQL. */
  verifiedByUserId: string | null;
  /** MERCHANT-only sub-merchant drilldown. */
  subMerchantUserId: string | null;
  status: string[] | null;
  source: 'TRANSACTION' | 'BILLING' | null;
  bankCode: string[] | null;
  from: Date | null;
  to: Date | null;
  search: string | null;
  sortBy: 'createdAt' | 'amountMinor';
  sortOrder: 'asc' | 'desc';
  skip: number;
  take: number;
};

/** How the verification row was loaded for process(). */
export type LoadedVerification =
  | { kind: 'pending'; verification: VerificationWithReceipt }
  | { kind: 'alreadyFinalized'; verification: VerificationRow };

export type VerificationRow = {
  id: string;
  merchantId: string;
  verifiedByUserId: string;
  source: string;
  bankCode: string | null;
  bankReference: string | null;
  referenceNormalized: string | null;
  amountMinor: bigint | null;
  senderName: string | null;
  receiverName: string | null;
  paidAt: Date | null;
  status: string;
  ocrRawText: string | null;
  ocrConfidence: Prisma.Decimal | null;
  /** Present when selected via ROW_SELECT; legacy spec fixtures omit it. */
  qrContent?: string | null;
  qrType?: string | null;
  clientOcrText?: string | null;
  clientOcrConfidence?: Prisma.Decimal | null;
  adapterMetadata: Prisma.JsonValue | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** Present when selected via ROW_SELECT; legacy spec fixtures omit it. */
  createdAt?: Date;
  completedAt?: Date | null;
};

export type VerificationWithReceipt = VerificationRow & {
  receipt: {
    id: string;
    storageKey: string;
    mimeType: string;
    deletedAt: Date | null;
  } | null;
};

const ROW_SELECT = {
  id: true,
  merchantId: true,
  verifiedByUserId: true,
  source: true,
  bankCode: true,
  bankReference: true,
  referenceNormalized: true,
  amountMinor: true,
  senderName: true,
  receiverName: true,
  paidAt: true,
  status: true,
  ocrRawText: true,
  ocrConfidence: true,
  qrContent: true,
  qrType: true,
  clientOcrText: true,
  clientOcrConfidence: true,
  adapterMetadata: true,
  errorCode: true,
  errorMessage: true,
  createdAt: true,
  completedAt: true,
} satisfies Prisma.VerificationSelect;

@Injectable()
export class VerificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads the row for process(), discriminating idempotent reentry:
   * a non-PENDING verification is returned as alreadyFinalized and
   * process() replays its stored outcome without redoing any work.
   */
  async loadForProcessing(verificationId: string): Promise<LoadedVerification | null> {
    const row = await this.prisma.verification.findUnique({
      where: { id: verificationId },
      select: {
        ...ROW_SELECT,
        receipt: {
          select: { id: true, storageKey: true, mimeType: true, deletedAt: true },
        },
      },
    });
    if (!row) return null;

    if (row.status !== 'PENDING') {
      return { kind: 'alreadyFinalized', verification: row as VerificationRow };
    }
    return { kind: 'pending', verification: row as VerificationWithReceipt };
  }

  /** Early persist so a crashed/queued retry never re-runs OCR. */
  async persistOcr(
    verificationId: string,
    ocrRawText: string,
    ocrConfidence: number | null,
  ): Promise<void> {
    await this.prisma.verification.update({
      where: { id: verificationId },
      data: { ocrRawText, ocrConfidence: ocrConfidence ?? null },
    });
  }

  /**
   * Atomic completion: outcome fields + timing, inside the caller's
   * transaction. `updateWithOutcome` and (when applicable) the
   * transaction projection commit together or not at all.
   */
  async updateWithOutcome(
    tx: Prisma.TransactionClient,
    verificationId: string,
    outcome: VerdictOutcome,
    durationMs: number,
  ): Promise<void> {
    // Replay-enrichment for idempotent reads (13E.3 status endpoint).
    const adapterMetadata = {
      ...(outcome.metadata ?? {}),
      ...(outcome.duplicateOfVerificationId
        ? { duplicateOfVerificationId: outcome.duplicateOfVerificationId }
        : {}),
      ...(outcome.needsSupplementary ? { needsSupplementary: outcome.needsSupplementary } : {}),
    };

    await tx.verification.update({
      where: { id: verificationId },
      data: {
        status: outcome.status,
        bankCode: outcome.bankCode ?? null,
        bankReference: outcome.bankReference ?? null,
        referenceNormalized: outcome.referenceNormalized ?? null,
        amountMinor: outcome.amountMinor ?? null,
        senderName: outcome.senderName ?? null,
        receiverName: outcome.receiverName ?? null,
        paidAt: outcome.paidAt ?? null,
        errorCode: outcome.errorCode ?? null,
        errorMessage: outcome.errorMessage ?? null,
        adapterMetadata,
        durationMs: Math.max(0, Math.min(durationMs, 2_147_483_647)),
        completedAt: new Date(),
      },
    });
  }

  /**
   * Best-effort failure marker for the queue processor: if process()
   * itself threw, the merchant must not stay PENDING forever. Atomic
   * updateMany so it never overwrites a verdict another attempt just
   * wrote. Best-effort: the original error is not masked.
   */
  async markErrorIfPending(
    verificationId: string,
    errorCode: string,
    message?: string,
  ): Promise<void> {
    await this.prisma.verification.updateMany({
      where: { id: verificationId, status: 'PENDING' },
      data: {
        status: 'ERROR',
        errorCode,
        errorMessage: message ?? 'Verification failed in the processing queue.',
        completedAt: new Date(),
        adapterMetadata: { queuedFailure: { errorCode, at: new Date().toISOString() } },
      },
    });
  }

  // ── 13E.3 — API surface methods ─────────────────────────────────────

  async createPending(input: CreatePendingInput): Promise<VerificationRow> {
    const row = await this.prisma.verification.create({
      data: {
        id: newId(),
        merchantId: input.merchantId,
        verifiedByUserId: input.verifiedByUserId,
        receiptId: input.receiptId,
        source: input.source,
        status: 'PENDING',
        qrContent: input.qrContent ?? null,
        qrType: input.qrType ?? null,
        clientOcrText: input.clientOcrText ?? null,
        clientOcrConfidence: input.clientOcrConfidence ?? null,
      },
      select: ROW_SELECT,
    });
    return row as VerificationRow;
  }

  /**
   * Tenant-scoped (and optionally sub-merchant-scoped) detail lookup.
   * The scope is part of the WHERE clause, not post-fetch filtering.
   */
  async findDetailById(
    id: string,
    merchantId: string,
    subMerchantUserId: string | null,
  ): Promise<VerificationDetailRow | null> {
    return this.prisma.verification.findFirst({
      where: {
        id,
        merchantId,
        ...(subMerchantUserId && { verifiedByUserId: subMerchantUserId }),
      },
      select: DETAIL_SELECT,
    });
  }

  /** Paginated, filterable list — scoping stays in the WHERE clause. */
  async listSummaries(
    filter: ListSummariesFilter,
  ): Promise<{ rows: VerificationSummaryRow[]; total: number }> {
    const where: Prisma.VerificationWhereInput = {
      merchantId: filter.merchantId,
      ...(filter.verifiedByUserId && { verifiedByUserId: filter.verifiedByUserId }),
      ...(filter.subMerchantUserId && { verifiedByUserId: filter.subMerchantUserId }),
      ...(filter.status?.length && { status: { in: filter.status as never } }),
      ...(filter.source && { source: filter.source }),
      ...(filter.bankCode?.length && { bankCode: { in: filter.bankCode as never } }),
      ...((filter.from || filter.to) && {
        createdAt: {
          ...(filter.from && { gte: filter.from }),
          ...(filter.to && { lte: filter.to }),
        },
      }),
      ...(filter.search && {
        OR: [
          { bankReference: { contains: filter.search, mode: 'insensitive' } },
          { referenceNormalized: { contains: filter.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.verification.findMany({
        where,
        select: {
          id: true,
          status: true,
          bankCode: true,
          bankReference: true,
          senderName: true,
          receiverName: true,
          amountMinor: true,
          createdAt: true,
          completedAt: true,
        },
        orderBy: { [filter.sortBy]: filter.sortOrder },
        skip: filter.skip,
        take: filter.take,
      }),
      this.prisma.verification.count({ where }),
    ]);
    return { rows, total };
  }

  /**
   * Reset an ERROR/NEEDS_REVIEW row for reprocessing. Scoped by
   * merchantId so tenants can never reset each other's rows. Keeps
   * ocrRawText (skip re-OCR) — previous attempt metadata remains as
   * an audit trail until the next run overwrites it.
   */
  async resetForRetry(id: string, merchantId: string): Promise<void> {
    await this.prisma.verification.updateMany({
      where: { id, merchantId, status: { in: ['ERROR', 'NEEDS_REVIEW'] } },
      data: {
        status: 'PENDING',
        errorCode: null,
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
        attemptCount: { increment: 1 },
      },
    });
  }

  /** Flag a verification for manual review; returns the review id. */
  async updateStatusToNeedsReview(
    id: string,
    merchantId: string,
    requestedByUserId: string,
    reason: string,
  ): Promise<string | null> {
    const onlyReviewable: ('FAKE' | 'ERROR' | 'NEEDS_REVIEW')[] = ['FAKE', 'ERROR', 'NEEDS_REVIEW'];
    const result = await this.prisma.$transaction(async (tx) => {
      // updateMany first: only FAKE/ERROR/NEEDS_REVIEW rows flip.
      const updated = await tx.verification.updateMany({
        where: { id, merchantId, status: { in: onlyReviewable } },
        data: { status: 'NEEDS_REVIEW', errorCode: 'VERIFICATION_MANUAL_REVIEW' },
      });
      if (updated.count === 0) return null;

      // One review row per verification (unique on verification_id).
      // upsert keeps re-requests idempotent: they refresh the reason.
      const review = await tx.verificationReview.upsert({
        where: { verificationId: id },
        update: { reason, requestedByUserId },
        create: {
          id: newId(),
          verificationId: id,
          merchantId,
          requestedByUserId,
          reason,
          status: 'OPEN',
        },
      });
      return review.id;
    });
    return result;
  }

  /** Reads the source column within the completion transaction. */
  async getSource(tx: Prisma.TransactionClient, verificationId: string): Promise<string | null> {
    const row = await tx.verification.findUnique({
      where: { id: verificationId },
      select: { source: true },
    });
    return row?.source ?? null;
  }

  /** Rebuild a VerificationResult from the persisted row (idempotent replay). */
  toExistingResult(row: VerificationRow, durationMs = 0): VerificationResult {
    const meta = (row.adapterMetadata ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      status: row.status as VerdictStatus,
      bankCode: (row.bankCode as VerificationResult['bankCode']) ?? null,
      bankReference: row.bankReference,
      amountMinor: row.amountMinor,
      senderName: row.senderName,
      receiverName: row.receiverName,
      paidAt: row.paidAt,
      ocrConfidence: row.ocrConfidence?.toNumber() ?? null,
      errorCode: row.errorCode,
      durationMs,
      duplicateOfVerificationId:
        typeof meta['duplicateOfVerificationId'] === 'string'
          ? (meta['duplicateOfVerificationId'] as string)
          : null,
      needsSupplementary: isSupplementaryPrompt(meta['needsSupplementary'])
        ? (meta['needsSupplementary'] as SupplementaryPrompt)
        : null,
    };
  }
}

function isSupplementaryPrompt(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const field = (value as Record<string, unknown>)['field'];
  return field === 'accountSuffix' || field === 'last8';
}
