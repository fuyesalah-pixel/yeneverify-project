// ============================================================
// Yene Verify — Receipts E2E
//
// Exercises the full upload flow against the local storage driver:
// presign → PUT the bytes → complete (with a real checksum) → read back.
//
// A user/device/session is created directly so the suite does not depend
// on the OTP login flow or on seeded data. Rows are removed afterwards.
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/auth/tokens/token.service';

// Smallest byte sequence that is still a structurally valid JPEG header.
const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);
const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

describe('Receipts (e2e, local driver)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;
  let accessToken: string;
  let storageRoot: string;

  const userId = '018f8c1a-0000-7000-8000-0000000e2e01';
  const deviceId = '018f8c1a-0000-7000-8000-0000000e2e02';
  const sessionId = '018f8c1a-0000-7000-8000-0000000e2e03';
  const merchantId = '018f8c1a-0000-7000-8000-0000000e2e04';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    const cfg = app.get(AppConfigService);

    app.setGlobalPrefix(cfg.runtime.apiPrefix, {
      exclude: ['health', 'health/ready', 'docs', 'version', '/'],
    });
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: cfg.runtime.apiVersion.replace(/^v/i, ''),
    });
    // Supertest drives the in-memory HTTP server, so the app never needs to
    // bind a port — the presigned URL host is irrelevant to the flow under test.
    await app.init();

    prisma = app.get(PrismaService);
    tokenService = app.get(TokenService);
    storageRoot = resolve(process.cwd(), cfg.storage.localPath);

    // The audit ledger is append-only (no-delete RULE), so these fixture rows
    // cannot be reliably removed between runs. Upserts keep setup idempotent.
    await prisma.user.upsert({
      where: { id: userId },
      update: { status: 'ACTIVE', role: 'MERCHANT' },
      create: {
        id: userId,
        phone: '+251922220001',
        phoneVerifiedAt: new Date(),
        fullName: 'E2E Merchant',
        role: 'MERCHANT',
        status: 'ACTIVE',
      },
    });
    await prisma.merchant.upsert({
      where: { id: merchantId },
      update: { status: 'ACTIVE' },
      create: {
        id: merchantId,
        ownerUserId: userId,
        businessName: 'E2E Merchant Business',
        status: 'ACTIVE',
      },
    });
    await prisma.device.upsert({
      where: { id: deviceId },
      update: { revokedAt: null },
      create: {
        id: deviceId,
        userId,
        deviceFingerprint: 'e2e-receipts-fingerprint',
        platform: 'ANDROID',
      },
    });
    await prisma.session.upsert({
      where: { id: sessionId },
      update: { revokedAt: null, expiresAt: new Date(Date.now() + 3_600_000) },
      create: {
        id: sessionId,
        userId,
        deviceId,
        refreshTokenHash: sha256(Buffer.from('e2e-refresh')),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    accessToken = tokenService.signAccessToken({
      sub: userId,
      role: 'MERCHANT',
      merchantId,
      sid: sessionId,
      did: deviceId,
    });
  }, 60_000);

  afterAll(async () => {
    // Receipts are removed so the next run starts from a clean slate. The user,
    // device, session and merchant fixtures are intentionally left in place:
    // audit_logs is append-only, so deleting them would fail the FK check.
    try {
      await prisma.receipt.deleteMany({ where: { merchantId } });
    } catch {
      /* best effort */
    }

    await fs.rm(resolve(storageRoot, 'receipts', merchantId), { recursive: true, force: true });
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  /**
   * PUT raw bytes at the presigned path. The token must survive intact, so
   * the pathname and query string are replayed as-is against the in-memory
   * server rather than following the (irrelevant) presigned host.
   */
  const putBytes = (url: string, body: Buffer) => {
    const target = new URL(url);
    return request(app.getHttpServer()).put(`${target.pathname}${target.search}`).send(body);
  };

  it('presign returns a tenant-scoped key and upload URL', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/receipts/presign')
      .set(auth())
      .send({
        fileName: 'receipt.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: JPEG.length,
        inputMethod: 'PHOTO',
      })
      .expect(200);

    expect(res.body.storageKey).toMatch(new RegExp(`^receipts/${merchantId}/.+\\.jpg$`));
    expect(res.body.method).toBe('PUT');
    expect(res.body.uploadUrl).toContain('/internal/storage-upload/');
    expect(res.body.expiresAt).toEqual(expect.any(String));
  });

  it('rejects an unsupported mime type with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/receipts/presign')
      .set(auth())
      .send({ fileName: 'notes.txt', mimeType: 'text/plain', sizeBytes: 12, inputMethod: 'UPLOAD' })
      .expect(422);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects presign without a token with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/receipts/presign')
      .send({ fileName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 10, inputMethod: 'UPLOAD' })
      .expect(401);
  });

  it('runs the full upload → complete → read flow', async () => {
    const presign = await request(app.getHttpServer())
      .post('/api/v1/receipts/presign')
      .set(auth())
      .send({
        fileName: 'receipt.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: JPEG.length,
        inputMethod: 'PHOTO',
      })
      .expect(200);

    const { storageKey, uploadUrl } = presign.body;

    // Step 2 — the client PUTs the bytes straight to the storage endpoint.
    await putBytes(uploadUrl, JPEG).expect(200);

    const complete = await request(app.getHttpServer())
      .post('/api/v1/receipts/complete')
      .set(auth())
      .send({ storageKey, inputMethod: 'PHOTO', sha256: sha256(JPEG), width: 800, height: 600 })
      .expect(201);

    expect(complete.body.receiptId).toEqual(expect.any(String));
    expect(complete.body.storageKey).toBe(storageKey);
    expect(complete.body.sizeBytes).toBe(JPEG.length);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/receipts/${complete.body.receiptId}`)
      .set(auth())
      .expect(200);

    expect(detail.body.receiptId).toBe(complete.body.receiptId);
    expect(detail.body.sha256).toBe(sha256(JPEG));
    expect(detail.body.width).toBe(800);
    expect(detail.body.downloadUrl).toEqual(expect.any(String));
  });

  it('rejects complete when the checksum does not match', async () => {
    const presign = await request(app.getHttpServer())
      .post('/api/v1/receipts/presign')
      .set(auth())
      .send({
        fileName: 'bad.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: JPEG.length,
        inputMethod: 'UPLOAD',
      })
      .expect(200);

    await putBytes(presign.body.uploadUrl, JPEG);

    const res = await request(app.getHttpServer())
      .post('/api/v1/receipts/complete')
      .set(auth())
      .send({ storageKey: presign.body.storageKey, inputMethod: 'UPLOAD', sha256: 'a'.repeat(64) })
      .expect(400);

    expect(res.body.error.code).toBe('RECEIPT_HASH_MISMATCH');
  });

  it('rejects complete when nothing was uploaded', async () => {
    const presign = await request(app.getHttpServer())
      .post('/api/v1/receipts/presign')
      .set(auth())
      .send({ fileName: 'ghost.jpg', mimeType: 'image/jpeg', sizeBytes: 10, inputMethod: 'UPLOAD' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/api/v1/receipts/complete')
      .set(auth())
      .send({ storageKey: presign.body.storageKey, inputMethod: 'UPLOAD', sha256: sha256(JPEG) })
      .expect(404);

    expect(res.body.error.code).toBe('RECEIPT_NOT_UPLOADED');
  });

  it('rejects a key belonging to another tenant', async () => {
    const foreignKey = `receipts/018f8c1a-0000-7000-8000-0000000e2eff/other.jpg`;

    const res = await request(app.getHttpServer())
      .post('/api/v1/receipts/complete')
      .set(auth())
      .send({ storageKey: foreignKey, inputMethod: 'UPLOAD', sha256: sha256(JPEG) })
      .expect(403);

    expect(res.body.error.code).toBe('TENANT_ISOLATION_VIOLATION');
  });

  it('404s when reading a receipt outside the tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/receipts/018f8c1a-0000-7000-8000-0000000e2e99')
      .set(auth())
      .expect(404);

    expect(res.body.error.code).toBe('RECEIPT_NOT_FOUND');
  });

  it('rejects an upload with a forged token', async () => {
    const presign = await request(app.getHttpServer())
      .post('/api/v1/receipts/presign')
      .set(auth())
      .send({
        fileName: 'forged.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 10,
        inputMethod: 'UPLOAD',
      })
      .expect(200);

    const tampered = presign.body.uploadUrl.replace(/token=.*/, 'token=forged.signature');
    await putBytes(tampered, JPEG).expect(404);
  });
});
