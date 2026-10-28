// ============================================================
// Yene Verify — Credits × Notifications E2E (Task 14.3 Part C)
//
// The inbox side of the money path: a FINITE-plan merchant drains
// their balance through real verifications and the notifications
// table records exactly what the spec promises.
//
//   21 → VERIFIED → 20   CREDIT_LOW row #1 (consume landed at 20 ≤ 20)
//   20 → VERIFIED → 19   gate snapshot lowBalance=true — DEDUPED (one row)
//   19 → VERIFIED → 18   still exactly ONE CREDIT_LOW row (deduped)
//   18 → 1               synthetic consumes (no processor involved)
//    1 → VERIFIED → 0    CREDIT_EXHAUSTED row
//   submit at 0          → 402, nothing rows up
//
// The synthetic drain uses direct CreditsService.consumes on
// DB-inserted receipt+verification rows — that path does NOT go
// through the processor, so it fires no notifications: exactly the
// isolation the spec wants (the inbox reacts to REAL verifies).
//
// All fixture ids are FRESH per run: the ledger is append-only.
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import type { NotificationType } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/auth/tokens/token.service';
import { CreditsService } from '../src/credits/credits.service';
import { AdapterRegistry } from '../src/verification/adapters/adapter.registry';
import type {
  BankAdapter,
  VerifyInput,
  VerifyResult,
} from '../src/verification/adapters/adapter.interface';
import { MockProvider } from '../src/ocr/providers/mock.provider';
import { newId } from '../src/common/utils/id.util';

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 30_000;

function jpeg(bytes: number[]): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...bytes, 0xff, 0xd9]);
}
const JPEG_VERIFIED = jpeg([0x4a, 0x46, 0x49, 0x46, 0x03, 0xcf]);
const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

