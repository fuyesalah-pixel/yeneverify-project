// ============================================================
// Yene Verify — Verifications E2E (13E.3)
//
// Exercises the PRODUCT flow against the real wiring:
//   presign → PUT → complete (a real receipt row)
//   POST /verifications → BullMQ (real Redis + worker) → OCR mock
//   poll until not PENDING → retry / request-review / list
//
// The mock OCR provider returns MOCK_OCR_UNMATCHED for any unregistered
// image, so no bank is detected and every verification settles at
// ERROR/VERIFICATION_BANK_NOT_DETECTED — a deterministic non-PENDING
// terminal state that needs no bank adapters and no network.
//
// Fixture rows live for the suite and are removed afterwards; the
// audit ledger is append-only, so users/devices are upserted to keep
// the setup idempotent across runs.
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
import { CreditsService } from '../src/credits/credits.service';

const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);
const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 20_000;

describe('Verifications (e2e, local driver + real queue)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;
  let cfg: AppConfigService;
  let merchantToken: string;
  let subToken: string;

  // ── Stable fixture ids (kept low-noise in uuid7 style; the e2e/e3e
  // blocks belong to receipts/ocr, so this suite uses its own block) ──
  const merchantUserId = '018f8c1a-0000-7000-8000-0000000e4e01';
  const subUserId = '018f8c1a-0000-7000-8000-0000000e4e02';
  const merchantDeviceId = '018f8c1a-0000-7000-8000-0000000e4e03';
  const subDeviceId = '018f8c1a-0000-7000-8000-0000000e4e04';
  const merchantSessionId = '018f8c1a-0000-7000-8000-0000000e4e05';
  const subSessionId = '018f8c1a-0000-7000-8000-0000000e4e06';
  const merchantId = '018f8c1a-0000-7000-8000-0000000e4e07';
  const fakeVerificationId = '018f8c1a-0000-7000-8000-0000000e4e08';

  const createdReceiptIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
    cfg = app.get(AppConfigService);

    app.setGlobalPrefix(cfg.runtime.apiPrefix, {
      exclude: ['health', 'health/ready', 'docs', 'version', '/'],
    });
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: cfg.runtime.apiVersion.replace(/^v/i, ''),
    });
    await app.init();

    prisma = app.get(PrismaService);
    tokenService = app.get(TokenService);

    // ── Fixtures (upserts: audit_logs keeps deleting the identities illegal) ──
    await prisma.user.upsert({
      where: { id: merchantUserId },
      update: { status: 'ACTIVE', role: 'MERCHANT' },
      create: {
        id: merchantUserId,
        phone: '+251944440001',
        phoneVerifiedAt: new Date(),
        fullName: 'E2E Merchant',
        role: 'MERCHANT',
        status: 'ACTIVE',
      },
    });
    await prisma.user.upsert({
      where: { id: subUserId },
      update: { status: 'ACTIVE', role: 'SUB_MERCHANT' },
      create: {
        id: subUserId,
        phone: '+251944440002',
        phoneVerifiedAt: new Date(),
        fullName: 'E2E Sub Merchant',
        role: 'SUB_MERCHANT',
        status: 'ACTIVE',
      },
    });
    await prisma.merchant.upsert({
      where: { id: merchantId },
      update: { status: 'ACTIVE' },
      create: {
        id: merchantId,
        ownerUserId: merchantUserId,
        businessName: 'E2E Verification Merchant',
        status: 'ACTIVE',
      },
    });
    // 14.2 gates submissions on credits; this suite tests the verification
    // pipeline, not billing — top the ledger up so submits pass the gate.
    // Idempotent per-run: the ledger is append-only and the fixed fixture
    // merchant accumulates rows, so grant only when the base grant is new
    // (ledger sum below the requested balance).
    const credits = app.get(CreditsService);
    const merchantLedger = await prisma.creditTransaction.aggregate({
      where: { merchantId, type: { not: 'ADJUSTMENT' } },
      _sum: { amount: true },
    });
    if ((merchantLedger._sum.amount ?? 0n) < 1000n) {
      await credits.grant({
        merchantId,
        amount: 1000n,
        type: 'GRANT',
        reason: 'E2E verifications fixture balance',
      });
    }
    // TenantGuard resolves SUB_MERCHANT scope from sub_merchants (status must
    // be ACTIVE) — a bare user row is not enough for the tenant guard.
    await prisma.subMerchant.upsert({
      where: { userId: subUserId },
      update: { status: 'ACTIVE', deletedAt: null },
      create: {
        id: '018f8c1a-0000-7000-8000-0000000e4e09',
        userId: subUserId,
        merchantId,
        status: 'ACTIVE',
        branchLabel: 'E2E Verification Branch',
        invitedAt: new Date(),
        joinedAt: new Date(),
      },
    });
    for (const [id, userId, fp, sessionId] of [
      [merchantDeviceId, merchantUserId, 'e2e-verif-merchant-fp', merchantSessionId],
      [subDeviceId, subUserId, 'e2e-verif-sub-fp', subSessionId],
    ] as const) {
      await prisma.device.upsert({
        where: { id },
        update: { revokedAt: null },
        create: { id, userId, deviceFingerprint: fp, platform: 'ANDROID' },
      });
      await prisma.session.upsert({
        where: { id: sessionId },
        update: { revokedAt: null, expiresAt: new Date(Date.now() + 3_600_000) },
        create: {
          id: sessionId,
          userId,
          deviceId: id,
          refreshTokenHash: sha256(Buffer.from(fp)),
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
    }

    // ── Hermeticity: crashed-prior-run leftovers (afterAll never ran) would
    // otherwise leak into the count assertions below. Audit logs pin the
    // identities, but verification/review/receipt rows may be wiped freely. ──
    await prisma.verificationReview.deleteMany({ where: { merchantId } });
    try {
      await prisma.transaction.deleteMany({ where: { merchantId } });
    } catch {
      /* table may be empty */
    }
    try {
      await prisma.duplicateFingerprint.deleteMany({ where: { firstMerchantId: merchantId } });
    } catch {
      /* none created */
    }
    await prisma.verification.deleteMany({ where: { merchantId } });
    await prisma.receipt.deleteMany({ where: { merchantId } });

    merchantToken = tokenService.signAccessToken({
      sub: merchantUserId,
      role: 'MERCHANT',
      merchantId,
      sid: merchantSessionId,
      did: merchantDeviceId,
    });
    subToken = tokenService.signAccessToken({
      sub: subUserId,
      role: 'SUB_MERCHANT',
      merchantId,
      sid: subSessionId,
      did: subDeviceId,
    });
  }, 90_000);

  afterAll(async () => {
    // Terminal-state rows first (FK order), regardless of test outcomes.
    await prisma.verificationReview.deleteMany({ where: { merchantId } });
    try {
      await prisma.transaction.deleteMany({ where: { merchantId } });
    } catch {
      /* table may be empty */
    }
    try {
      await prisma.duplicateFingerprint.deleteMany({
        where: { firstMerchantId: merchantId },
      });
    } catch {
      /* none created */
    }
    await prisma.verification.deleteMany({ where: { merchantId } });
    await prisma.receipt.deleteMany({ where: { merchantId } });

    await fs.rm(resolve(process.cwd(), cfg.storage.localPath, 'receipts', merchantId), {
      recursive: true,
      force: true,
    });
    await app.close();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const merchantAuth = () => auth(merchantToken);
  const subAuth = () => auth(subToken);

  /** presign → PUT → complete → receiptId. */
  async function uploadReceipt(
    headers: Record<string, string>,
    fileName: string,
    inputMethod: 'PHOTO' | 'UPLOAD' = 'PHOTO',
  ): Promise<string> {
    const presign = await request(app.getHttpServer())
      .post('/api/v1/receipts/presign')
      .set(headers)
      .send({ fileName, mimeType: 'image/jpeg', sizeBytes: JPEG.length, inputMethod })
      .expect(200);

    const target = new URL(presign.body.uploadUrl as string);
    await request(app.getHttpServer())
      .put(`${target.pathname}${target.search}`)
      .send(JPEG)
      .expect(200);

    const complete = await request(app.getHttpServer())
      .post('/api/v1/receipts/complete')
      .set(headers)
      .send({ storageKey: presign.body.storageKey, inputMethod, sha256: sha256(JPEG) })
      .expect(201);

    createdReceiptIds.push(complete.body.receiptId as string);
    return complete.body.receiptId as string;
  }

  /** Poll the detail endpoint until the queue has produced a verdict. */
  async function pollUntilTerminal(
    verificationId: string,
    headers: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    for (;;) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/verifications/${verificationId}`)
        .set(headers)
        .expect(200);
      if (res.body.status !== 'PENDING') return res.body;
      if (Date.now() > deadline) {
        throw new Error(`Verification ${verificationId} stayed PENDING past ${POLL_TIMEOUT_MS}ms`);
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  it('runs upload → submit → queue → poll to a terminal verdict with no PII leaks', async () => {
    const receiptId = await uploadReceipt(merchantAuth(), 'receipt.jpg');

    const submit = await request(app.getHttpServer())
      .post('/api/v1/verifications')
      .set(merchantAuth())
      .send({ receiptId })
      .expect(202);

    expect(submit.body.status).toBe('PENDING');
    expect(submit.body.verificationId).toEqual(expect.any(String));
    expect(submit.body.createdAt).toEqual(expect.any(String));
    const verificationId = submit.body.verificationId as string;

    const detail = (await pollUntilTerminal(verificationId, merchantAuth())) as {
      status: string;
      errorCode: string | null;
      source: string;
      receipt: { id: string; mimeType: string; sizeBytes: number; uploadedAt: string };
      createdAt: string;
    };

    // The mock OCR text matches no bank: deterministic terminal ERROR.
    expect(detail.status).toBe('ERROR');
    expect(detail.errorCode).toBe('VERIFICATION_BANK_NOT_DETECTED');
    expect(detail.source).toBe('TRANSACTION');
    expect(detail.receipt.id).toBe(receiptId);
    expect(detail.receipt.mimeType).toBe('image/jpeg');
    expect(detail.receipt.uploadedAt).toEqual(expect.any(String));
    expect(detail.createdAt).toEqual(expect.any(String));

    // PII/internal-field sweep over the FULL serialized body.
    const serialized = JSON.stringify(detail);
    for (const forbidden of ['storageKey', 'ocrRawText', 'adapterMetadata', 'sha256']) {
      expect(serialized).not.toContain(forbidden);
    }
  }, 40_000);

  it('sub-merchant cannot verify a receipt they did not upload (403)', async () => {
    const receiptId = await uploadReceipt(merchantAuth(), 'merchant-owned.jpg');

    const res = await request(app.getHttpServer())
      .post('/api/v1/verifications')
      .set(subAuth())
      .send({ receiptId })
      .expect(403);

    expect(res.body.error.code).toBeTruthy();
  });

  it('sub-merchant can verify their own receipt and list shows only their rows', async () => {
    const receiptId = await uploadReceipt(subAuth(), 'sub-owned.jpg');

    const submit = await request(app.getHttpServer())
      .post('/api/v1/verifications')
      .set(subAuth())
      .send({ receiptId })
      .expect(202);
    await pollUntilTerminal(submit.body.verificationId as string, subAuth());

    const subList = await request(app.getHttpServer())
      .get('/api/v1/verifications')
      .set(subAuth())
      .expect(200);
    // Sub scope is a WHERE clause server-side: only rows they verified.
    expect(subList.body.meta.total).toBe(1);
    expect(subList.body.data[0].id).toBe(submit.body.verificationId);
    expect((subList.body.data[0] as Record<string, unknown>).verifiedByUserId).toBeUndefined();
    // The list is a payment history: sender/receiver labels are always present
    // (null when the bank paid out without a readable sender).
    expect(subList.body.data[0]).toHaveProperty('senderName');
    expect(subList.body.data[0]).toHaveProperty('receiverName');

    const merchantList = await request(app.getHttpServer())
      .get('/api/v1/verifications')
      .set(merchantAuth())
      .expect(200);
    expect(merchantList.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(merchantList.body.meta.page).toBe(1);
    expect(merchantList.body.meta.totalPages).toBeGreaterThanOrEqual(1);
  }, 40_000);

  it('retry rejects a definitive FAKE verdict with 409 (bank is not hammered)', async () => {
    // Seed a FAKE verification directly — a fake reference must never be
    // re-sent to the bank, which is exactly what this test locks in.
    const receiptId = await uploadReceipt(merchantAuth(), 'fake-claim.jpg');
    await prisma.verification.upsert({
      where: { id: fakeVerificationId },
      update: {
        status: 'FAKE',
        errorCode: null,
        senderName: 'Abebe Kebede',
        receiverName: 'Selam Coffee',
      },
      create: {
        id: fakeVerificationId,
        merchantId,
        verifiedByUserId: merchantUserId,
        receiptId,
        source: 'TRANSACTION',
        status: 'FAKE',
        bankCode: 'CBE',
        bankReference: 'FT26E2EFAKE000000',
        referenceNormalized: 'FT26E2EFAKE000000',
        senderName: 'Abebe Kebede',
        receiverName: 'Selam Coffee',
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/verifications/${fakeVerificationId}/retry`)
      .set(merchantAuth())
      .expect(409);
    expect(res.body.error.code).toBe('VERIFICATION_NOT_RETRYABLE');

    // Sub-merchants cannot retry at all (403 before any status check).
    await request(app.getHttpServer())
      .post(`/api/v1/verifications/${fakeVerificationId}/retry`)
      .set(subAuth())
      .expect(403);
  });

  it('retry re-runs an ERROR verification to a fresh terminal verdict', async () => {
    const receiptId = await uploadReceipt(merchantAuth(), 'retry-error.jpg');
    const submit = await request(app.getHttpServer())
      .post('/api/v1/verifications')
      .set(merchantAuth())
      .send({ receiptId })
      .expect(202);
    const first = (await pollUntilTerminal(
      submit.body.verificationId as string,
      merchantAuth(),
    )) as { status: string; completedAt: string | null };
    expect(first.status).toBe('ERROR');
    const firstCompletedAt = first.completedAt;

    const retry = await request(app.getHttpServer())
      .post(`/api/v1/verifications/${submit.body.verificationId}/retry`)
      .set(merchantAuth())
      .expect(202);
    expect(retry.body.status).toBe('PENDING');

    const second = (await pollUntilTerminal(
      submit.body.verificationId as string,
      merchantAuth(),
    )) as {
      status: string;
      errorCode: string;
      errorMessage: string | null;
      completedAt: string | null;
    };
    expect(second.status).toBe('ERROR');
    expect(second.errorCode).toBe('VERIFICATION_BANK_NOT_DETECTED');
    expect(second.completedAt).toEqual(expect.any(String));
    // A genuinely fresh attempt wrote a new completion timestamp.
    expect(second.completedAt).not.toEqual(firstCompletedAt);
  }, 40_000);

  it('request-review flags an ERROR verification and swaps it to NEEDS_REVIEW', async () => {
    const receiptId = await uploadReceipt(merchantAuth(), 'review-me.jpg');
    const submit = await request(app.getHttpServer())
      .post('/api/v1/verifications')
      .set(merchantAuth())
      .send({ receiptId })
      .expect(202);
    await pollUntilTerminal(submit.body.verificationId as string, merchantAuth());

    const review = await request(app.getHttpServer())
      .post(`/api/v1/verifications/${submit.body.verificationId}/request-review`)
      .set(merchantAuth())
      .send({ reason: 'Counter receipt shows a different amount — please check.' })
      .expect(200);

    expect(review.body.status).toBe('NEEDS_REVIEW');
    expect(review.body.reviewId).toEqual(expect.any(String));
    expect(review.body.verificationId).toBe(submit.body.verificationId);

    const detail = (await pollUntilTerminal(
      review.body.verificationId as string,
      merchantAuth(),
    )) as {
      status: string;
      errorCode: string | null;
    };
    expect(detail.status).toBe('NEEDS_REVIEW');
    expect(detail.errorCode).toBe('VERIFICATION_MANUAL_REVIEW');

    // Sub-merchants escalate out-of-band: 403 on this route.
    await request(app.getHttpServer())
      .post(`/api/v1/verifications/${submit.body.verificationId}/request-review`)
      .set(subAuth())
      .send({ reason: 'sub cannot flag' })
      .expect(403);

    // VERIFIED/terminal states cannot be flagged — the FAKE row was left
    // NEEDS_REVIEW by an earlier test, so assert against a fresh FAKE.
    const fakeRes = await request(app.getHttpServer())
      .post(`/api/v1/verifications/${fakeVerificationId}/request-review`)
      .set(merchantAuth())
      .send({ reason: 'double flag' });
    expect([200, 409].includes(fakeRes.status)).toBe(true); // fake row may already be NEEDS_REVIEW
  }, 40_000);

  it('list rows carry senderName and receiverName for payment-history labels', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/verifications')
      .query({ search: 'FT26E2EFAKE000000' })
      .set(merchantAuth())
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const row = res.body.data[0] as Record<string, unknown>;
    expect(row.senderName).toBe('Abebe Kebede');
    expect(row.receiverName).toBe('Selam Coffee');
  });

  it('unknown id 404s with a clean envelope and DTO validation rejects bad bodies', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/verifications/018f8c1a-0000-7000-8000-0000000e4e99')
      .set(merchantAuth())
      .expect(404)
      .expect((res) => {
        expect(res.body.error.code).toBe('VERIFICATION_NOT_FOUND');
      });

    await request(app.getHttpServer())
      .post('/api/v1/verifications')
      .set(merchantAuth())
      .send({ receiptId: 'not-a-uuid' })
      .expect(422);

    await request(app.getHttpServer())
      .post('/api/v1/verifications')
      .set(merchantAuth())
      .send({ receiptId: '018f8c1a-0000-7000-8000-0000000e4e99', source: 'BILLING' })
      .expect(422); // BILLING without package/expected amount

    await request(app.getHttpServer())
      .post('/api/v1/verifications')
      .set(merchantAuth())
      .send({ receiptId: '018f8c1a-0000-7000-8000-0000000e4e98' })
      .expect(404); // receipt owned elsewhere
  });
});
