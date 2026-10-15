import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { StorageService } from '../../storage/storage.service';
import { AppConfigService } from '../../config';

@Injectable()
export class StorageHealthIndicator extends HealthIndicator {
  constructor(
    private readonly storage: StorageService,
    private readonly config: AppConfigService,
  ) {
    super();
  }

  async isHealthy(key = 'storage'): Promise<HealthIndicatorResult> {
    // In dev, skip storage check unless explicitly enabled
    if (this.config.runtime.isDev) {
      return this.getStatus(key, true, { note: 'skipped in dev' });
    }
    const ok = await this.storage.isHealthy();
    const result = this.getStatus(key, ok);
    if (!ok) throw new HealthCheckError('Storage (R2/Minio) is unreachable', result);
    return result;
  }
}
