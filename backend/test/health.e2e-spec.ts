import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/config.service';

/**
 * Smoke test: the application must boot and serve its liveness probe.
 * Mirrors the bootstrap wiring in src/main.ts (global prefix, URI versioning)
 * so route resolution is exercised exactly as it is at runtime.
 */
describe('Health (e2e)', () => {
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
      // No defaultVersion — controllers declare version: '1' explicitly,
      // mirroring src/main.ts. Ops routes stay at their bare paths.
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 (excluded from the API base path)', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('GET /version returns 200', async () => {
    const res = await request(app.getHttpServer()).get('/version');
    expect(res.status).toBe(200);
  });

  it('GET /api/v1/auth/me without a token returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
