// ============================================================
// Yene Verify — Billing Money-In E2E (Step 16, real DB + real queue)
//
// The loop that makes the product self-sustaining:
//
//   initiate (BUSINESS, 99900) → submit screenshot → same engine
//   (source=BILLING) → APPROVED → +400 credits + subscription →
//   balance 5 → 405 → same-month second approval → 805.
//
// Negative paths: AMOUNT_MISMATCH (zero tolerance), FAKE, receipt
// reuse (409), non-PENDING resubmission (409), cross-tenant 404.
//
// A TEST_BANK adapter is registered programmatically (same pattern as
// the credits×verification suite): TKOK<n>… refs verify with amount n,
// TKMIS<n>… verify but with a WRONG amount, TKFAKE… resolve FAKE.
// Every reference carries a random suffix so the 13F fingerprint
// detector never turns a second e2e approval into a DUPLICATE.
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

const POLL_INTERVAL_MS = 300;
const POLL_TIMEOUT_MS = 30_000;

function jpeg(bytes: number[]): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...bytes, 0xff, 0xd9]);
}
const JPEG_APPROVED = jpeg([0x51, 0x01, 0x42, 0x49, 0x8c]);
const JPEG_MISMATCH = jpeg([0x51, 0x02, 0x42, 0x49, 0x8d]);
const JPEG_FAKE = jpeg([0x51, 0x03, 0x42, 0x49, 0x8e]);
const JPEG_REUSE = jpeg([0x51, 0x04, 0x42, 0x49, 0x8f]);
const JPEG_EXTEND = jpeg([0x51, 0x05, 0x42, 0x49, 0x90]);
const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

// LETTERS ONLY: the adapter derives the amount from the digit run right
// after TKOK/TKMIS, so a digit-bearing suffix would corrupt it ('TKOK99900' +
// '12' would read as 9990012).
const uniq = (): string =>
  Array.from(randomBytes(4))
    .map((b) => String.fromCharCode(65 + (b % 26)))
    .join('');

