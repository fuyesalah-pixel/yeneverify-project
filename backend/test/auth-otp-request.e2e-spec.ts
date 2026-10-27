// ============================================================
// Yene Verify — Request OTP Validation E2E (Phase 0.2 regression)
//
// Purpose used to fall through unparsed (no ZodValidationPipe on the
// auth controller) and `purpose: undefined` reached the OTP insert →
// PrismaClientValidationError → 500. The DTO defaults purpose to
// LOGIN when omitted, and invalid values must be 400, not 500.
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { resetOtpRateLimits } from './reset-otp-rate-limits';
import { AppConfigService } from '../src/config/config.service';

describe('Request OTP validation (e2e)', () => {
  let app: INestApplication;

  const phone = `+2519117${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

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
    // Repeat-run safety: flush OTP rate-limit counters from earlier runs.
    await resetOtpRateLimits(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/request-otp')
      .send(body)
      .set('Content-Type', 'application/json');

  it('returns 200 with no purpose field (defaults to LOGIN)', async () => {
    const res = await post({ phone }).expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.expiresInSeconds).toBeGreaterThan(0);
  });

  it('returns 200 with an explicit LOGIN purpose', async () => {
    const res = await post({ phone, purpose: 'LOGIN' }).expect(200);
    expect(res.body.ok).toBe(true);
  });

  // Project convention: zod validation failures map to ValidationError
  // → HTTP 422 with code VALIDATION_FAILED (same as verifications DTOs).
  it('returns 422 VALIDATION_FAILED for an invalid purpose', async () => {
    const res = await post({ phone, purpose: 'INVALID' }).expect(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 422 for a malformed phone', async () => {
    const res = await post({ phone: 'nope' }).expect(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
