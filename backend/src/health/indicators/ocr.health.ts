import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
  HealthIndicatorStatus,
} from '@nestjs/terminus';
import { AppConfigService } from '../../config';
import { OcrService } from '../../ocr/ocr.service';
import { MockProvider } from '../../ocr/providers/mock.provider';

/**
 * Terminus only knows up/down, but "the engine is running and every real
 * receipt will fail" is neither. `degraded` keeps the distinction visible:
 * readiness treats it as not-healthy, yet the payload says exactly why.
 */
type DegradedResult = Record<
  string,
  { status: HealthIndicatorStatus | 'degraded'; [field: string]: unknown }
>;

/**
 * Readiness check for the OCR engine.
 *
 * The mock engine is always reachable, so "up" alone would be misleading: an
 * empty fixture map means every real receipt resolves to MOCK_OCR_UNMATCHED.
 * That state is reported as `degraded` with an explicit message.
 */
@Injectable()
export class OcrHealthIndicator extends HealthIndicator {
  constructor(
    private readonly config: AppConfigService,
    private readonly ocr: OcrService,
    private readonly mock: MockProvider,
  ) {
    super();
  }

  async isHealthy(key = 'ocr'): Promise<HealthIndicatorResult> {
    if (this.config.ocr.provider === 'mock') {
      const fixtures = this.mock.fixtureCount;
      if (fixtures === 0) {
        const degraded: DegradedResult = {
          [key]: {
            status: 'degraded',
            provider: 'mock',
            fixtures: 0,
            message: 'No fixtures — all receipts will fail',
          },
        };
        return degraded as unknown as HealthIndicatorResult;
      }
      return this.getStatus(key, true, {
        provider: 'mock',
        fixtures,
        message: `ocr: mock, ${fixtures} fixtures`,
      });
    }

    const provider = this.config.ocr.provider;
    const reachable = await this.ocr.health();
    const result = this.getStatus(key, reachable, {
      provider,
      message: reachable
        ? provider === 'tesseract'
          ? 'ocr: tesseract (local)'
          : `ocr: ${provider} reachable`
        : `ocr: ${provider} credentials unavailable`,
    });
    if (!reachable) {
      throw new HealthCheckError('OCR provider is not reachable', result);
    }
    return result;
  }
}
