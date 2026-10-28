// ============================================================
// Yene Verify — Credits × Verification E2E (Task 14.2)
//
// The first suite where the product costs money: a merchant with a
// FINITE plan submits real receipts through the real queue and the
// ledger is charged per terminal verdict.
//
//   balance 3 → VERIFIED  → 2 (submit response lowBalance=true)
//             → FAKE      → 2 (fraud detection is free)
//             → VERIFIED  → 1
//             → VERIFIED  → 0
//             → submit    → 402 CREDITS_INSUFFICIENT, no row
//   race     → 2 parallel submits with 1 credit → exactly 1 consumes
//
// A programmatically-registered TEST_BANK adapter returns VERIFIED for
// its references and FAKE for FAKE-tagged ones; mock-OCR fixtures map
// two distinct image hashes to TEST_BANK OCR text. No network.
//
// All fixture ids are FRESH per run: the ledger is append-only, so
// fixed ids would collide with earlier runs' immutable rows.
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
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
const JPEG_VERIFIED = jpeg([0x4a, 0x46, 0x49, 0x46, 0x01, 0xc9]);
const JPEG_FAKE = jpeg([0x4a, 0x46, 0x49, 0x46, 0x02, 0xcb]);
const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

describe('Credits × Verification (e2e, real DB + real queue)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let credits: CreditsService;
  let accessToken: string;
  let merchantId: string;
  let userId: string;

  const consumedRefIds: Record<string, string> = {}; // ref → verificationId
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
        fullName: 'E2E Credits×Verif Merchant',
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
        businessName: 'E2E Credits×Verif Coffee',
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
        deviceFingerprint: `e2e-cv-${randomBytes(6).toString('hex')}`,
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
          .update(`e2e-cv-${randomBytes(8).toString('hex')}`)
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

    // ── TEST_BANK adapter: VERIFIED unless the reference is FAKE-tagged ──
    const adapter: BankAdapter = {
      bankCode: 'TEST_BANK' as never,
      displayName: 'Test Bank (stub)',
      detect: (t: string) => t.includes('TEST_BANK'),
      detectConfidence: () => 0.95,
      // Full alnum token — hex-only regexes would truncate 'TKFAKE…'
      // at K, silently turning the FAKE receipt into a VERIFIED one.
      extractReference: (t: string) => /TK[A-Za-z0-9]+/.exec(t)?.[0] ?? null,
      verify: jest.fn(async ({ referenceNormalized }: VerifyInput): Promise<VerifyResult> => {
        if (referenceNormalized.startsWith('TKFAKE')) {
          return {
            status: 'FAKE' as const,
            errorCode: 'FAKE_UNKNOWN_RECEIPT',
            errorMessage: 'Receipt not in bank records.',
            // FAKE is ALWAYS definitive — matches AdapterBase semantics.
            retryable: false,
            metadata: { source: 'e2e-stub' },
          };
        }
        return {
          status: 'VERIFIED' as const,
          bankReference: referenceNormalized,
          amountMinor: 1500n,
          currency: 'ETB' as const,
          senderName: 'E2E Sender',
          receiverName: 'E2E Credits×Verif Coffee',
          paidAt: new Date(),
          metadata: { source: 'e2e-stub' },
        };
      }),
      health: async () => true,
    };
    app.get(AdapterRegistry).register(adapter);

    // ── Mock OCR fixtures: image hash → TEST_BANK text ───────────────────
    const ocrVerifiedRef = `TK${randomBytes(12).toString('hex').toUpperCase()}`;
    const ocrFakeRef = `TKFAKE${randomBytes(12).toString('hex').toUpperCase()}`;
    ((consumedRefIds.verifiedRef = ocrVerifiedRef), (consumedRefIds.fakeRef = ocrFakeRef));
    app.get(MockProvider).addFixtures({
      [sha256(JPEG_VERIFIED)]: {
        text: `TEST_BANK transfer receipt ref=${ocrVerifiedRef}`,
        confidence: 0.99,
      },
      [sha256(JPEG_FAKE)]: {
        text: `TEST_BANK transfer receipt ref=${ocrFakeRef}`,
        confidence: 0.99,
      },
    });
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

  /**
   * The processor commits the VERDICT before the CONSUME (deliberate:
   * an accounting failure must never hide an answer). So right after a
   * terminal status is visible, the balance lags by milliseconds —
   * poll until the consume lands instead of asserting instantly.
   */
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

  it('charges 1 credit for VERIFIED, 0 for FAKE, and blocks submits at 0', async () => {
    // ── top up to 3 ──────────────────────────────────────────────────────
    await credits.grant({ merchantId, amount: 3n, type: 'GRANT', reason: 'e2e flow balance' });
    expect(await balance()).toBe('3');

    // ── VERIFIED: 3 → 2, gate snapshot included in the 202 ──────────────
    const submit1 = await submit(await uploadReceipt(JPEG_VERIFIED));
    expect(submit1.status).toBe(202);
    expect(submit1.body.credits).toEqual({
      balance: '3',
      unlimited: false,
      lowBalance: true, // 3 <= 20 → instant in-app warning
    });
    const verdict1 = await pollTerminal(submit1.body.verificationId as string);
    expect(verdict1.status).toBe('VERIFIED');
    await expectBalanceEventually('2');

    // ── FAKE: 2 → 2 (fraud detection is free) ────────────────────────────
    const submit2 = await submit(await uploadReceipt(JPEG_FAKE));
    expect(submit2.status).toBe(202);
    const verdict2 = await pollTerminal(submit2.body.verificationId as string);
    expect(verdict2.status).toBe('FAKE');
    await expectBalanceEventually('2'); // FAKE drains nothing — no consume row

    // ── two VERIFIED: 2 → 1 → 0 ─────────────────────────────────────────
    const submit3 = await submit(await uploadReceipt(JPEG_VERIFIED));
    expect(submit3.status).toBe(202);
    const verdict3 = await pollTerminal(submit3.body.verificationId as string);
    expect(verdict3.status).toBe('VERIFIED');
    await expectBalanceEventually('1');

    const submit4 = await submit(await uploadReceipt(JPEG_VERIFIED));
    expect(submit4.status).toBe(202);
    const verdict4 = await pollTerminal(submit4.body.verificationId as string);
    expect(verdict4.status).toBe('VERIFIED');
    await expectBalanceEventually('0');

    // ── dry: submit at 0 credits → 402, NO verification row ────────────
    const rowsBefore = await prisma.verification.count({ where: { merchantId } });
    const rejected = await submit(await uploadReceipt(JPEG_VERIFIED));
    expect(rejected.status).toBe(402);
    expect(rejected.body.error.code).toBe('CREDITS_INSUFFICIENT');
    const rowsAfter = await prisma.verification.count({ where: { merchantId } });
    expect(rowsAfter).toBe(rowsBefore); // nothing entered the queue

    // Gate snapshot on the rejected path is unknown — but never a row.
  }, 60_000);

  it('race: two submits with 1 credit → exactly ONE consume; loser is blocked sooner OR billed-free, never double-charged', async () => {
    // ── top up to 1; submit two VERIFIED receipts in parallel ───────────
    await credits.grant({ merchantId, amount: 1n, type: 'GRANT', reason: 'race test' });
    const [receiptA, receiptB] = await Promise.all([
      uploadReceipt(JPEG_VERIFIED),
      uploadReceipt(JPEG_VERIFIED),
    ]);
    const [sa, sb] = await Promise.all([submit(receiptA), submit(receiptB)]);
    // Both race the submit gate on a balance of 1 — request order is
    // nondeterministic, so classify by OUTCOME, not by identity. THREE
    // correct shapes:
    //
    //   SNAPPED (1 accepted, 1 gate-402) — the winner's consume committed
    //     before the loser's gate read the balance; the loser leaves NO
    //     row behind. No leak at all.
    //   GATE_SNAP-through (2 accepted) — both gate checks saw balance 1
    //     before either processed; at process time the guarded cache
    //     update lets exactly one charge and atomically rolls the
    //     loser's ledger row back. The loser still gets its verdict,
    //     billed-free; the leak is bounded (1 credit) and audited
    //     ('credits.consume_failed').
    const accepted = [sa, sb].filter((r) => r.status === 202);
    const gateRejected = [sa, sb].filter((r) => r.status === 402);
    expect(accepted.length + gateRejected.length).toBe(2);
    expect(accepted.length).toBeGreaterThanOrEqual(1);
    for (const r of gateRejected) {
      expect(r.body.error.code).toBe('CREDITS_INSUFFICIENT');
      // Rejected at the gate: the 202 credit snapshot is absent and no
      // verification row ever enters the queue.
      expect(r.body.verificationId).toBeUndefined();
    }
    // eslint-disable-next-line no-console
    console.log(
      `[race observation] settled as SNAPPED(${gateRejected.length} gate-rejected) — ` +
        `${accepted.length} accepted, ${gateRejected.length} rejected`,
    );

    const acceptedIds = accepted.map((r) => r.body.verificationId as string);
    const gateRejectedIds = gateRejected
      .map((r) => r.body.verificationId as string | undefined)
      .filter((v): v is string => Boolean(v));
    const verdicts = await Promise.all(acceptedIds.map((id) => pollTerminal(id)));
    // Every accepted submission delivers its answer; a gate-rejected one
    // must not silently swallow a verdict.
    for (const verdict of verdicts) {
      expect(verdict.status).toBe('VERIFIED');
    }

    // The consume lags the verdict by design, so settle by polling rather
    // than asserting instantly. Exactly ONE consume may ever exist for the
    // pair; a second CONSUME row at any point is a real double-charge.
    const settle = async (): Promise<void> => {
      const deadline = Date.now() + 10_000;
      for (;;) {
        const consumeRows = await prisma.creditTransaction.count({
          where: {
            merchantId,
            type: 'CONSUME',
            verificationId: { in: acceptedIds },
          },
        });
        const failedAudits = await prisma.auditLog.count({
          where: { action: 'credits.consume_failed', targetId: { in: acceptedIds } },
        });
        const expectedAudits = accepted.length === 1 ? 0 : 1;
        if (consumeRows === 2) {
          throw new Error('RACE LEAK: both consumes landed — double charge, guard did not fire');
        }
        const settled = consumeRows === 1 && failedAudits === expectedAudits;
        if (settled) return;
        if (Date.now() > deadline) {
          throw new Error(
            `Race never settled: consumeRows=${consumeRows} failedAudits=${failedAudits} (expected ${expectedAudits}) within 10s`,
          );
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    };
    await settle();

    // Balance never went negative: it should be 0 after the single charge.
    await expectBalanceEventually('0');

    // A gate-rejected loser never enters the ledger at all.
    for (const rejectedId of gateRejectedIds) {
      const loserRows = await prisma.creditTransaction.count({
        where: { merchantId, type: 'CONSUME', verificationId: rejectedId },
      });
      expect(loserRows).toBe(0);
    }
  }, 90_000);
});
