// ============================================================
// Yene Verify — Sub-merchant invite flow E2E (Step 22A regression)
//
// Covers the two bugs that blocked the mobile invite screen:
//   1. POST /sub-merchants/accept was 403'd by OnboardedGuard.
//   2. GET /onboarding/status only checked INVITED rows when the user was
//      already SUB_MERCHANT, but role changes at ACCEPT time. Invited
//      MERCHANT users saw MERCHANT_PROFILE instead of the invite.
//
// All logins use the real OTP path; no token minting.
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockOtpSender } from '../src/auth/otp/mock-otp.sender';
import { resetOtpRateLimits } from './reset-otp-rate-limits';

const BUSINESS_NAME = 'E2E Invite Owner Merchant';

describe('Sub-merchant invite flow (e2e, real login)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sendSpy: jest.SpyInstance;

  const ownerPhone = `+2519777${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
  const acceptPhone = `+2519888${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
  const declinePhone = `+2519999${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

  let ownerToken = '';
  let acceptToken = '';
  let declineToken = '';
  let acceptInviteToken = '';
  let declineInviteToken = '';
  let acceptUserId = '';

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

    // Owner: log in, onboard, then re-login so the token carries merchantId
    // (the invite route is tenant-scoped).
    const firstOwnerToken = await login(ownerPhone, 'e2e-invite-owner');
    await request(app.getHttpServer())
      .post('/api/v1/onboarding/merchant')
      .set('Authorization', `Bearer ${firstOwnerToken}`)
      .send({ businessName: BUSINESS_NAME })
      .expect(201);
    ownerToken = await login(ownerPhone, 'e2e-invite-owner');

    // Invitees must already have accounts (invite requires an existing user).
    const accept = await loginUser(acceptPhone, 'e2e-invite-accept');
    acceptToken = accept.token;
    acceptUserId = accept.userId;

    declineToken = await login(declinePhone, 'e2e-invite-decline');
  });

  afterAll(async () => {
    const phones = [ownerPhone, acceptPhone, declinePhone];
    await prisma.session.deleteMany({ where: { user: { phone: { in: phones } } } });
    await prisma.device.deleteMany({ where: { user: { phone: { in: phones } } } });
    await prisma.otpCode.deleteMany({ where: { phone: { in: phones } } });
    await app.close();
  });

  async function login(phone: string, fingerprint: string): Promise<string> {
    return (await loginUser(phone, fingerprint)).token;
  }

  async function loginUser(
    phone: string,
    fingerprint: string,
  ): Promise<{ token: string; userId: string }> {
    await request(app.getHttpServer())
      .post('/api/v1/auth/request-otp')
      .send({ phone, purpose: 'LOGIN' })
      .expect(200);

    const lastCall = sendSpy.mock.calls[sendSpy.mock.calls.length - 1];
    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({
        phone,
        code: lastCall[1],
        purpose: 'LOGIN',
        device: { fingerprint, platform: 'ANDROID' },
      })
      .expect(200);

    return {
      token: verifyRes.body.tokens.accessToken,
      userId: verifyRes.body.user.id,
    };
  }

  async function invite(phone: string, branchLabel?: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sub-merchants/invite')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ phone, ...(branchLabel ? { branchLabel } : {}) })
      .expect(201);
    return res.body.inviteToken as string;
  }

  function statusFor(token: string) {
    return request(app.getHttpServer())
      .get('/api/v1/onboarding/status')
      .set('Authorization', `Bearer ${token}`);
  }

  it('shows SUB_MERCHANT_ACCEPT to an invited MERCHANT user', async () => {
    // Sanity: the invitee is a MERCHANT with no merchant profile.
    const user = await prisma.user.findUnique({
      where: { id: acceptUserId },
      select: { role: true },
    });
    expect(user!.role).toBe('MERCHANT');

    acceptInviteToken = await invite(acceptPhone, 'Bole');

    const res = await statusFor(acceptToken).expect(200);
    expect(res.body.needsOnboarding).toBe(true);
    expect(res.body.step).toBe('SUB_MERCHANT_ACCEPT');
    expect(res.body.pendingInvite).toEqual({
      id: expect.any(String),
      merchantName: BUSINESS_NAME,
      branchLabel: 'Bole',
    });
  });

  it('accepts the invite, flips the role, and completes onboarding', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sub-merchants/accept')
      .set('Authorization', `Bearer ${acceptToken}`)
      .send({ token: acceptInviteToken })
      .expect(200);

    expect(typeof res.body.subMerchantId).toBe('string');
    expect(typeof res.body.merchantId).toBe('string');

    const status = await statusFor(acceptToken).expect(200);
    expect(status.body).toEqual({ needsOnboarding: false, step: 'COMPLETE' });

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${acceptToken}`)
      .expect(200);
    expect(me.body.role).toBe('SUB_MERCHANT');
  });

  it('declines an invite and falls back to MERCHANT_PROFILE', async () => {
    declineInviteToken = await invite(declinePhone, 'Piassa');

    const invited = await statusFor(declineToken).expect(200);
    expect(invited.body.step).toBe('SUB_MERCHANT_ACCEPT');

    // The endpoint is public/token-only and returns 200 with { declined }.
    await request(app.getHttpServer())
      .post('/api/v1/sub-merchants/decline')
      .set('Authorization', `Bearer ${declineToken}`)
      .send({ token: declineInviteToken })
      .expect(200)
      .expect(({ body }) => expect(body.declined).toBe(true));

    const afterDecline = await statusFor(declineToken).expect(200);
    expect(afterDecline.body).toEqual({
      needsOnboarding: true,
      step: 'MERCHANT_PROFILE',
    });

    // The declined invitee can onboard as a merchant themselves.
    await request(app.getHttpServer())
      .post('/api/v1/onboarding/merchant')
      .set('Authorization', `Bearer ${declineToken}`)
      .send({ businessName: 'E2E Declined Invite Merchant' })
      .expect(201);

    const completed = await statusFor(declineToken).expect(200);
    expect(completed.body).toEqual({ needsOnboarding: false, step: 'COMPLETE' });
  });
});
