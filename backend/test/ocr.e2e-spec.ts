// ============================================================
// Yene Verify — OCR E2E
//
// Runs the mock engine against a real receipt uploaded through the
// storage flow: presign → PUT bytes → complete → POST /:id/ocr.
// The expected text is injected as a fixture keyed by the image's
// sha256 before the upload completes, emulating a known bill.
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
import { MockProvider } from '../src/ocr/providers/mock.provider';

// Smallest byte sequence that is still a structurally valid JPEG header.
const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);
const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

describe('OCR (e2e, mock provider)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;
  let accessToken: string;
  let storageRoot: string;

  const userId = '018f8c1a-0000-7000-8000-0000000e3e01';
  const deviceId = '018f8c1a-0000-7000-8000-0000000e3e02';
  const sessionId = '018f8c1a-0000-7000-8000-0000000e3e03';
  const merchantId = '018f8c1a-0000-7000-8000-0000000e3e04';

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
    // Supertest drives the in-memory HTTP server — no port binding needed.
    await app.init();

    prisma = app.get(PrismaService);
    tokenService = app.get(TokenService);
    storageRoot = resolve(process.cwd(), cfg.storage.localPath);

    // Default OCR_PROVIDER=mock is validated by the env schema; assert it so
    // the suite can never silently run against a real Vision connection.
    expect(cfg.ocr.provider).toBe('mock');

    // The audit ledger is append-only (no-delete RULE), so these fixture rows
    // cannot be reliably removed between runs. Upserts keep setup idempotent.
    await prisma.user.upsert({
      where: { id: userId },
      update: { status: 'ACTIVE', role: 'MERCHANT' },
      create: {
        id: userId,
        phone: '+251922220002',
        phoneVerifiedAt: new Date(),
        fullName: 'E2E OCR Merchant',
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
        businessName: 'E2E OCR Business',
        status: 'ACTIVE',
      },
    });
    await prisma.device.upsert({
      where: { id: deviceId },
      update: { revokedAt: null },
      create: {
        id: deviceId,
        userId,
        deviceFingerprint: 'e2e-ocr-fingerprint',
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
        refreshTokenHash: sha256(Buffer.from('e2e-ocr-refresh')),
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
    try {
      await prisma.receipt.deleteMany({ where: { merchantId } });
    } catch {
      /* best effort */
    }

    await fs.rm(resolve(storageRoot, 'receipts', merchantId), { recursive: true, force: true });
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  /** Replay the presigned pathname + HMAC token against the in-memory server. */
  const putBytes = (url: string, body: Buffer) => {
    const target = new URL(url);
    return request(app.getHttpServer()).put(`${target.pathname}${target.search}`).send(body);
  };

  /** Upload a receipt end to end and return its id + storage key. */
  const uploadReceipt = async (): Promise<{ receiptId: string; storageKey: string }> => {
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

    await putBytes(presign.body.uploadUrl, JPEG).expect(200);

    const complete = await request(app.getHttpServer())
      .post('/api/v1/receipts/complete')
      .set(auth())
      .send({ storageKey: presign.body.storageKey, inputMethod: 'PHOTO', sha256: sha256(JPEG) })
      .expect(201);

    return { receiptId: complete.body.receiptId, storageKey: presign.body.storageKey };
  };

  it('runs OCR on an uploaded receipt and returns the fixture text', async () => {
    // Inject the expected text keyed by the image hash before recognition.
    app.get(MockProvider).addFixtures({
      [sha256(JPEG)]: { text: 'E2E_OCR_FIXTURE_TEXT', confidence: 0.9 },
    });

    const { receiptId } = await uploadReceipt();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/receipts/${receiptId}/ocr`)
      .set(auth())
      .expect(200);

    expect(res.body.text).toBe('E2E_OCR_FIXTURE_TEXT');
    expect(res.body.confidence).toBe(0.9);
    expect(res.body.provider).toBe('mock');
    expect(res.body.receiptId).toBe(receiptId);
    expect(res.body.durationMs).toEqual(expect.any(Number));
  });

  it('falls back to the deterministic unmatched response without fixtures', async () => {
    const image = Buffer.from('another-unused-image');
    const { receiptId } = await (async () => {
      const presign = await request(app.getHttpServer())
        .post('/api/v1/receipts/presign')
        .set(auth())
        .send({
          fileName: 'receipt.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: image.length,
          inputMethod: 'UPLOAD',
        })
        .expect(200);
      await putBytes(presign.body.uploadUrl, image).expect(200);
      const complete = await request(app.getHttpServer())
        .post('/api/v1/receipts/complete')
        .set(auth())
        .send({ storageKey: presign.body.storageKey, inputMethod: 'UPLOAD', sha256: sha256(image) })
        .expect(201);
      return { receiptId: complete.body.receiptId };
    })();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/receipts/${receiptId}/ocr`)
      .set(auth())
      .expect(200);

    expect(res.body.text).toBe(`MOCK_OCR_UNMATCHED\nhash=${sha256(image)}`);
    expect(res.body.confidence).toBe(0.0);
  });

  it('rejects OCR for a receipt that does not exist with 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/receipts/018f8c1a-0000-7000-8000-0000000e3fff/ocr')
      .set(auth())
      .expect(404);

    expect(res.body.error.code).toBe('RECEIPT_NOT_FOUND');
  });

  it('rejects OCR for a receipt belonging to another tenant with 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/receipts/018f8c1a-0000-7000-8000-0000000e3ffe/ocr')
      .set(auth())
      .expect(404);

    expect(res.body.error.code).toBe('RECEIPT_NOT_FOUND');
  });
});
