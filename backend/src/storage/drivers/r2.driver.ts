// ============================================================
// Yene Verify — R2 Storage Driver
//
// Cloudflare R2 (or any S3-compatible endpoint, including local
// MinIO) via the AWS SDK v3. Real presigned URLs are issued, so the
// client uploads straight to object storage and never through the API.
// ============================================================

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/config.service';
import {
  assertSafeKey,
  MAX_RECEIPT_BYTES,
  type ObjectHead,
  type PresignedUpload,
  type StorageDriver,
} from './storage-driver.interface';

@Injectable()
export class R2Driver implements StorageDriver {
  readonly name = 'r2' as const;

  private readonly logger = new Logger(R2Driver.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: AppConfigService) {
    const r2 = config.r2;
    this.bucket = r2.bucket;
    this.client = new S3Client({
      region: r2.region,
      endpoint: r2.useMinio && r2.minioEndpoint ? r2.minioEndpoint : r2.endpoint,
      credentials: {
        accessKeyId: r2.useMinio && r2.minioAccessKey ? r2.minioAccessKey : r2.accessKeyId,
        secretAccessKey: r2.useMinio && r2.minioSecretKey ? r2.minioSecretKey : r2.secretAccessKey,
      },
      forcePathStyle: Boolean(r2.useMinio),
    });
  }

  async presignUpload(key: string, contentType: string, ttlSec: number): Promise<PresignedUpload> {
    assertSafeKey(key);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: MAX_RECEIPT_BYTES,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: ttlSec });
    return {
      uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
    };
  }

  async presignDownload(key: string, ttlSec: number): Promise<{ downloadUrl: string }> {
    assertSafeKey(key);
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return { downloadUrl: await getSignedUrl(this.client, command, { expiresIn: ttlSec }) };
  }

  async head(key: string): Promise<ObjectHead | null> {
    assertSafeKey(key);
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        exists: true,
        sizeBytes: res.ContentLength,
        contentType: res.ContentType,
      };
    } catch {
      return null;
    }
  }

  async getObject(key: string): Promise<Buffer> {
    assertSafeKey(key);
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty body for ${key}`);
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.log(`Deleted storage object: ${key}`);
  }

  async health(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
