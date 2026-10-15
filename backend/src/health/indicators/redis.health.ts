import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
    const ok = await this.redis.isHealthy();
    const result = this.getStatus(key, ok);
    if (!ok) throw new HealthCheckError('Redis is unreachable', result);
    return result;
  }
}
