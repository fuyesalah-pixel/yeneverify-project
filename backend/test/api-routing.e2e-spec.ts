// ============================================================
// Yene Verify — API Routing (e2e)
//
// Enforces the single base path decision from Step 8:
//   - business controllers live under /api/v1/...
//   - ops endpoints (health, version, root) stay at bare paths
//   - the bare /v1 segment is NOT a valid alternate base path
// ============================================================

import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/config.service';
import { resetOtpRateLimits } from './reset-otp-rate-limits';

describe('API routing (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    const cfg = app.get(AppConfigService);

    app.setGlobalPrefix(cfg.runtime.apiPrefix, {
      exclude: ['health', 'health/ready', 'docs', 'version', '/'],
    });
    app.enableVersioning({
      type: VersioningType.URI,
      // No defaultVersion — mirrors src/main.ts.
    });

    await app.init();
    // Repeat-run safety: flush OTP rate-limit counters from earlier runs.
    await resetOtpRateLimits(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 (bare ops path)', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('GET /api/v1/health returns 404 (not a registered path)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(404);
  });

  it('GET /version returns 200 (bare ops path)', async () => {
    const res = await request(app.getHttpServer()).get('/version');
    expect(res.status).toBe(200);
  });

  it('POST /api/v1/auth/request-otp without purpose returns 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/request-otp')
      .send({ phone: '+251911111111' });
    expect(res.status).toBe(200);
  });

  it('POST /v1/auth/request-otp returns 404 (no bare /v1 base path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/request-otp')
      .send({ phone: '+251911111111' });
    expect(res.status).toBe(404);
  });

  it('POST /api/v1/receipts/presign without a token returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/receipts/presign')
      .send({ fileName: 'test.jpg', mimeType: 'image/jpeg', sizeBytes: 160 });
    expect(res.status).toBe(401);
  });

  it('POST /v1/receipts/presign returns 404 (no bare /v1 base path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/receipts/presign')
      .send({ fileName: 'test.jpg', mimeType: 'image/jpeg', sizeBytes: 160 });
    expect(res.status).toBe(404);
  });
});
