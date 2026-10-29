// ============================================================
// Yene Verify — Export response DTOs (Step 19)
//
// bigint-free, Date→ISO: everything here is JSON-safe. downloadUrl
// is populated ONLY while status READY (presigned, 15-min TTL).
// ============================================================

export type ExportFormatDto = 'CSV' | 'PDF';

export type ExportStatusDto = 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED' | 'EXPIRED';

/** POST /exports → 202 */
export interface ExportCreatedResponseDto {
  exportId: string;
  status: 'QUEUED';
}

/** GET /exports/:id → 200 */
export interface ExportDetailResponseDto {
  id: string;
  format: ExportFormatDto;
  status: ExportStatusDto;
  rowCount: number | null;
  fileSizeBytes: number | null;
  /** Presigned URL (15-minute TTL); non-null only when status READY. */
  downloadUrl: string | null;
  /** When the export (and its URL) stop working. */
  expiresAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportSummaryDto {
  id: string;
  format: ExportFormatDto;
  status: ExportStatusDto;
  rowCount: number | null;
  createdAt: string;
}

/** GET /exports → 200 */
export interface ExportListResponseDto {
  data: ExportSummaryDto[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
