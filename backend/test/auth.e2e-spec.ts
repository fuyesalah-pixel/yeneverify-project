// ============================================================
// Yene Verify — Auth Pre-Onboarding E2E (regression)
//
// The Step 21 manual test only exercised an already-onboarded seed
// merchant, so the real first-login path was never covered:
//   signup → OTP → PIN setup → /me → onboarding → /me
//
// These tests create a brand-new user (no merchant profile) and must
// fail if OnboardedGuard ever blocks /auth/pin/set or /auth/me again.
// They also pin the typed AUTH_WEAK_PIN contract with its reasons.
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockOtpSender } from '../src/auth/otp/mock-otp.sender';
import { resetOtpRateLimits } from './reset-otp-rate-limits';

describe('Auth pre-onboarding flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Random per-run phones so OTP rate limits and leftover users never collide.
  const freshUserPhone = `+2519333${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
  const weakPinPhone = `+2519444${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

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
    await resetOtpRateLimits(app);
  });

  afterAll(async () => {
    const phones = [freshUserPhone, weakPinPhone];
    await prisma.session.deleteMany({ where: { user: { phone: { in: phones } } } });
    await prisma.device.deleteMany({ where: { user: { phone: { in: phones } } } });
    await prisma.otpCode.deleteMany({ where: { phone: { in: phones } } });
    await app.close();
  });

  /** Requests + verifies an OTP for a phone that has no user row yet. */
  async function loginFreshUser(phone: string, fingerprint: string) {
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
        device: { fingerprint, platform: 'ANDROID' },
      })
      .expect(200);

    return verifyRes.body as {
      tokens: { accessToken: string; refreshToken: string };
      user: { id: string; role: string; needsPinSetup: boolean; needsOnboarding: boolean };
    };
  }

  it('lets a brand-new user set a PIN, read /me, then complete onboarding', async () => {
    // ── 1-2. signup via real OTP: no merchant profile exists ────────
    const login = await loginFreshUser(freshUserPhone, 'e2e-pre-onboarding');
    expect(login.user.role).toBe('MERCHANT');
    expect(login.user.needsPinSetup).toBe(true);
    expect(login.user.needsOnboarding).toBe(true);

    const auth = { Authorization: `Bearer ${login.tokens.accessToken}` };

    // No merchant row for this user — the whole point of the regression.
    expect(await prisma.merchant.findUnique({ where: { ownerUserId: login.user.id } })).toBeNull();

    // ── 3. PIN setup MUST work before onboarding (was 403) ─────────
    await request(app.getHttpServer())
      .post('/api/v1/auth/pin/set')
      .set(auth)
      .send({ pin: '5729' })
      .expect(200);

    // ── 4. /me MUST work before onboarding (was 403) ───────────────
    const meBefore = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(auth)
      .expect(200);
    expect(meBefore.body.id).toBe(login.user.id);
    expect(meBefore.body.role).toBe('MERCHANT');
    expect(meBefore.body.ownedMerchant).toBeNull();

    // ── 5. PIN verify MUST work before onboarding ──────────────────
    const verifyPinRes = await request(app.getHttpServer())
      .post('/api/v1/auth/pin/verify')
      .set(auth)
      .send({ pin: '5729' })
      .expect(200);
    expect(typeof verifyPinRes.body.stepUpToken).toBe('string');
    expect(verifyPinRes.body.expiresIn).toBeGreaterThan(0);

    // ── 6. onboarding still reports the missing merchant step ──────
    const statusBefore = await request(app.getHttpServer())
      .get('/api/v1/onboarding/status')
      .set(auth)
      .expect(200);
    expect(statusBefore.body).toEqual({
      needsOnboarding: true,
      step: 'MERCHANT_PROFILE',
    });

    // ── 7. create the merchant profile with the same token ─────────
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/onboarding/merchant')
      .set(auth)
      .send({
        businessName: 'E2E Pre-Onboarding Merchant',
        businessType: 'RETAIL',
        city: 'Addis Ababa',
      })
      .expect(201);

    const merchantId = createRes.body.merchant.id as string;
    expect(typeof merchantId).toBe('string');

    // ── 8. /me still works and now resolves the merchant ───────────
    const meAfter = await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth).expect(200);
    expect(meAfter.body.ownedMerchant).toEqual({ id: merchantId });
  });

  it('rejects weak PINs with AUTH_WEAK_PIN and a typed reason', async () => {
    const login = await loginFreshUser(weakPinPhone, 'e2e-weak-pin');
    const auth = { Authorization: `Bearer ${login.tokens.accessToken}` };

    const cases: Array<{ pin: string; reason: 'repeated' | 'sequential' | 'common' }> = [
      { pin: '0000', reason: 'repeated' },
      { pin: '1234', reason: 'sequential' },
      { pin: '2580', reason: 'common' },
    ];

    for (const { pin, reason } of cases) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/pin/set')
        .set(auth)
        .send({ pin })
        .expect(400);

      expect(res.body.error.code).toBe('AUTH_WEAK_PIN');
      expect(res.body.error.details.reason).toBe(reason);
      expect(res.body.error.message).toContain('too weak');
    }

    // A valid, non-weak PIN is still accepted afterwards.
    await request(app.getHttpServer())
      .post('/api/v1/auth/pin/set')
      .set(auth)
      .send({ pin: '5729' })
      .expect(200);
  });
});