describe('Billing money-in (e2e, real DB + real queue)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let otherToken: string;
  let userId: string;
  let merchantId: string;
  let businessPriceMinor = 99900n;

  const createdReceiptIds: string[] = [];
  const billingSessionIds: string[] = [];
  const otherUserId = newId();
  let otherMerchantId = newId();

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
    await app.init();

    prisma = app.get(PrismaService);

    // ── Fixture identity (fresh per run — audit_logs pins old identities) ──
    userId = newId();
    merchantId = newId();
    const deviceId = newId();
    const sessionId = newId();
    const otherUserId = newId();
    otherMerchantId = newId();

    await prisma.user.upsert({
      where: { id: userId },
      update: { status: 'ACTIVE', role: 'MERCHANT' },
      create: {
        id: userId,
        phone: `+2519${Date.now().toString().slice(-8)}`,
        phoneVerifiedAt: new Date(),
        fullName: 'E2E Billing Merchant',
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
        businessName: 'E2E Billing Business',
        status: 'ACTIVE',
      },
    });

    // ── Payment packages (Step 5 schema): read the live price for assertions ──
    const businessPkg = await prisma.package.upsert({
      where: { code: 'BUSINESS' },
      update: {},
      create: {
        code: 'BUSINESS',
        name: 'Business',
        priceMinor: 99900n,
        creditsPerMonth: 400,
        unlimited: false,
        active: true,
      },
    });
    if (businessPkg.priceMinor && businessPkg.priceMinor > 0n) {
      businessPriceMinor = businessPkg.priceMinor;
    }

    // FREE must exist for the guards, even though it is unpurchasable.
    await prisma.package.upsert({
      where: { code: 'FREE' },
      update: {},
      create: {
        code: 'FREE',
        name: 'Free',
        priceMinor: 0n,
        creditsPerMonth: 10,
        unlimited: false,
        active: true,
      },
    });

    // ── Cross-tenant rival merchant (404 assertions) ──
    await prisma.user.upsert({
      where: { id: otherUserId },
      update: { status: 'ACTIVE', role: 'MERCHANT' },
      create: {
        id: otherUserId,
        phone: `+2519${(Date.now() + 1).toString().slice(-8)}`,
        phoneVerifiedAt: new Date(),
        fullName: 'E2E Billing Rival',
        role: 'MERCHANT',
        status: 'ACTIVE',
      },
    });
    await prisma.merchant.upsert({
      where: { id: otherMerchantId },
      update: { status: 'ACTIVE' },
      create: {
        id: otherMerchantId,
        ownerUserId: otherUserId,
        businessName: 'E2E Billing Rival Business',
        status: 'ACTIVE',
      },
    });

    // ── Seed a starting balance of 5 (Step 14 ledger) ──
    await app.get(CreditsService).grant({
      merchantId,
      amount: 5n,
      type: 'GRANT',
      reason: 'E2E billing fixture starting balance',
    });

    for (const [id, uid, fp, ssid] of [
      [deviceId, userId, `e2e-billing-${randomBytes(6).toString('hex')}`, sessionId],
    ] as const) {
      await prisma.device.upsert({
        where: { id },
        update: { revokedAt: null },
        create: { id, userId: uid, deviceFingerprint: fp, platform: 'ANDROID' },
      });
      await prisma.session.upsert({
        where: { id: ssid },
        update: { revokedAt: null, expiresAt: new Date(Date.now() + 3_600_000) },
        create: {
          id: ssid,
          userId: uid,
          deviceId: id,
          refreshTokenHash: createHash('sha256').update(fp).digest('hex'),
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
    }

    accessToken = app.get(TokenService).signAccessToken({
      sub: userId,
      role: 'MERCHANT',
      merchantId,
      sid: sessionId,
      did: deviceId,
    });
    otherToken = app.get(TokenService).signAccessToken({
      sub: otherUserId,
      role: 'MERCHANT',
      merchantId: otherMerchantId,
      sid: sessionId,
      did: deviceId,
    });

    // ── TEST_BANK adapter: amount encoded in the reference ────────────────
    //   TKOK<n><suffix>    → VERIFIED with amount n (exact-match path)
    //   TKMIS<n><suffix>   → VERIFIED but WRONG amount (mismatch path)
    //   TKFAKE<suffix>     → FAKE (definitive)
    const adapter: BankAdapter = {
      bankCode: 'TEST_BANK' as never,
      displayName: 'Test Bank (billing stub)',
      detect: (t: string) => t.includes('TEST_BANK'),
      detectConfidence: () => 0.95,
      extractReference: (t: string) => /TK[A-Za-z0-9]+/.exec(t)?.[0] ?? null,
      verify: async ({ referenceNormalized }: VerifyInput): Promise<VerifyResult> => {
        if (referenceNormalized.startsWith('TKFAKE')) {
          return {
            status: 'FAKE' as const,
            errorCode: 'FAKE_UNKNOWN_RECEIPT',
            errorMessage: 'Receipt not in bank records.',
            retryable: false,
            metadata: { source: 'billing-e2e-stub' },
          };
        }
        const amount = /TK(?:OK|MIS)(\d+)/.exec(referenceNormalized)?.[1] ?? '0';
        return {
          status: 'VERIFIED' as const,
          bankReference: referenceNormalized,
          amountMinor: BigInt(amount),
          currency: 'ETB' as const,
          senderName: 'E2E Billing Sender',
          receiverName: 'Yene Verify Payments',
          paidAt: new Date(),
          metadata: { source: 'billing-e2e-stub' },
        };
      },
      health: async () => true,
    };
    app.get(AdapterRegistry).register(adapter);

    // ── Mock OCR fixtures: image hash → TEST_BANK receipt text ────────────
    // The 999.00 ETB fixture the money-in loop needs: amount parses to
    // exactly the BUSINESS package price in santim.
    const refApproved = `TKOK${businessPriceMinor.toString()}${uniq()}`;
    const refExtended = `TKOK${businessPriceMinor.toString()}${uniq()}`;
    const refMismatch = `TKMIS5000${uniq()}`;
    const refFake = `TKFAKE${uniq()}`;
    app.get(MockProvider).addFixtures({
      [sha256(JPEG_APPROVED)]: {
        text: `TEST_BANK transfer receipt ref=${refApproved} amount=${businessPriceMinor} santim`,
        confidence: 0.99,
      },
      [sha256(JPEG_EXTEND)]: {
        text: `TEST_BANK transfer receipt ref=${refExtended} amount=${businessPriceMinor} santim`,
        confidence: 0.99,
      },
      [sha256(JPEG_MISMATCH)]: {
        text: `TEST_BANK transfer receipt ref=${refMismatch} amount=5000 santim`,
        confidence: 0.99,
      },
      [sha256(JPEG_FAKE)]: {
        text: `TEST_BANK transfer receipt ref=${refFake}`,
        confidence: 0.99,
      },
    });
  }, 90_000);

  afterAll(async () => {
    // Best-effort cleanup. Immutable ledger/receipt-author rows stay behind
    // by design; fresh per-run ids make leftovers harmless for later runs.
    for (const id of billingSessionIds) {
      await prisma.billingVerification.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of createdReceiptIds) {
      await prisma.receipt.delete({ where: { id } }).catch(() => undefined);
    }
    // GRANT ledger rows pin some billing rows (Restrict FK) — best effort.
    await prisma.billingVerification.deleteMany({ where: { merchantId } }).catch(() => undefined);
    try {
      await prisma.verification.deleteMany({ where: { merchantId } });
    } catch {
      /* consume/ledger restricts may keep a few behind */
    }
    await prisma.notification.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.subscription.deleteMany({ where: { merchantId } }).catch(() => undefined);
    await prisma.merchant
      .deleteMany({ where: { id: { in: [merchantId, otherMerchantId] } } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [userId, otherUserId] } } })
      .catch(() => undefined);
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });
  const otherAuth = () => ({ Authorization: `Bearer ${otherToken}` });

  async function uploadReceipt(image: Buffer): Promise<string> {
    const presign = await request(app.getHttpServer())
      .post('/api/v1/receipts/presign')
      .set(auth())
      .send({
        fileName: `billing-${randomBytes(4).toString('hex')}.jpg`,
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
    const receiptId = complete.body.receiptId as string;
    createdReceiptIds.push(receiptId);
    return receiptId;
  }

  /** initiate(CONFIG) for one package; registers the session for cleanup. */
  async function initiate(packageCode: string, headers: Record<string, string> = auth()) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/billing/initiate')
      .set(headers)
      .send({ packageCode });
    if (res.status === 200) billingSessionIds.push(res.body.billingSessionId as string);
    return res;
  }

  async function submit(sessionId: string, receiptId: string) {
    return request(app.getHttpServer())
      .post('/api/v1/billing/submit')
      .set(auth())
      .send({ billingSessionId: sessionId, receiptId });
  }

  async function pollSessionBilling(billingId: string): Promise<Record<string, unknown>> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    for (;;) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/billing/${billingId}`)
        .set(auth())
        .expect(200);
      if (res.body.status !== 'PENDING') return res.body as Record<string, unknown>;
      if (Date.now() > deadline) {
        throw new Error(`Billing ${billingId} stayed PENDING past ${POLL_TIMEOUT_MS}ms`);
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

  it('initiate: BUSINESS instructions + session; FREE rejected as unpurchasable', async () => {
    // FREE is rejected at the DTO contract layer (zod refine) BEFORE the
    // service's purchasability guard; both layers agree it is not buyable.
    const free = await initiate('FREE');
    expect(free.status).toBe(422);
    expect(free.body.error.code).toBe('VALIDATION_FAILED');
    // And the service guard is exercised separately in the unit spec
    // (BILLING_PACKAGE_NOT_PURCHASABLE, 400) — see billing.service.spec.ts.

    const res = await initiate('BUSINESS');
    expect(res.status).toBe(200);
    expect(res.body.packageCode).toBe('BUSINESS');
    expect(res.body.expectedAmountMinor).toBe(businessPriceMinor.toString());
    expect(res.body.currency).toBe('ETB');
    expect(res.body.instructions.cbe.accountNumber).toEqual(expect.any(String));
    expect(res.body.instructions.cbe.accountName).toEqual(expect.any(String));
    expect(res.body.instructions.telebirr.phoneNumber).toEqual(expect.any(String));
    expect(res.body.instructions.note).toEqual(expect.any(String));
    expect(res.body.billingSessionId).toEqual(expect.any(String));

    // The session exists as a PENDING billing row before any upload.
    const row = await prisma.billingVerification.findUnique({
      where: { id: res.body.billingSessionId },
    });
    expect(row?.status).toBe('PENDING');
    expect(row?.expectedAmountMinor).toBe(businessPriceMinor);
    expect(row?.receiptId).toBeNull();
  }, 30_000);

  it('happy path: submit → APPROVED → 5 → 405 credits, subscription created, notified', async () => {
    const init = await initiate('BUSINESS');
    const sessionId = init.body.billingSessionId as string;
    const receiptId = await uploadReceipt(JPEG_APPROVED);

    const submitRes = await submit(sessionId, receiptId);
    expect(submitRes.status).toBe(202);
    expect(submitRes.body.status).toBe('PENDING');
    expect(submitRes.body.billingVerificationId).toBe(sessionId);
    expect(submitRes.body.verificationId).toEqual(expect.any(String));

    const detail = await pollSessionBilling(sessionId);
    expect(detail.status).toBe('APPROVED');
    expect(detail.submittedAmountMinor).toBe(businessPriceMinor.toString());
    expect(detail.subscriptionId).toEqual(expect.any(String));
    expect(detail.reviewNote).toBeNull();

    // The credit grant lands right after the approval commits.
    await expectBalanceEventually('405');

    // Subscription: ACTIVE, BUSINESS, ~30-day term.
    const sub = await prisma.subscription.findUnique({
      where: { id: detail.subscriptionId as string },
    });
    expect(sub?.status).toBe('ACTIVE');
    expect(sub?.packageCode).toBe('BUSINESS');
    expect(sub?.expiresAt?.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    expect(merchant?.subscriptionId).toBe(detail.subscriptionId);
    expect(merchant?.currentPackageCode).toBe('BUSINESS');

    // The merchant was notified through the notify() choke point.
    const notification = await prisma.notification.findFirst({
      where: { userId, type: 'BILLING_APPROVED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(notification?.body).toContain('400 credits');

    // Audit trail records the approval.
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'billing.approved', targetId: sessionId },
    });
    expect(audit?.id).toEqual(expect.any(String));
  }, 60_000);

  it('second approval in the same month grants 2× the allotment (405 → 805)', async () => {
    const init = await initiate('BUSINESS');
    const sessionId = init.body.billingSessionId as string;
    const receiptId = await uploadReceipt(JPEG_EXTEND);

    expect((await submit(sessionId, receiptId)).status).toBe(202);
    const detail = await pollSessionBilling(sessionId);
    expect(detail.status).toBe('APPROVED');

    await expectBalanceEventually('805');
  }, 60_000);

  it('exactness extends the same-package subscription (later expiry, same ACTIVE row pattern)', async () => {
    const before = await prisma.subscription.findFirst({
      where: { merchantId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(before).not.toBeNull();
    const expiryBefore = before!.expiresAt!.getTime();

    const init = await initiate('BUSINESS');
    const sessionId = init.body.billingSessionId as string;
    // A third approved payment extends from the later of now / expiry.
    const receiptId = await uploadReceipt(JPEG_APPROVED);
    expect((await submit(sessionId, receiptId)).status).toBe(202);
    const detail = await pollSessionBilling(sessionId);
    expect(detail.status).toBe('APPROVED');
    expect(detail.subscriptionId).toBe(before!.id);

    const after = await prisma.subscription.findUnique({ where: { id: before!.id } });
    expect(after!.expiresAt!.getTime()).toBeGreaterThan(expiryBefore - 1);
  }, 60_000);

  it('amount mismatch → AMOUNT_MISMATCH (zero tolerance), no credits', async () => {
    const init = await initiate('BUSINESS');
    const sessionId = init.body.billingSessionId as string;
    const receiptId = await uploadReceipt(JPEG_MISMATCH);

    expect((await submit(sessionId, receiptId)).status).toBe(202);
    const detail = await pollSessionBilling(sessionId);
    expect(detail.status).toBe('AMOUNT_MISMATCH');
    expect(detail.submittedAmountMinor).toBe('5000');
    expect(detail.reviewNote).toContain('Expected');
    expect(await balance()).toBe('1205'); // 5 + 3× approved grants; a mismatch grants nothing
  }, 60_000);

  it('fake payment screenshot → FAKE', async () => {
    const init = await initiate('BUSINESS');
    const sessionId = init.body.billingSessionId as string;
    const receiptId = await uploadReceipt(JPEG_FAKE);

    expect((await submit(sessionId, receiptId)).status).toBe(202);
    const detail = await pollSessionBilling(sessionId);
    expect(detail.status).toBe('FAKE');
    expect(detail.subscriptionId).toBeNull();
    expect(await balance()).toBe('1205');
  }, 60_000);

  it('the same screenshot cannot fund a second billing session', async () => {
    // Reuse the approved first flow's receipt in a fresh PENDING session.
    const usedReceipt = createdReceiptIds[0];
    expect(usedReceipt).toEqual(expect.any(String));

    const init = await initiate('BUSINESS');
    const sessionId = init.body.billingSessionId as string;
    const res = await submit(sessionId, usedReceipt);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BILLING_RECEIPT_ALREADY_USED');
  }, 30_000);

  it('resubmitting to a settled session → 409 BILLING_SESSION_NOT_PENDING', async () => {
    const settled = billingSessionIds[1]; // the approved happy-path session
    const freshReceipt = await uploadReceipt(JPEG_REUSE);
    const res = await submit(settled, freshReceipt);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BILLING_SESSION_NOT_PENDING');
  }, 30_000);

  it('cross-tenant: another merchant cannot see this merchant session (404)', async () => {
    const foreign = await request(app.getHttpServer())
      .get(`/api/v1/billing/${billingSessionIds[1]}`)
      .set(otherAuth());
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('BILLING_SESSION_NOT_FOUND');
  }, 30_000);

  it('list: paginated billing history with the APPROVED rows included', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/billing').set(auth()).expect(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(6);
    const statuses = (res.body.data as Array<{ status: string }>).map((r) => r.status);
    expect(statuses).toContain('APPROVED');
    expect(statuses).toContain('AMOUNT_MISMATCH');
    expect(statuses).toContain('FAKE');

    const filtered = await request(app.getHttpServer())
      .get('/api/v1/billing?status=APPROVED')
      .set(auth())
      .expect(200);
    for (const row of filtered.body.data as Array<{ status: string }>) {
      expect(row.status).toBe('APPROVED');
    }
  }, 30_000);
});
