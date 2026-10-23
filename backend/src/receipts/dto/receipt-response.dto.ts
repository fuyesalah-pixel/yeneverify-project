// ============================================================
// Yene Verify — Receipt Response DTO
// ============================================================

export interface ReceiptResponseDto {
  receiptId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  inputMethod: string;
  createdAt: string;
  expiresAt: string | null;
  downloadUrl?: string;
}

export interface PresignUploadResponseDto {
  storageKey: string;
  uploadUrl: string;
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
  expiresAt: string;
}

export interface CompleteUploadResponseDto {
  receiptId: string;
  storageKey: string;
  sizeBytes: number;
  createdAt: string;
}
