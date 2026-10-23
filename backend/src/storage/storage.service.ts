import { Injectable, Logger } from '@nestjs/common';
import { DriverRegistry } from './drivers/driver.registry';
import { LocalDriver } from './drivers/local.driver';
import {
  assertSafeKey,
  type ObjectHead,
  type PresignedUpload,
  type StorageDriverName,
} from './drivers/storage-driver.interface';

/**
 * Thin facade over the active storage driver.
 *
 * Callers depend on this service only — never on a concrete driver — so
 * switching between local disk and R2 stays a configuration change.
 * The pre-existing R2-specific helpers (getPresignedUploadUrl etc.) are
 * kept for existing callers and now route through the same driver.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    private readonly registry: DriverRegistry,
    private readonly local: LocalDriver,
  ) {}

  activeDriverName(): StorageDriverName {
    return this.registry.name();
  }

  async presignUpload(key: string, contentType: string, ttlSec = 300): Promise<PresignedUpload> {
    return this.registry.active().presignUpload(key, contentType, ttlSec);
  }

  async presignDownload(key: string, ttlSec = 3600): Promise<{ downloadUrl: string }> {
    return this.registry.active().presignDownload(key, ttlSec);
  }

  async head(key: string): Promise<ObjectHead | null> {
    return this.registry.active().head(key);
  }

  async getObject(key: string): Promise<Buffer> {
    return this.registry.active().getObject(key);
  }

  /**
   * Server-side write. Only the local driver supports this — R2 clients
   * PUT directly to object storage using their presigned URL.
   */
  async putObject(key: string, body: Buffer): Promise<void> {
    assertSafeKey(key);
    return this.local.putObject(key, body);
  }

  async delete(key: string): Promise<void> {
    return this.registry.active().delete(key);
  }

  async isHealthy(): Promise<boolean> {
    return this.registry.active().health();
  }

  /** Local-driver-only helper used by the internal upload endpoint. */
  isLocalDriver(): boolean {
    return this.registry.isLocal();
  }

  // ── Backwards-compatible aliases ───────────────────────────────────────
  // Existing callers (storage health indicator, verification flow) use the
  // older names; both now delegate to the active driver.

  async getPresignedUploadUrl(key: string, contentType: string, ttlSeconds = 300) {
    const { uploadUrl } = await this.presignUpload(key, contentType, ttlSeconds);
    return uploadUrl;
  }

  async getPresignedDownloadUrl(key: string, ttlSeconds = 3600) {
    const { downloadUrl } = await this.presignDownload(key, ttlSeconds);
    return downloadUrl;
  }

  async headObject(key: string): Promise<boolean> {
    const head = await this.head(key);
    return Boolean(head?.exists);
  }

  async deleteObject(key: string): Promise<void> {
    await this.delete(key);
    this.logger.log(`Deleted storage object: ${key}`);
  }
}