describe('Credits × Notifications (e2e, real DB + real queue)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let credits: CreditsService;
  let accessToken: string;
  let merchantId: string;
  let userId: string;

  const verifyRows: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
    const cfg = app.get(AppConfigService);
    app.setGlobalPrefix(cfg.runtime.apiPrefix, {
      exclude: ['health', 'health/ready', 'docs', 'version', '/'],
    });
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: cfg.runtime.apiVersion.replace(/^v/i, ''),
    });
    await app.init();

    prisma = app.get(PrismaService);
    credits = app.get(CreditsService);

    // ── Fixture: fresh merchant on a finite plan each run ────────────────
    userId = newId();
    merchantId = newId();
    const deviceId = newId();
    const sessionId = newId();

    await prisma.user.upsert({
      where: { id: userId },
      update: { status: 'ACTIVE', role: 'MERCHANT' },
      create: {
        id: userId,
        phone: `+2519${Date.now().toString().slice(-8)}`,
        phoneVerifiedAt: new Date(),
        fullName: 'E2E Credits Notifications Merchant',
        role: 'MERCHANT',
        status: 'ACTIVE',
      },
    });
    await prisma.package.upsert({
      where: { code: 'BUSINESS' },
      update: { unlimited: false },
      create: {
        code: 'BUSINESS',
        name: 'Business',
        priceMinor: 99900n,
        creditsPerMonth: 400,
        unlimited: false,
      },
    });
    await prisma.merchant.upsert({
      where: { id: merchantId },
      update: { status: 'ACTIVE' },
      create: {
        id: merchantId,
        ownerUserId: userId,
        businessName: 'E2E Credits-Notifications Coffee',
        status: 'ACTIVE',
      },
    });
    const subscriptionId = newId();
    await prisma.subscription.upsert({
      where: { id: subscriptionId },
      update: { status: 'ACTIVE', expiresAt: new Date(Date.now() + 30 * 86_400_000) },
      create: {
        id: subscriptionId,
        merchantId,
        packageCode: 'BUSINESS',
        status: 'ACTIVE',
        autoRenew: false,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    await prisma.merchant.update({ where: { id: merchantId }, data: { subscriptionId } });

    await prisma.device.upsert({
      where: { id: deviceId },
      update: { revokedAt: null },
      create: {
        id: deviceId,
        userId,
        deviceFingerprint: `e2e-cn-${randomBytes(6).toString('hex')}`,
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
        refreshTokenHash: createHash('sha256')
          .update(`e2e-cn-${randomBytes(8).toString('hex')}`)
          .digest('hex'),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    accessToken = app.get(TokenService).signAccessToken({
      sub: userId,
      role: 'MERCHANT',
      merchantId,
      sid: sessionId,
      did: deviceId,
    });

    // ── TEST_BANK adapter: always VERIFIED (full-alnum extraction) ───────
    const adapter: BankAdapter = {
      bankCode: 'TEST_BANK' as never,
      displayName: 'Test Bank (stub)',
      detect: (t: string) => t.includes('TEST_BANK'),
      detectConfidence: () => 0.95,
      extractReference: (t: string) => /TK[A-Za-z0-9]+/.exec(t)?.[0] ?? null,
      verify: async ({ referenceNormalized }: VerifyInput): Promise<VerifyResult> => ({
        status: 'VERIFIED',
        bankReference: referenceNormalized,
        amountMinor: 1500n,
        currency: 'ETB',
        senderName: 'E2E Sender',
        receiverName: 'E2E Credits-Notifications Coffee',
        paidAt: new Date(),
        metadata: { source: 'e2e-stub' },
      }),
      health: async () => true,
    };
    app.get(AdapterRegistry).register(adapter);

    // ── Mock OCR fixture: image hash → TEST_BANK text ────────────────────
    const ocrRef = `TK${randomBytes(12).toString('hex').toUpperCase()}`;
    app.get(MockProvider).addFixtures({
      [sha256(JPEG_VERIFIED)]: {
        text: `TEST_BANK transfer receipt ref=${ocrRef}`,
        confidence: 0.99,
      },
    });

    // Start at 21: one above the 20-credit warning threshold.
    await credits.grant({ merchantId, amount: 21n, type: 'GRANT', reason: 'e2e notifications' });
  }, 60_000);

  afterAll(async () => {
    // Immutable consume rows keep their verification rows alive — resolve
    // the blocked set first so the deletes below never race the ledger and
    // the app logger never prints FK noise.
    const consumed = new Set(
      (
        await prisma.creditTransaction.findMany({
          where: { type: 'CONSUME', verificationId: { in: verifyRows } },
          select: { verificationId: true },
        })
      )
        .map((t) => t.verificationId)
        .filter((id): id is string => Boolean(id)),
    );
    for (const id of verifyRows) {
      if (consumed.has(id)) continue;
      await prisma.verification.delete({ where: { id } }).catch(() => undefined);
    }
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  async function uploadReceipt(image: Buffer): Promise<string> {
    const presign = await request(app.getHttpServer())
      .post('/api/v1/receipts/presign')
      .set(auth())
      .send({
        fileName: `receipt-${randomBytes(4).toString('hex')}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: image.length,
        inputMethod: 'UPLOAD',
      })
      .expect(200);

    const target = new URL(presign.body.uploadUrl as string);
    await request(app.getHttpServer())
      .put(`${target.pathname}${target.search}`)
      .set('Content-Type', 'image/jpeg')
      .send(image)
      .expect(200);

    const complete = await request(app.getHttpServer())
      .post('/api/v1/receipts/complete')
      .set(auth())
      .send({ storageKey: presign.body.storageKey, inputMethod: 'UPLOAD', sha256: sha256(image) })
      .expect(201);
    return complete.body.receiptId as string;
  }

  async function submit(receiptId: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/verifications')
      .set(auth())
      .send({ receiptId });
    if (res.status === 202) verifyRows.push(res.body.verificationId as string);
    return res;
  }

  async function pollTerminal(verificationId: string): Promise<Record<string, unknown>> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    for (;;) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/verifications/${verificationId}`)
        .set(auth())
        .expect(200);
      if (res.body.status !== 'PENDING') return res.body as Record<string, unknown>;
      if (Date.now() > deadline) {
        throw new Error(`Verification ${verificationId} stayed PENDING past ${POLL_TIMEOUT_MS}ms`);
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  async function balance(): Promise<string> {
    const res = await request(app.getHttpServer())
      .get('/api/v1/merchants/me')
      .set(auth())
      .expect(200);
    return res.body.creditsBalance as string;
  }

  // The consume lags the verdict by design; poll for settlement.
  async function expectBalanceEventually(expected: string, timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let seen: string | null = null;
    for (;;) {
      seen = await balance();
      if (seen === expected) return;
      if (Date.now() > deadline) {
        throw new Error(`Balance stayed at ${seen}, expected ${expected}, within ${timeoutMs}ms`);
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  async function countNotifications(type: NotificationType): Promise<number> {
    return prisma.notification.count({ where: { merchantId, type } });
  }

  async function expectNotificationCountEventually(
    type: NotificationType,
    expected: number,
    timeoutMs = 10_000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const n = await countNotifications(type);
      if (n === expected) return;
      if (Date.now() > deadline) {
        throw new Error(
          `Notification ${type} count stayed at ${n}, expected ${expected}, within ${timeoutMs}ms`,
        );
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  /** Direct drain: receipt+verification rows in the DB, consume off-queue. */
  async function drainTo(targetBalance: number): Promise<void> {
    while (Number(await balance()) > targetBalance) {
      const receiptId = newId();
      const verificationId = newId();
      await prisma.receipt.create({
        data: {
          id: receiptId,
          merchantId,
          uploadedByUserId: userId,
          storageKey: `e2e-cn/${receiptId}.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 64,
          sha256: randomBytes(16).toString('hex'),
          inputMethod: 'UPLOAD',
        },
      });
      await prisma.verification.create({
        data: {
          id: verificationId,
          merchantId,
          verifiedByUserId: userId,
          receiptId,
          source: 'TRANSACTION',
          status: 'VERIFIED',
        },
      });
      await credits.consume({ merchantId, verificationId, verificationStatus: 'VERIFIED' });
      verifyRows.push(verificationId);
    }
  }

  it('low-balance fires once (dedup), exhaustion fires at 0, and 0 credits blocks submits', async () => {
    // ── 21 → 20: the consume lands at 20 ≤ 20 → first CREDIT_LOW row ──
    const submit1 = await submit(await uploadReceipt(JPEG_VERIFIED));
    expect(submit1.status).toBe(202);
    expect(submit1.body.credits).toMatchObject({ lowBalance: false });
    const verdict1 = await pollTerminal(submit1.body.verificationId as string);
    expect(verdict1.status).toBe('VERIFIED');
    await expectBalanceEventually('20');
    await expectNotificationCountEventually('CREDIT_LOW', 1);

    const [lowRow1] = await prisma.notification.findMany({
      where: { merchantId, type: 'CREDIT_LOW' },
    });
    expect(lowRow1.channel).toBe('PUSH'); // Step 15: rows write through notify() → channel PUSH (in-app inbox still queryable)
    expect(lowRow1.data).toMatchObject({ balance: '20' });
    expect(lowRow1.userId).toBe(userId);

    // ── 20 → 19: gate snapshot lowBalance=true — deduped against the row
    // the processor already wrote at 20 → still exactly ONE row ──────────
    const submit2 = await submit(await uploadReceipt(JPEG_VERIFIED));
    expect(submit2.status).toBe(202);
    expect(submit2.body.credits).toMatchObject({ balance: '20', lowBalance: true });
    const verdict2 = await pollTerminal(submit2.body.verificationId as string);
    expect(verdict2.status).toBe('VERIFIED');
    await expectBalanceEventually('19');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 2));
    await expectNotificationCountEventually('CREDIT_LOW', 1); // still one

    // ── 19 → 18: second low-balance event is DEDUPED ───────────────────
    const submit3 = await submit(await uploadReceipt(JPEG_VERIFIED));
    expect(submit3.status).toBe(202);
    const verdict3 = await pollTerminal(submit3.body.verificationId as string);
    expect(verdict3.status).toBe('VERIFIED');
    await expectBalanceEventually('18');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 2));
    await expectNotificationCountEventually('CREDIT_LOW', 1); // still one

    // ── 18 → 1: synthetic consumes fire nothing (off-processor) ───────
    await drainTo(1);
    await expectBalanceEventually('1');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 2));
    await expectNotificationCountEventually('CREDIT_LOW', 1);
    await expectNotificationCountEventually('CREDIT_EXHAUSTED', 0);

    // ── 1 → 0: the LAST real verification exhales the balance ─────────
    const submit4 = await submit(await uploadReceipt(JPEG_VERIFIED));
    expect(submit4.status).toBe(202);
    const verdict4 = await pollTerminal(submit4.body.verificationId as string);
    expect(verdict4.status).toBe('VERIFIED');
    await expectBalanceEventually('0');
    await expectNotificationCountEventually('CREDIT_EXHAUSTED', 1);

    const [exRow] = await prisma.notification.findMany({
      where: { merchantId, type: 'CREDIT_EXHAUSTED' },
    });
    expect(exRow.channel).toBe('PUSH'); // Step 15: rows write through notify() → channel PUSH
    expect(exRow.userId).toBe(userId);

    // ── dry: submit at 0 credits → 402 ─────────────────────────────────
    const rejected = await submit(await uploadReceipt(JPEG_VERIFIED));
    expect(rejected.status).toBe(402);
    expect(rejected.body.error.code).toBe('CREDITS_INSUFFICIENT');
  }, 120_000);
});
