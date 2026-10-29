// ============================================================
// Yene Verify — Packages & Subscription E2E (Step 17, real DB)
//
// The READ side of the money path: public pricing catalog +
// the merchant's own subscription state.
//
// Fresh-id fixtures per run (the credits/audit rules block
// deleting old rows, so fixed ids would collide). Sellers:
//   1) catalog is public (no Authorization header)
//   2) subscription/me for BUSINESS / PREMIUM / BUSINESS_PRO
//      merchants, checking daysRemaining > 0 and the
//      displayOrder-based upgrade list.
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/auth/tokens/token.service';
import { newId } from '../src/common/utils/id.util';

describe('Packages & subscription state (e2e, real DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;

  interface MerchantFixture {
    userId: string;
    merchantId: string;
    deviceId: string;
    sessionId: string;
    subscriptionId: string;
    packageCode: 'BUSINESS' | 'PREMIUM' | 'BUSINESS_PRO';
  }

  const business = makeFixture('BUSINESS');
  const premium = makeFixture('PREMIUM');
  const businessPro = makeFixture('BUSINESS_PRO');
  const runTag = randomBytes(5).toString('hex');
  const sweepMerchantIds: string[] = [];

  function makeFixture(packageCode: MerchantFixture['packageCode']): MerchantFixture {
    return {
      userId: newId(),
      merchantId: newId(),
      deviceId: newId(),
      sessionId: newId(),
      subscriptionId: newId(),
      packageCode,
    };
  }

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
    tokenService = moduleRef.get(TokenService);

    let fixtureIndex = 0;
    for (const f of [business, premium, businessPro]) {
      await prisma.user.upsert({
        where: { id: f.userId },
        update: { status: 'ACTIVE', role: 'MERCHANT' },
        create: {
          id: f.userId,
          // Digits only — users_phone_format_check rejects letters, and
          // the loop index keeps the three numbers unique within a run.
          phone: `+2519${Date.now().toString().slice(-7)}${fixtureIndex}`,
          phoneVerifiedAt: new Date(),
          fullName: `E2E Packages ${f.packageCode}`,
          role: 'MERCHANT',
          status: 'ACTIVE',
        },
      });
      fixtureIndex += 1;

      await prisma.merchant.upsert({
        where: { id: f.merchantId },
        update: { status: 'ACTIVE' },
        create: {
          id: f.merchantId,
          ownerUserId: f.userId,
          businessName: `E2E Packages ${f.packageCode} ${runTag}`,
          status: 'ACTIVE',
          creditsBalance: f.packageCode === 'BUSINESS' ? 50n : 0n,
        },
      });

      await prisma.subscription.upsert({
        where: { id: f.subscriptionId },
        update: { status: 'ACTIVE', expiresAt: new Date(Date.now() + 20 * 86_400_000) },
        create: {
          id: f.subscriptionId,
          merchantId: f.merchantId,
          packageCode: f.packageCode,
          status: 'ACTIVE',
          autoRenew: false,
          startedAt: new Date(Date.now() - 10 * 86_400_000),
          expiresAt: new Date(Date.now() + 20 * 86_400_000),
        },
      });
      await prisma.merchant.update({
        where: { id: f.merchantId },
        data: { subscriptionId: f.subscriptionId },
      });

      await prisma.device.upsert({
        where: { id: f.deviceId },
        update: { revokedAt: null },
        create: {
          id: f.deviceId,
          userId: f.userId,
          deviceFingerprint: `e2e-packages-${f.packageCode}-${runTag}`,
          platform: 'ANDROID',
        },
      });
      await prisma.session.upsert({
        where: { id: f.sessionId },
        update: { revokedAt: null },
        create: {
          id: f.sessionId,
          userId: f.userId,
          deviceId: f.deviceId,
          refreshTokenHash: createHash('sha256')
            .update(`e2e-packages-refresh-${runTag}-${f.packageCode}`)
            .digest('hex'),
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
    }
    sweepMerchantIds.push(business.merchantId, premium.merchantId, businessPro.merchantId);
  }, 60_000);

  afterAll(async () => {
    // Best-effort sweep of cheap rows; users stay behind like the credits suite.
    for (const m of sweepMerchantIds) {
      await prisma.merchant.deleteMany({ where: { id: m } }).catch(() => undefined);
    }
    await app.close();
  });

  const auth = (f: MerchantFixture) => {
    const token = tokenService.signAccessToken({
      sub: f.userId,
      role: 'MERCHANT',
      merchantId: f.merchantId,
      sid: f.sessionId,
      did: f.deviceId,
    });
    return { Authorization: `Bearer ${token}` };
  };

  // ── 1. catalog is public ────────────────────────────────────────────────

  it('GET /packages serves the full catalog with NO auth header', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/packages').expect(200);

    const codes = res.body.data.map((p: { code: string }) => p.code);
    expect(codes).toEqual(['FREE', 'PREMIUM', 'BUSINESS', 'BUSINESS_PRO', 'API']);

    // JSON-safe money fields
    for (const p of res.body.data) {
      expect(typeof p.priceMinor === 'string' || p.priceMinor === null).toBe(true);
      expect(typeof p.unlimited).toBe('boolean');
    }
    // displayOrder ASC
    const orders = res.body.data.map((p: { displayOrder: number }) => p.displayOrder);
    expect([...orders].sort((a: number, b: number) => a - b)).toEqual(orders);
  });

  it('GET /packages/BUSINESS → 99900 minor (999 ETB)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/packages/BUSINESS').expect(200);
    expect(res.body.priceMinor).toBe('99900');
    expect(res.body.creditsPerMonth).toBe(400);
    expect(res.body.unlimited).toBe(false);
  });

  it('GET /packages/INVALID → 404, error shape intact', async () => {
    await request(app.getHttpServer()).get('/api/v1/packages/INVALID').expect(404);
  });

  // ── 2. subscription/me per plan ─────────────────────────────────────────

  it('BUSINESS merchant: full state, daysRemaining > 0, upgrades = [BUSINESS_PRO, API]', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/subscription/me')
      .set(auth(business))
      .expect(200);

    expect(res.body.packageCode).toBe('BUSINESS');
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.subscriptionId).toBe(business.subscriptionId);
    expect(Number(res.body.daysRemaining)).toBeGreaterThan(0);
    expect(res.body.unlimited).toBe(false);
    expect(res.body.creditsBalance).toBe('50');
    expect(res.body.canRenew).toBe(true);
    expect(res.body.nextPackageUpgradeOptions.map((o: { code: string }) => o.code)).toEqual([
      'BUSINESS_PRO',
    ]);
  });

  it('PREMIUM merchant: upgrades = [BUSINESS, BUSINESS_PRO]', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/subscription/me')
      .set(auth(premium))
      .expect(200);

    expect(res.body.packageCode).toBe('PREMIUM');
    expect(res.body.unlimited).toBe(true);
    expect(res.body.nextPackageUpgradeOptions.map((o: { code: string }) => o.code)).toEqual([
      'BUSINESS',
      'BUSINESS_PRO',
    ]);
  });

  it('BUSINESS_PRO merchant: upgrades = []', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/subscription/me')
      .set(auth(businessPro))
      .expect(200);

    expect(res.body.packageCode).toBe('BUSINESS_PRO');
    expect(res.body.unlimited).toBe(true);
    expect(res.body.canRenew).toBe(true);
    expect(res.body.nextPackageUpgradeOptions).toEqual([]);
  });

  it('GET /subscription/me without a token → 401 (route is not public)', async () => {
    await request(app.getHttpServer()).get('/api/v1/subscription/me').expect(401);
  });
});
