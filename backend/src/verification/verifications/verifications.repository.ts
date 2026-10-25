// ============================================================
// Yene Verify — Verifications Repository (13E.1)
//
// All Prisma access for verifications rows lives here so
// VerificationsService stays testable against mocks. 13E.2/13E.3
// extend this file; do not duplicate its queries elsewhere.
// ============================================================

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type {
  SupplementaryPrompt,
  VerificationResult,
  VerdictOutcome,
  VerdictStatus,
} from './verifications.types';

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
  adapterMetadata: Prisma.JsonValue | null;
  errorCode: string | null;
  errorMessage: string | null;
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
  adapterMetadata: true,
  errorCode: true,
  errorMessage: true,
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
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>)['field'] === 'accountSuffix'
  );
}
