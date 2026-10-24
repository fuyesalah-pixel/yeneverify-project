// ============================================================
// Yene Verify — Bank Adapter Metrics
//
// Structured counters for adapter outcomes, kept in Redis so they
// survive restarts and aggregate across instances:
//
//   bank_adapter:outcomes:{bank}:{result}  → count
//   bank_adapter:attempts:{bank}           → total attempt count
//   bank_adapter:duration:{bank}           → cumulative duration ms
//
// Recording is best-effort: a Redis outage degrades observability,
// never verification.
// ============================================================

import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

const TTL_SECONDS = 3600;

@Injectable()
export class BankAdapterMetrics {
  private readonly logger = new Logger(BankAdapterMetrics.name);

  constructor(@Optional() private readonly redis?: RedisService) {}

  async record(
    bankCode: string,
    outcome: 'VERIFIED' | 'FAKE' | 'ERROR' | 'TIMEOUT',
    attempts: number,
    durationMs: number,
  ): Promise<void> {
    if (!this.redis) {
      return; // Unit tests construct adapters without Redis.
    }
    try {
      await this.redis.incr(`bank_adapter:outcomes:${bankCode}:${outcome}`, TTL_SECONDS);
      await this.redis.incrBy(`bank_adapter:attempts:${bankCode}`, attempts, TTL_SECONDS);
      await this.redis.incrBy(`bank_adapter:duration:${bankCode}`, durationMs, TTL_SECONDS);
    } catch (err) {
      this.logger.warn(`metrics recording failed: ${String(err)}`);
    }
  }
}
