// ============================================================
// Yene Verify — OCR readiness E2E
//
// /health/ready must surface the OCR engine state: 0 mock fixtures is
// `degraded` (still 200 — the process is ready, receipts are not), and
// a populated fixture map is `up`. The test mutates the in-process mock
// map instead of the JSON file so it never touches the fixture artifact
// on disk; it clears first because a seeded map may boot with entries.
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/config.service';
import { MockProvider } from '../src/ocr/providers/mock.provider';

interface FixtureMap {
  fixtures: Map<string, { text: string; confidence: number }>;
}

describe('OCR readiness (e2e)', () => {
  let app: INestApplication;
  let mock: MockProvider;
  let fixtures: Map<string, { text: string; confidence: number }>;
  let original: Map<string, { text: string; confidence: number }>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });

    const cfg = app.get(AppConfigService);
    app.setGlobalPrefix(cfg.runtime.apiPrefix, {
      exclude: ['health', 'health/ready', 'health/ocr', 'docs', 'version', '/'],
    });
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();

    mock = app.get(MockProvider);
    fixtures = (mock as unknown as FixtureMap).fixtures;
    original = new Map(fixtures);
  });

  afterAll(async () => {
    fixtures.clear();
    for (const [hash, fixture] of original) fixtures.set(hash, fixture);
    await app.close();
  });

  beforeEach(() => {
    // Every test starts from the state it describes, never from the boot
    // map (which may be seeded locally) or the previous test's fixtures.
    fixtures.clear();
  });

  it('reports ocr degraded when the mock has no fixtures', async () => {
    // The mock engine must be active for this assertion; the dev .env (and
    // the e2e suite's other OCR specs) select it.
    expect(app.get(AppConfigService).ocr.provider).toBe('mock');

    const res = await request(app.getHttpServer()).get('/health/ready');

    // Terminus keeps the probe green (the process is ready); the OCR entry
    // itself is what says receipts cannot verify.
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.info.ocr).toMatchObject({
      status: 'degraded',
      provider: 'mock',
      fixtures: 0,
      message: 'No fixtures — all receipts will fail',
    });
  });

  it('includes ocr as up once at least one fixture is loaded', async () => {
    mock.addFixtures({
      ['a'.repeat(64)]: { text: 'sample receipt text', confidence: 0.93 },
    });

    const res = await request(app.getHttpServer()).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.info.ocr).toMatchObject({
      status: 'up',
      provider: 'mock',
      fixtures: 1,
    });
  });

  it('exposes the same state through GET /health/ocr', async () => {
    mock.addFixtures({
      ['b'.repeat(64)]: { text: 'another receipt', confidence: 0.9 },
    });

    const res = await request(app.getHttpServer()).get('/health/ocr');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ provider: 'mock', fixtures: 1 });
  });
});
