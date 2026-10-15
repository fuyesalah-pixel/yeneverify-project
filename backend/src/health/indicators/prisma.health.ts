import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key = 'database'): Promise<HealthIndicatorResult> {
    const ok = await this.prisma.isHealthy();
    const result = this.getStatus(key, ok);
    if (!ok) throw new HealthCheckError('PostgreSQL is unreachable', result);
    return result;
  }
}
