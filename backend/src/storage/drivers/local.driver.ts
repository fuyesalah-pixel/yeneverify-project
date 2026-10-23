// ============================================================
// Yene Verify — Local Storage Driver (development)
//
// Writes objects to STORAGE_LOCAL_PATH on disk. "Presigned" URLs
// point back at this backend's internal upload endpoint and carry a
// short-lived HMAC token so an unauthenticated PUT cannot be forged.
//
// This driver exists so the receipt pipeline runs with no Cloudflare
// credentials. It is never selected when STORAGE_DRIVER=r2.
// ============================================================

import { createHmac, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, isAbsolute, join, resolve, sep } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/config.service';
import {
  assertSafeKey,
  type ObjectHead,
  type PresignedUpload,
  type StorageDriver,
} from './storage-driver.interface';

/** Presigned upload/download tokens expire after this many seconds. */
export const LOCAL_TOKEN_TTL_SECONDS = 300;

/** Extra salt so tokens minted here never collide with JWT secrets. */
const TOKEN_CONTEXT = 'local-storage-upload';

@Injectable()
export class LocalDriver implements StorageDriver {
  readonly name = 'local' as const;

  private readonly logger = new Logger(LocalDriver.name);
  private readonly root: string;
  private readonly secret: string;
  private readonly appUrl: string;
  private readonly internalBase: string;

  constructor(config: AppConfigService) {
    this.root = resolve(process.cwd(), config.storage.localPath);
    // Reuse the access-token secret so no new secret has to be provisioned.
    this.secret = config.jwt.accessSecret;
    this.appUrl = config.app.url.replace(/\/$/, ''); // The backend mounts everything under the global API prefix and URI
    // versioning (main.ts), so the internal endpoints do NOT live at
    // /internal/... but at /api/v1/internal/.... Note main.ts strips the "v"
    // only to hand Nest `defaultVersion`; Nest itself re-adds it, so the
    // served segment is the configured value verbatim ("v1"). Mint presigned
    // URLs at the route they are actually served at, or a client PUT would
    // 404.
    this.internalBase = `${config.runtime.apiPrefix}/${config.runtime.apiVersion}/internal`;
  }

  async presignUpload(key: string, _contentType: string, ttlSec: number): Promise<PresignedUpload> {
    assertSafeKey(key);
    const ttl = ttlSec > 0 ? ttlSec : LOCAL_TOKEN_TTL_SECONDS;
    const token = this.mintToken(key, ttl);
    const base = this.appUrl || `http://localhost:${this.portFromAppUrl()}`;
    return {
      uploadUrl: `${base}/${this.internalBase}/storage-upload/${key}?token=${encodeURIComponent(token)}`,
      method: 'PUT',
      headers: {},
    };
  }

  async presignDownload(key: string, ttlSec: number): Promise<{ downloadUrl: string }> {
    assertSafeKey(key);
    const ttl = ttlSec > 0 ? ttlSec : LOCAL_TOKEN_TTL_SECONDS;
    const token = this.mintToken(key, ttl);
    const base = this.appUrl || `http://localhost:${this.portFromAppUrl()}`;
    return {
      downloadUrl: `${base}/${this.internalBase}/storage-object/${key}?token=${encodeURIComponent(token)}`,
    };
  }

  /**
   * Validates a token minted by this driver.
   * Returns true only for an unexpired token bound to this exact key.
   */
  verifyToken(key: string, token: string): boolean {
    assertSafeKey(key);
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [keyB64, expiresAtRaw, signature] = parts;
    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

    const expected = this.sign(`${keyB64}.${expiresAtRaw}`);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;

    return Buffer.from(keyB64, 'base64url').toString('utf8') === key;
  }

  async head(key: string): Promise<ObjectHead | null> {
    const path = this.resolvePath(key);
    try {
      const stat = await fs.stat(path);
      if (!stat.isFile()) return null;
      return { exists: true, sizeBytes: stat.size };
    } catch {
      return null;
    }
  }

  async getObject(key: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(key));
  }

  async putObject(key: string, body: Buffer): Promise<void> {
    const path = this.resolvePath(key);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, body);
    this.logger.log(`Stored local object: ${key} (${body.length} bytes)`);
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolvePath(key), { force: true });
  }

  async health(): Promise<boolean> {
    try {
      await fs.mkdir(this.root, { recursive: true });
      await fs.access(this.root);
      return true;
    } catch {
      return false;
    }
  }

  /** Absolute path for a key, guaranteed to stay inside the root. */
  private resolvePath(key: string): string {
    assertSafeKey(key);
    const target = resolve(join(this.root, key));
    const rootWithSep = this.root.endsWith(sep) ? this.root : this.root + sep;
    if (!target.startsWith(rootWithSep) || isAbsolute(key)) {
      throw new Error('Storage key escapes the configured root');
    }
    return target;
  }

  private mintToken(key: string, ttlSec: number): string {
    const keyB64 = Buffer.from(key, 'utf8').toString('base64url');
    const expiresAt = Date.now() + ttlSec * 1000;
    return `${keyB64}.${expiresAt}.${this.sign(`${keyB64}.${expiresAt}`)}`;
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret)
      .update(`${TOKEN_CONTEXT}:${payload}`)
      .digest('base64url');
  }

  private portFromAppUrl(): number {
    try {
      return Number(new URL(this.appUrl).port || '3000');
    } catch {
      return 3000;
    }
  }
}
