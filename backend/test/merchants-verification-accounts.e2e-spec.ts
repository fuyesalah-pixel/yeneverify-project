// ============================================================
// Yene Verify — Merchant Verification Accounts E2E (Part 0)
//
// Real login + onboarding + PIN step-up. Covers the full contract:
//   POST /onboarding/merchant accepts verificationAccounts
//   GET  /merchants/me/verification-accounts
//   PUT  /merchants/me/verification-accounts (step-up required)
//   GET  /merchants/me/verification-accounts/supported-banks
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockOtpSender } from '../src/auth/otp/mock-otp.sender';
import { resetOtpRateLimits } from './reset-otp-rate-limits';

const PIN = '5729';

describe('Merchant verification accounts (e2e, real login + step-up)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const phone = `+2519333${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
  let auth: { Authorization: string };
  let stepUpToken: string;
  let merchantId: string;

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
    await resetOtpRateLimits(app);
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { user: { phone } } });
    await prisma.device.deleteMany({ where: { user: { phone } } });
    await prisma.otpCode.deleteMany({ where: { phone } });
    await app.close();
  });

  it('creates a merchant with accounts, then reads, merges, validates, and audits updates', async () => {
    // ── 1. real login ──────────────────────────────────────────────
    const sendSpy = jest.spyOn(MockOtpSender.prototype, 'send');
    await request(app.getHttpServer())
      .post('/api/v1/auth/request-otp')
      .send({ phone, purpose: 'LOGIN' })
      .expect(200);

    const lastCall = sendSpy.mock.calls[sendSpy.mock.calls.length - 1];
    const code = lastCall[1] as string;
    sendSpy.mockRestore();

    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({
        phone,
        code,
        purpose: 'LOGIN',
        device: { fingerprint: 'e2e-verification-accounts', platform: 'ANDROID' },
      })
      .expect(200);
    auth = { Authorization: `Bearer ${verifyRes.body.tokens.accessToken}` };

    // ── 2. PIN setup + step-up token ───────────────────────────────
    await request(app.getHttpServer())
      .post('/api/v1/auth/pin/set')
      .set(auth)
      .send({ pin: PIN })
      .expect(200);

    const stepUpRes = await request(app.getHttpServer())
      .post('/api/v1/auth/pin/verify')
      .set(auth)
      .send({ pin: PIN })
      .expect(200);
    stepUpToken = stepUpRes.body.stepUpToken as string;
    expect(typeof stepUpToken).toBe('string');

    // ── 3. onboarding accepts verificationAccounts ─────────────────
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/onboarding/merchant')
      .set(auth)
      .send({
        businessName: 'E2E Verification Accounts',
        city: 'Addis Ababa',
        verificationAccounts: {
          cbe: { full: '1000123456789' },
          abyssinia: { full: '0123456789' },
        },
      })
      .expect(201);
    merchantId = createRes.body.merchant.id as string;

    const stored = await prisma.merchant.findUnique({ where: { id: merchantId } });
    expect(stored!.verificationAccounts).toEqual({
      cbe: { full: '1000123456789', last8: '23456789' },
      abyssinia: { full: '0123456789', last5: '56789' },
    });

    // ── 4. GET returns the configured accounts ─────────────────────
    const getRes = await request(app.getHttpServer())
      .get('/api/v1/merchants/me/verification-accounts')
      .set(auth)
      .expect(200);
    expect(getRes.body.verificationAccounts).toEqual({
      cbe: { full: '1000123456789', last8: '23456789' },
      abyssinia: { full: '0123456789', last5: '56789' },
    });

    // ── 5. supported banks catalogue ───────────────────────────────
    const banksRes = await request(app.getHttpServer())
      .get('/api/v1/merchants/me/verification-accounts/supported-banks')
      .set(auth)
      .expect(200);
    expect(banksRes.body.banks).toHaveLength(3);
    expect(banksRes.body.banks.map((b: { bankCode: string }) => b.bankCode)).toEqual([
      'CBE',
      'ABYSSINIA',
      'AWASH',
    ]);
    expect(banksRes.body.banks[0].fields[0]).toMatchObject({
      key: 'full',
      label: 'Your CBE account number',
      minLength: 10,
      maxLength: 16,
      note: 'We only use the last 8 digits for verification.',
    });

    // ── 6. PUT without step-up → 401 ───────────────────────────────
    const noStepUp = await request(app.getHttpServer())
      .put('/api/v1/merchants/me/verification-accounts')
      .set(auth)
      .send({ cbe: { full: '1000999988887' } })
      .expect(401);
    expect(noStepUp.body.error.code).toBe('AUTH_STEP_UP_REQUIRED');

    // ── 7. PUT with step-up merges and clears ──────────────────────
    const putRes = await request(app.getHttpServer())
      .put('/api/v1/merchants/me/verification-accounts')
      .set(auth)
      .set('X-Step-Up-Token', stepUpToken)
      .send({
        cbe: { full: '1000999988887' },
        abyssinia: null,
        awash: { full: '0123456789' },
      })
      .expect(200);
    expect(putRes.body.verificationAccounts).toEqual({
      cbe: { full: '1000999988887', last8: '99988887' },
      awash: { full: '0123456789', accountNumber: '0123456789' },
    });

    // ── 8. invalid account → 422 validation error ──────────────────
    const invalid = await request(app.getHttpServer())
      .put('/api/v1/merchants/me/verification-accounts')
      .set(auth)
      .set('X-Step-Up-Token', stepUpToken)
      .send({ cbe: { full: '123' } })
      .expect(422);
    expect(invalid.body.error.code).toBe('VALIDATION_FAILED');
    expect(invalid.body.error.details.fields['cbe.full']).toEqual(['Must be 10 to 16 digits']);

    // ── 9. audit entry (fire-and-forget) ───────────────────────────
    let auditRow = null;
    for (let i = 0; i < 20 && !auditRow; i++) {
      auditRow = await prisma.auditLog.findFirst({
        where: {
          action: 'merchant.verification_accounts.updated',
          targetId: merchantId,
        },
      });
      if (!auditRow) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(auditRow).not.toBeNull();
    // Full account numbers never enter the audit log — only masked values.
    const metadata = JSON.stringify(auditRow!.metadata);
    expect(metadata).not.toContain('1000999988887');
    expect(metadata).not.toContain('0123456789');
    expect(JSON.parse(metadata).maskedAccounts).toEqual({
      cbe: '*********8887',
      awash: '******6789',
    });
  });
});
