import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfigService } from '../config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
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

  /**
   * Returns a presigned PUT URL for direct client upload.
   * The client PUTs the file, then sends the key to POST /verifications.
   */
  async getPresignedUploadUrl(key: string, contentType: string, ttlSeconds = 300): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
  }

  /**
   * Returns a presigned GET URL for private asset download.
   */
  async getPresignedDownloadUrl(key: string, ttlSeconds = 3600): Promise<string> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
  }

  /** Check if an object exists without downloading it. */
  async headObject(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  /** Delete an object from storage. */
  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.log(`Deleted storage object: ${key}`);
  }

  /** Liveness check — tries to HEAD the bucket root. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: '.health-check' }));
      return true;
    } catch (err: unknown) {
      // 404 means the bucket is reachable but the key doesn't exist — healthy
      const code = (err as { name?: string })?.name;
      return code === 'NotFound' || code === 'NoSuchKey';
    }
  }
}
