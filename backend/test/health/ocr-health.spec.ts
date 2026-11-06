// ============================================================
// Yene Verify — OCR readiness indicator (unit)
//
// "Up" must mean receipts can actually verify. The mock engine is
// always reachable, so an empty fixture map is reported as `degraded`
// with an explicit message instead of a green check.
// ============================================================

import { HealthCheckError } from '@nestjs/terminus';
import { OcrHealthIndicator } from '../../src/health/indicators/ocr.health';
import type { AppConfigService } from '../../src/config';
import type { OcrService } from '../../src/ocr/ocr.service';
import type { MockProvider } from '../../src/ocr/providers/mock.provider';

interface Scenario {
  provider: 'mock' | 'google-vision';
  fixtures?: number;
  visionHealthy?: boolean;
}

function indicatorFor(scenario: Scenario): OcrHealthIndicator {
  const config = { ocr: { provider: scenario.provider } } as unknown as AppConfigService;
  const mock = { fixtureCount: scenario.fixtures ?? 0 } as unknown as MockProvider;
  const ocr = {
    health: async () => scenario.visionHealthy ?? true,
  } as unknown as OcrService;
  return new OcrHealthIndicator(config, ocr, mock);
}

describe('OcrHealthIndicator', () => {
  it('reports degraded when the mock has zero fixtures', async () => {
    const result = await indicatorFor({ provider: 'mock', fixtures: 0 }).isHealthy('ocr');

    expect(result.ocr).toMatchObject({
      status: 'degraded',
      provider: 'mock',
      fixtures: 0,
      message: 'No fixtures — all receipts will fail',
    });
  });

  it('reports up with the fixture count when the mock is populated', async () => {
    const result = await indicatorFor({ provider: 'mock', fixtures: 7 }).isHealthy('ocr');

    expect(result.ocr).toMatchObject({
      status: 'up',
      provider: 'mock',
      fixtures: 7,
    });
    expect(String(result.ocr.message)).toContain('7 fixtures');
  });

  it('reports up when Vision is reachable with credentials', async () => {
    const result = await indicatorFor({
      provider: 'google-vision',
      visionHealthy: true,
    }).isHealthy('ocr');

    expect(result.ocr).toMatchObject({
      status: 'up',
      provider: 'google-vision',
    });
  });

  it('reports down when Vision credentials are unavailable', async () => {
    const failure = indicatorFor({
      provider: 'google-vision',
      visionHealthy: false,
    }).isHealthy('ocr');

    await expect(failure).rejects.toBeInstanceOf(HealthCheckError);
    await failure.catch((error: HealthCheckError) => {
      const causes = error.causes as unknown as { ocr?: { status?: string } };
      expect(causes.ocr?.status).toBe('down');
    });
  });
});
