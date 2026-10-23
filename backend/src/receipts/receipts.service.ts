// ============================================================
// Yene Verify — Receipts Service
//
// Two-step upload flow:
//   1. presign()  — reserve a tenant-scoped storage key and hand back
//                   an upload URL. No DB row yet.
//   2. complete() — verify the object really landed, re-hash it
//                   server-side, and persist the Receipt row.
//
// Every complete() call is tenant-scoped: the storageKey must sit
// under `receipts/<merchantId>/`, so one tenant can never attach
// another tenant's object.
// ============================================================

import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  ForbiddenError,
  ReceiptHashMismatchError,
  ReceiptInvalidTypeError,
  ReceiptNotFoundError,
  ReceiptNotUploadedError,
  ReceiptTooLargeError,
  StorageDriverError,
  TenantIsolationError,
} from '../common/errors/domain-errors';
import { newId } from '../common/utils/id.util';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import {
  extensionForMimeType,
  isAllowedMimeType,
  MAX_RECEIPT_BYTES,
} from '../storage/drivers/storage-driver.interface';
import { ReceiptsRepository } from './receipts.repository';
import type { CompleteUploadDto, PresignUploadDto } from './dto';

/** Receipt images are purged after 90 days. */
export const RECEIPT_RETENTION_DAYS = 90;

/** Presigned URLs are short-lived; both directions use 5 minutes. */
export const PRESIGN_TTL_SECONDS = 300;

/** Download links embedded in responses. */
export const DOWNLOAD_TTL_SECONDS = 300;

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly repo: ReceiptsRepository,
    private readonly audit: AuditService,
  ) {}

  /**
   * Step 1 — reserve a key and return an upload URL.
   * Does not touch the database; the Receipt row is created on complete().
   */
  async presign(
    user: AuthUser,
    dto: PresignUploadDto,
  ): Promise<{
    storageKey: string;
    uploadUrl: string;
    method: 'PUT' | 'POST';
    headers: Record<string, string>;
    expiresAt: string;
  }> {
    const merchantId = this.requireMerchantId(user);

    if (!isAllowedMimeType(dto.mimeType)) {
      throw new ReceiptInvalidTypeError(dto.mimeType);
    }
    if (dto.sizeBytes > MAX_RECEIPT_BYTES) {
      throw new ReceiptTooLargeError(MAX_RECEIPT_BYTES);
    }

    const storageKey = this.buildStorageKey(merchantId, dto.mimeType);

    try {
      const presigned = await this.storage.presignUpload(
        storageKey,
        dto.mimeType,
        PRESIGN_TTL_SECONDS,
      );
      return {
        storageKey,
        uploadUrl: presigned.uploadUrl,
        method: presigned.method,
        headers: presigned.headers,
        expiresAt: new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000).toISOString(),
      };
    } catch (err) {
      this.logger.error(`presign failed for ${storageKey}: ${String(err)}`);
      throw new StorageDriverError(this.storage.activeDriverName(), 'presign_upload_failed');
    }
  }

  /**
   * Step 2 — confirm the upload and create the Receipt row.
   *
   * Guards, in order:
   *   - key belongs to this tenant  (cross-tenant attachment)
   *   - object actually exists
   *   - size within limits
   *   - content type is an accepted image type
   *   - server-computed sha256 matches the client's claim
   */
  async complete(
    user: AuthUser,
    dto: CompleteUploadDto,
  ): Promise<{
    receiptId: string;
    storageKey: string;
    sizeBytes: number;
    createdAt: string;
  }> {
    const merchantId = this.requireMerchantId(user);
    this.assertTenantKey(dto.storageKey, merchantId);

    const head = await this.storage.head(dto.storageKey);
    if (!head?.exists) {
      throw new ReceiptNotUploadedError();
    }

    const sizeBytes = head.sizeBytes ?? 0;
    if (sizeBytes > MAX_RECEIPT_BYTES) {
      throw new ReceiptTooLargeError(MAX_RECEIPT_BYTES);
    }

    const mimeType = head.contentType;
    if (mimeType && !isAllowedMimeType(mimeType)) {
      throw new ReceiptInvalidTypeError(mimeType);
    }

    const body = await this.storage.getObject(dto.storageKey);
    const digest = createHash('sha256').update(body).digest('hex');
    if (digest.toLowerCase() !== dto.sha256.toLowerCase()) {
      throw new ReceiptHashMismatchError();
    }

    const expiresAt = new Date(Date.now() + RECEIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const receipt = await this.repo.create({
      merchantId,
      uploadedByUserId: user.id,
      storageKey: dto.storageKey,
      mimeType: mimeType ?? 'image/jpeg',
      sizeBytes,
      width: dto.width ?? null,
      height: dto.height ?? null,
      sha256: digest,
      inputMethod: dto.inputMethod,
      expiresAt,
    });

    this.audit.log({
      actorType: 'USER',
      actorUserId: user.id,
      action: 'receipt.uploaded',
      targetType: 'receipt',
      targetId: receipt.id,
      metadata: {
        merchantId,
        storageKey: dto.storageKey,
        sizeBytes,
        inputMethod: dto.inputMethod,
      },
    });

    this.logger.log({
      event: 'receipt.uploaded',
      receiptId: receipt.id,
      merchantId,
      sizeBytes,
    });

    return {
      receiptId: receipt.id,
      storageKey: receipt.storageKey,
      sizeBytes: receipt.sizeBytes,
      createdAt: receipt.createdAt.toISOString(),
    };
  }

  /**
   * Step 3 — metadata plus a short-lived download URL.
   * Sub-merchants may only read receipts they uploaded themselves.
   */
  async getById(
    user: AuthUser,
    receiptId: string,
  ): Promise<{
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
    downloadUrl: string;
  }> {
    const merchantId = this.requireMerchantId(user);

    const receipt = await this.repo.findByIdForMerchant(receiptId, merchantId);
    if (!receipt) {
      throw new ReceiptNotFoundError();
    }

    if (user.role === 'SUB_MERCHANT' && receipt.uploadedByUserId !== user.id) {
      throw new ForbiddenError('You can only access receipts you uploaded.');
    }

    const { downloadUrl } = await this.storage.presignDownload(
      receipt.storageKey,
      DOWNLOAD_TTL_SECONDS,
    );

    return {
      receiptId: receipt.id,
      storageKey: receipt.storageKey,
      mimeType: receipt.mimeType,
      sizeBytes: receipt.sizeBytes,
      width: receipt.width,
      height: receipt.height,
      sha256: receipt.sha256,
      inputMethod: receipt.inputMethod,
      createdAt: receipt.createdAt.toISOString(),
      expiresAt: receipt.expiresAt ? receipt.expiresAt.toISOString() : null,
      downloadUrl,
    };
  }

  // ── internals ───────────────────────────────────────────────────────────

  /**
   * A receipt key is only ever valid for the tenant that reserved it.
   * Anything else is a cross-tenant access attempt.
   */
  private assertTenantKey(storageKey: string, merchantId: string): void {
    if (!storageKey.startsWith(`receipts/${merchantId}/`)) {
      throw new TenantIsolationError();
    }
  }

  private buildStorageKey(merchantId: string, mimeType: string): string {
    return `receipts/${merchantId}/${newId()}.${extensionForMimeType(mimeType)}`;
  }

  private requireMerchantId(user: AuthUser): string {
    if (!user.merchantId) {
      throw new TenantIsolationError();
    }
    return user.merchantId;
  }
}
