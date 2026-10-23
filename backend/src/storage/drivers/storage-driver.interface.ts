// ============================================================
// Yene Verify — Storage Driver Interface
//
// Storage is abstracted behind two drivers so the receipt pipeline
// can run with zero cloud credentials in development:
//
//   local — writes to STORAGE_LOCAL_PATH on disk; "presigned" URLs
//           point back at this backend behind a short HMAC token.
//   r2    — Cloudflare R2 (or any S3-compatible endpoint) via the
//           AWS SDK, with real presigned URLs.
//
// ReceiptsService never imports a driver directly; it goes through
// StorageService, which delegates to DriverRegistry.active().
// ============================================================

export type StorageDriverName = 'local' | 'r2';

export interface PresignedUpload {
  uploadUrl: string;
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
}

export interface ObjectHead {
  exists: boolean;
  sizeBytes?: number;
  contentType?: string;
}

export interface StorageDriver {
  readonly name: StorageDriverName;

  presignUpload(key: string, contentType: string, ttlSec: number): Promise<PresignedUpload>;

  presignDownload(key: string, ttlSec: number): Promise<{ downloadUrl: string }>;

  /** Returns null when the object does not exist. */
  head(key: string): Promise<ObjectHead | null>;

  getObject(key: string): Promise<Buffer>;

  delete(key: string): Promise<void>;

  health(): Promise<boolean>;
}

/** MIME types accepted for receipt images. */
export const ALLOWED_RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedReceiptMimeType = (typeof ALLOWED_RECEIPT_MIME_TYPES)[number];

/** Hard ceiling enforced in the DTO layer and re-checked on complete(). */
export const MAX_RECEIPT_BYTES = 8_388_608;

/**
 * Reject anything that could escape the storage root.
 * Keys are always forward-slash relative paths like
 * `receipts/<merchantId>/<uuid>.jpg`.
 */
export function assertSafeKey(key: string): void {
  if (!key || key.trim().length === 0) {
    throw new Error('Storage key must not be empty');
  }
  if (key.includes('..')) {
    throw new Error('Storage key must not contain ".."');
  }
  if (key.includes('\\')) {
    throw new Error('Storage key must not contain backslashes');
  }
  if (key.startsWith('/') || /^[A-Za-z]:/.test(key)) {
    throw new Error('Storage key must be a relative path');
  }
  if (key.includes('\0')) {
    throw new Error('Storage key must not contain null bytes');
  }
}

export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_RECEIPT_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
    default:
      return 'jpg';
  }
}
