// ============================================================
// Yene Verify — Verification Response Mapper (13E.3)
//
// Row → DTO mapping is the PII boundary. NOTHING in the Prisma row
// (storageKey, sha256, ocrRawText, adapterMetadata) may reach a
// response through some other shape — keep all serialization here.
//
// Serialization rules:
//   bigint  → string   (amountMinor: JSON precision loss otherwise)
//   Decimal → number   (ocrConfidence, value is in [0..1])
//   Date    → ISO 8601 string
// ============================================================

import type {
  DuplicateOfDto,
  PageMetaDto,
  ReceiptSummaryDto,
  VerificationDetailDto,
  VerificationListResponseDto,
  VerificationSummaryDto,
} from './dto/verification-response.dto';
import type { SupplementaryPrompt } from './verifications.types';
import type { VerificationDetailRow, VerificationSummaryRow } from './verifications.repository';

export type VerificationMetadata = Record<string, unknown>;

/** Adapter-metadata keys the DTO surfaces deliberately. */
export function duplicateReferenceFromMetadata(meta: VerificationMetadata | null): {
  verificationId: string | null;
} {
  const value = meta?.['duplicateOfVerificationId'];
  return {
    verificationId: typeof value === 'string' ? value : null,
  };
}

export function isSupplementaryPrompt(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>)['field'] === 'accountSuffix'
  );
}

export function supplementaryFromMetadata(
  meta: VerificationMetadata | null,
): SupplementaryPrompt | null {
  return isSupplementaryPrompt(meta?.['needsSupplementary'])
    ? (meta?.['needsSupplementary'] as SupplementaryPrompt)
    : null;
}

function isoOrNull(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function mapSummary(row: VerificationSummaryRow): VerificationSummaryDto {
  return {
    id: row.id,
    status: row.status as VerificationSummaryDto['status'],
    bankCode: (row.bankCode as VerificationSummaryDto['bankCode']) ?? null,
    bankReference: row.bankReference,
    senderName: row.senderName,
    receiverName: row.receiverName,
    amountMinor: row.amountMinor !== null ? row.amountMinor.toString() : null,
    createdAt: row.createdAt.toISOString(),
    completedAt: isoOrNull(row.completedAt),
  };
}

export function summaryFromRow(row: VerificationSummaryRow): VerificationSummaryDto {
  return mapSummary(row);
}

export function listFromRows(
  rows: VerificationSummaryRow[],
  total: number,
  page: number,
  pageSize: number,
): VerificationListResponseDto {
  const meta: PageMetaDto = {
    page,
    pageSize,
    total,
    totalPages: total <= 0 ? 0 : Math.ceil(total / pageSize),
  };
  return { data: rows.map(mapSummary), meta };
}

function mapReceiptSummary(row: VerificationDetailRow): ReceiptSummaryDto {
  return {
    id: row.receipt.id,
    mimeType: row.receipt.mimeType,
    sizeBytes: row.receipt.sizeBytes,
    uploadedAt: row.receipt.createdAt.toISOString(),
  };
}

/**
 * detailFromRow resolves the cross-tenant duplicate info the row alone
 * cannot tell: duplicateOfVerificationId (persisted metadata) and the
 * first-verification merchant (read from duplicate_fingerprints).
 */
export function detailFromRow(
  row: VerificationDetailRow,
  duplicateOf: DuplicateOfDto | null,
): VerificationDetailDto {
  const meta = (row.adapterMetadata ?? null) as VerificationMetadata | null;

  return {
    id: row.id,
    status: row.status as VerificationDetailDto['status'],
    source: row.source as VerificationDetailDto['source'],
    bankCode: (row.bankCode as VerificationDetailDto['bankCode']) ?? null,
    bankReference: row.bankReference,
    amountMinor: row.amountMinor !== null ? row.amountMinor.toString() : null,
    senderName: row.senderName,
    receiverName: row.receiverName,
    paidAt: isoOrNull(row.paidAt),
    ocrConfidence: row.ocrConfidence?.toNumber() ?? null,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    durationMs: row.durationMs,
    duplicateOf,
    needsSupplementary: supplementaryFromMetadata(meta),
    receipt: mapReceiptSummary(row),
    createdAt: row.createdAt.toISOString(),
    completedAt: isoOrNull(row.completedAt),
  };
}
