// ============================================================
// Yene Verify — Onboarding Flow E2E (bug #2 regression)
//
// Exercises the REAL onboarding path: a fresh user logs in through
// real verify-otp (no token minting), /onboarding/status reports
// MERCHANT_PROFILE, POST /onboarding/merchant creates the merchant
// with the AUTHENTICATED owner id (bug #2 core: the controller used
// to hardcode ''), the idempotency guard rejects a second merchant,
// and /merchants/me shows the result.
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockOtpSender } from '../src/auth/otp/mock-otp.sender';
import { resetOtpRateLimits } from './reset-otp-rate-limits';

describe('Merchant onboarding (e2e, real login)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const phone = `+2519222${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

  let sendSpy: jest.SpyInstance;

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
    sendSpy = jest.spyOn(MockOtpSender.prototype, 'send');
    // Repeat-run safety: flush OTP rate-limit counters from earlier runs.
    await resetOtpRateLimits(app);
  });

  afterAll(async () => {
    // Credit transactions and the subscription are append-only per the DB
    // (immutable ledger rules) — merchant/subscription/credit rows are
    // intentionally left in place; the random per-run phone prevents collisions.
    await prisma.session.deleteMany({ where: { user: { phone } } });
    await prisma.device.deleteMany({ where: { user: { phone } } });
    await prisma.otpCode.deleteMany({ where: { phone } });
    await app.close();
  });

  it('logs in a fresh merchant and completes onboarding through the real endpoints', async () => {
    // ── 1. login via real OTP flow ──────────────────────────────────
    await request(app.getHttpServer())
      .post('/api/v1/auth/request-otp')
      .send({ phone, purpose: 'LOGIN' })
      .expect(200);

    const lastCall = sendSpy.mock.calls[sendSpy.mock.calls.length - 1];
    const code = lastCall[1] as string;
    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({
        phone,
        code,
        purpose: 'LOGIN',
        device: { fingerprint: 'e2e-onboarding', platform: 'ANDROID' },
      })
      .expect(200);

    const { accessToken } = verifyRes.body.tokens;
    const auth = { Authorization: `Bearer ${accessToken}` };

    // ── 2. fresh user → needsOnboarding: true, step: MERCHANT_PROFILE ──
    const statusBefore = await request(app.getHttpServer())
      .get('/api/v1/onboarding/status')
      .set(auth)
      .expect(200);
    expect(statusBefore.body).toEqual({
      needsOnboarding: true,
      step: 'MERCHANT_PROFILE',
    });

    // ── 3. POST /onboarding/merchant → 201, owned by the logged-in user ──
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/onboarding/merchant')
      .set(auth)
      .send({
        businessName: 'E2E Onboarding Merchant',
        businessType: 'RETAIL',
        city: 'Addis Ababa',
      })
      .expect(201);

    const merchant = createRes.body.merchant as Record<string, string>;
    const merchantId = merchant.id;
    expect(typeof merchantId).toBe('string');
    // The owner is the authenticated user, not a client-supplied id (bug #2)
    const user = await prisma.user.findUnique({ where: { phone } });
    expect(merchant.ownerUserId).toBe(user!.id);

    const merchantRow = await prisma.merchant.findUnique({ where: { id: merchantId } });
    expect(merchantRow).not.toBeNull();
    expect(merchantRow!.ownerUserId).toBe(user!.id);
    expect(merchantRow!.businessName).toBe('E2E Onboarding Merchant');
    expect(merchantRow!.currentPackageCode).toBe('FREE');

    // FREE plan seeded with an initial credit grant
    expect(merchantRow!.creditsBalance.toString()).toBe('10');

    // ── 4. status now COMPLETE ─────────────────────────────────────
    const statusAfter = await request(app.getHttpServer())
      .get('/api/v1/onboarding/status')
      .set(auth)
      .expect(200);
    expect(statusAfter.body).toEqual({
      needsOnboarding: false,
      step: 'COMPLETE',
    });

    // ── 5. second POST → 409 idempotency conflict ──────────────────
    await request(app.getHttpServer())
      .post('/api/v1/onboarding/merchant')
      .set(auth)
      .send({ businessName: 'Duplicate Merchant' })
      .expect(409);

    // ── 6. /merchants/me returns the created merchant ──────────────
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/merchants/me')
      .set(auth)
      .expect(200);
    expect(meRes.body.id).toBe(merchantId);
    expect(meRes.body.creditsBalance).toBe('10'); // bigint leaves as string
  });
});
