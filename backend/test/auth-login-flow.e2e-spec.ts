// ============================================================
// Yene Verify — Auth Login Flow E2E (bug #1 regression)
//
// Exercises the REAL OTP login path end to end:
//   request-otp → verify-otp (real user creation + session) →
//   authenticated call → refresh → authenticated call →
//   refresh-token reuse rejected.
//
// No token minting anywhere: the access token must come from
// verify-otp with a real sid, and the refresh token must match
// the session row hashed with sha256. (The SMS sender is still a
// mock by nature in tests; the code is captured from its call args.)
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { createHash } from 'crypto';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockOtpSender } from '../src/auth/otp/mock-otp.sender';

const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex');

describe('Auth login flow (e2e, real verify-otp)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Random per-run phone so OTP rate limits and leftover users never collide.
  const phone = `+2519111${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

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
  });

  afterAll(async () => {
    // Session rows have no append-only rule; the user row stays (audit logs
    // reference it and cannot be removed). Devices/sessions/OTPs are safe.
    await prisma.session.deleteMany({ where: { user: { phone } } });
    await prisma.device.deleteMany({ where: { user: { phone } } });
    await prisma.otpCode.deleteMany({ where: { phone } });
    await app.close();
  });

  it('logs in via real verify-otp, makes an authenticated call, refreshes, and rejects stale reuse', async () => {
    // ── 1. request an OTP ────────────────────────────────────────────
    const requestRes = await request(app.getHttpServer())
      .post('/api/v1/auth/request-otp')
      .send({ phone, purpose: 'LOGIN' })
      .expect(200);

    expect(requestRes.body).toEqual({ ok: true, expiresInSeconds: 300 });

    // ── 2. capture the code from the (mock) sender ──────────────────
    expect(sendSpy).toHaveBeenCalled();
    const lastCall = sendSpy.mock.calls[sendSpy.mock.calls.length - 1];
    const code = lastCall[1] as string;
    expect(code).toMatch(/^\d{6}$/);

    // ── 3. verify OTP through the real endpoint ─────────────────────
    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({
        phone,
        code,
        purpose: 'LOGIN',
        device: { fingerprint: 'e2e-login-flow', platform: 'ANDROID' },
      })
      .expect(200);

    const { accessToken, refreshToken, expiresIn } = verifyRes.body.tokens;
    const user = verifyRes.body.user;
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();
    expect(user.phone).toBe(phone);
    expect(user.role).toBe('MERCHANT');
    expect(expiresIn).toBeGreaterThan(0);

    // ── 4. access token carries a REAL session id (bug #1 core) ────
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    expect(typeof payload.sid).toBe('string');
    expect(payload.sid).not.toBe('');
    expect(payload.sid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    // The claimed session exists in the DB…
    const claimedSession = await prisma.session.findUnique({ where: { id: payload.sid } });
    expect(claimedSession).not.toBeNull();

    // …and the refresh token matches its stored sha256 hash (bug #1 core).
    expect(claimedSession!.refreshTokenHash).toBe(sha256(refreshToken));
    expect(claimedSession!.revokedAt).toBeNull();

    // cid claim (device id) is real too.
    expect(payload.did).toBeDefined();
    expect(payload.did.length).toBeGreaterThan(0);

    // ── 5. authenticated call with the issued token → 200 ──────────
    // /me is onboarding-gated: give the fresh user a merchant profile row
    // so the guard passes and the token (not the row) is what's under test.
    await prisma.merchant.upsert({
      where: { ownerUserId: user.id },
      update: { status: 'ACTIVE' },
      create: {
        id: crypto.randomUUID(),
        ownerUserId: user.id,
        businessName: 'E2E Login Flow Merchant',
        status: 'ACTIVE',
        creditsBalance: 0n,
        currentPackageCode: 'FREE',
      },
    });
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(meRes.body.id).toBe(user.id);

    // ── 6. refresh → new pair, old session revoked ─────────────────
    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    const { accessToken: newAccess, refreshToken: newRefresh } = refreshRes.body;
    expect(newAccess).toBeDefined();
    expect(newRefresh).toBeDefined();
    expect(newRefresh).not.toBe(refreshToken);

    const newPayload = JSON.parse(Buffer.from(newAccess.split('.')[1], 'base64').toString());
    expect(newPayload.sid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(newPayload.sid).not.toBe(payload.sid);

    const refreshedSession = await prisma.session.findUnique({
      where: { id: newPayload.sid },
    });
    expect(refreshedSession).not.toBeNull();
    expect(refreshedSession!.refreshTokenHash).toBe(sha256(newRefresh));

    const oldSession = await prisma.session.findUnique({ where: { id: payload.sid } });
    expect(oldSession!.revokedAt).not.toBeNull();

    // ── 7. authenticated call with the refreshed token → 200 ───────
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newAccess}`)
      .expect(200);

    // ── 8. replaying the old refresh token must be rejected with 401
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
